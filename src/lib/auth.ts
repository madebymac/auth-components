/**
 * Authentication utilities for connecting React components to the auth service
 */


import api from './api';
import type { User, Session, AuthResponse, LoginData, SignupData } from './types';

// Session management configuration
interface SessionConfig {
  refreshThreshold: number; // Minutes before expiration to refresh token
  checkInterval: number; // How often to check session status (minutes)
  maxRefreshAttempts: number; // Maximum refresh attempts before logout
}

class AuthClient {
  private isDevelopment: boolean;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private refreshAttempts: number = 0;
  private isRefreshing: boolean = false;
  private refreshPromise: Promise<boolean> | null = null;
  
  // Session management configuration
  private sessionConfig: SessionConfig = {
    refreshThreshold: 5, // Refresh 5 minutes before expiration
    checkInterval: 1, // Check every minute
    maxRefreshAttempts: 3
  };

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    
    // Initialize session management asynchronously
    if (typeof window !== 'undefined') {
      // Use setTimeout to ensure this runs after the constructor completes
      setTimeout(() => {
        this.initializeSessionManagement().catch(error => {
          console.error('Failed to initialize session management:', error);
        });
      }, 0);
    }
  }

  /**
   * Initialize session management and start monitoring
   */
  private async initializeSessionManagement(): Promise<void> {
    if (typeof window === 'undefined') return;

    // Always register listeners first so they're attached even if the
    // CSRF or validate calls below throw.
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // Skip on-load validation when the URL is an OAuth callback. The
    // callback handler in the host app is about to write a fresh token
    // into localStorage; validating the *previous* (likely stale) token
    // here and then calling api.logout() races with that write and can
    // wipe the freshly-issued OAuth session — which is what was
    // producing "first OAuth attempt fails, second succeeds".
    if (this.isOAuthCallbackInFlight()) {
      if (import.meta.env.DEV) { console.log('🔧 OAuth callback detected in URL, deferring init validation'); }
      return;
    }

    // Fetch CSRF token on initial page load to deposit it in the database
    try {
      if (import.meta.env.DEV) { console.log('🔧 Initializing CSRF token on page load...'); }
      await api.getCSRFToken();
      if (import.meta.env.DEV) { console.log('🔧 CSRF token initialized successfully'); }
    } catch (error) {
      console.error('🔧 Failed to initialize CSRF token on page load:', error);
    }

    if (this.isAuthenticated()) {
      try {
        const result = await this.validateSessionWithRetry();
        if (result === 'invalid') {
          if (import.meta.env.DEV) { console.log('Session validation failed on initialization, clearing session'); }
          this.clearLocalSession();
          this.emitSessionExpired();
          return;
        }
        if (result === 'unknown') {
          // Network/5xx on first load. Don't log the user out — the
          // periodic monitor will revalidate once the network recovers.
          if (import.meta.env.DEV) { console.log('Session validation inconclusive on initialization, keeping session'); }
        } else {
          if (import.meta.env.DEV) { console.log('Session validated successfully on initialization'); }
        }
      } catch (error) {
        // Defensive: validateSessionDetailed shouldn't throw, but if it
        // does we still keep the session rather than logging the user
        // out on a transient error.
        console.error('Session validation error on initialization:', error);
      }

      this.startSessionMonitoring();
    }
  }

  /**
   * True when the current URL looks like an OAuth provider redirect
   * back to our app (oauth_code or legacy auth_token param present).
   */
  private isOAuthCallbackInFlight(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return !!params.get('oauth_code') || !!params.get('auth_token');
    } catch {
      return false;
    }
  }

  /**
   * Clear auth data from localStorage without calling the server.
   * Use this when the server has already told us the session is dead
   * (validateSession returned false) — there's nothing to log out from,
   * and the extra POST can race with subsequent OAuth flows.
   */
  private clearLocalSession(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_session');
    localStorage.removeItem('auth_stay_signed_in');
    localStorage.removeItem('auth_last_validation');
    this.stopSessionMonitoring();
  }

  /**
   * Handle storage changes from other tabs
   */
  private handleStorageChange(event: StorageEvent): void {
    if (import.meta.env.DEV) { console.log('🔧 Storage event detected:', {
      key: event.key,
      oldValue: event.oldValue ? 'present' : 'null',
      newValue: event.newValue ? 'present' : 'null',
      url: event.url,
      timestamp: new Date().toISOString()
    }); }
    
    if (event.key === 'auth_token') {
      if (event.newValue) {
        // Token was added/updated in another tab
        if (import.meta.env.DEV) { console.log('🔧 Token added/updated in another tab'); }
        this.startSessionMonitoring();
      } else {
        // Token was removed in another tab
        if (import.meta.env.DEV) { console.log('🔧 Token removed in another tab - stopping monitoring'); }
        this.stopSessionMonitoring();
      }
    }
  }

  /**
   * Handle page visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden || !this.isAuthenticated()) return;

    // Tab returned after being hidden. The local clock may say the
    // session is still valid (long expiry, e.g. 24h) but the server
    // could have invalidated it. Validate with the server so the UI
    // doesn't sit on a stale token making API calls that 401.
    //
    // Only clear the local session on an *authoritative* invalid
    // response from the server. Transient network failures or 5xx
    // errors must not log the user out — that's the bug where users
    // got booted when their connection blipped while switching tabs.
    this.validateSessionWithRetry()
      .then(result => {
        if (result === 'invalid') {
          if (import.meta.env.DEV) { console.log('🔧 Visibility change: server says session invalid, clearing'); }
          this.clearLocalSession();
          this.emitSessionExpired();
          return;
        }
        if (result === 'unknown') {
          if (import.meta.env.DEV) { console.log('🔧 Visibility change: validation inconclusive, keeping session'); }
          return;
        }
        // Still valid — fall through to the normal refresh-if-near-expiry check.
        this.checkAndRefreshSession();
      })
      .catch(err => {
        console.error('🔧 Visibility change: validateSession threw', err);
      });
  }

  /**
   * Validate the session with retry + exponential backoff. Returns the
   * authoritative result from the server when it can, or 'unknown' if
   * every attempt failed for non-auth reasons (network/5xx). Callers
   * should NOT treat 'unknown' as a logout signal.
   */
  private async validateSessionWithRetry(
    attempts: number = 3,
    initialDelayMs: number = 500,
  ): Promise<'valid' | 'invalid' | 'unknown'> {
    let delay = initialDelayMs;
    for (let i = 0; i < attempts; i++) {
      const result = await this.validateSessionDetailed();
      if (result !== 'unknown') {
        return result;
      }
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
    return 'unknown';
  }

  /**
   * Start monitoring session status
   */
  private startSessionMonitoring(): void {
    if (import.meta.env.DEV) { console.log('🔧 Starting session monitoring:', {
      timestamp: new Date().toISOString(),
      hadExistingInterval: !!this.sessionCheckInterval
    }); }
    
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }

    this.sessionCheckInterval = setInterval(() => {
      this.checkAndRefreshSession();
    }, this.sessionConfig.checkInterval * 60 * 1000);

    // Add a delay before the first check to give the auth service time to process
    // This prevents immediate validation right after login
    setTimeout(() => {
      if (import.meta.env.DEV) { console.log('🔧 Delayed first session check (after 2 second delay)'); }
      this.checkAndRefreshSession();
    }, 2000); // 2 second delay
  }

  /**
   * Stop monitoring session status
   */
  private stopSessionMonitoring(): void {
    if (import.meta.env.DEV) { console.log('🔧 Stopping session monitoring:', {
      timestamp: new Date().toISOString(),
      hadInterval: !!this.sessionCheckInterval
    }); }
    
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  /**
   * Check if session needs refresh and handle accordingly
   */
  private async checkAndRefreshSession(): Promise<void> {
    if (import.meta.env.DEV) { console.log('🔧 Session check started:', {
      timestamp: new Date().toISOString(),
      isAuthenticated: this.isAuthenticated()
    }); }
    
    if (!this.isAuthenticated()) {
      if (import.meta.env.DEV) { console.log('🔧 Session check: User not authenticated, stopping monitoring'); }
      this.stopSessionMonitoring();
      return;
    }

    const session = this.getCurrentSession();
    if (!session) {
      if (import.meta.env.DEV) { console.log('🔧 Session check: No session found, clearing local state'); }
      this.clearLocalSession();
      this.emitSessionExpired();
      return;
    }

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    const refreshThresholdMs = this.sessionConfig.refreshThreshold * 60 * 1000;

    if (import.meta.env.DEV) { console.log('🔧 Session check details:', {
      sessionId: session.id,
      expiresAt: session.expiresAt,
      currentTime: new Date().toISOString(),
      timeUntilExpiry: Math.round(timeUntilExpiry / 1000 / 60), // minutes
      refreshThreshold: this.sessionConfig.refreshThreshold, // minutes
      shouldRefresh: timeUntilExpiry <= refreshThresholdMs,
      isExpired: timeUntilExpiry <= 0
    }); }

    if (timeUntilExpiry <= 0) {
      if (import.meta.env.DEV) { console.log('🔧 Session check: Session has expired, clearing local state'); }
      this.clearLocalSession();
      this.emitSessionExpired();
    } else if (timeUntilExpiry <= refreshThresholdMs) {
      if (import.meta.env.DEV) { console.log(`🔧 Session check: Session expiring in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, refreshing token`); }
      const refreshSuccess = await this.refreshSession();
      if (!refreshSuccess) {
        if (import.meta.env.DEV) { console.log('🔧 Session check: Session refresh failed, clearing local state'); }
        this.clearLocalSession();
        this.emitSessionExpired();
      }
    } else {
      // Session is still valid, but let's validate it with the server periodically
      // Only validate every 5 minutes to avoid too many requests
      const lastValidation = parseInt(
        localStorage.getItem('auth_last_validation') ?? '',
        10,
      );
      const now = Date.now();
      const validationInterval = 5 * 60 * 1000; // 5 minutes

      // NaN when the key is missing or corrupted — fail safe by validating.
      // (`NaN > interval` is false, which would otherwise skip validation
      // indefinitely, leaving a corrupted timestamp wedging out all future
      // server revalidation.)
      if (Number.isNaN(lastValidation) || (now - lastValidation) > validationInterval) {
        if (import.meta.env.DEV) { console.log('🔧 Session check: Performing periodic session validation'); }
        const result = await this.validateSessionWithRetry();
        if (result === 'valid') {
          localStorage.setItem('auth_last_validation', now.toString());
          if (import.meta.env.DEV) { console.log('🔧 Session check: Periodic validation successful'); }
        } else if (result === 'invalid') {
          if (import.meta.env.DEV) { console.log('🔧 Session check: Periodic validation rejected by server, clearing local state'); }
          this.clearLocalSession();
          this.emitSessionExpired();
        } else {
          // 'unknown' — network/5xx. Keep the session and try again on the next tick.
          if (import.meta.env.DEV) { console.log('🔧 Session check: Periodic validation inconclusive, will retry next interval'); }
        }
      } else {
        if (import.meta.env.DEV) { console.log('🔧 Session check: Session still valid, skipping validation'); }
      }
    }
  }

  /**
   * Refresh the current session
   */
  private async refreshSession(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      if (import.meta.env.DEV) { console.log('🔧 Session refresh already in progress, waiting...'); }
      return await this.refreshPromise;
    }

    if (this.refreshAttempts >= this.sessionConfig.maxRefreshAttempts) {
      if (import.meta.env.DEV) { console.log('🔧 Max refresh attempts reached, giving up'); }
      return false;
    }

    this.isRefreshing = true;
    this.refreshAttempts++;
    
    this.refreshPromise = this.performRefresh();
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform the actual session refresh
   */
  private async performRefresh(): Promise<boolean> {
    if (import.meta.env.DEV) { console.log('🔧 Performing session refresh, attempt:', this.refreshAttempts); }
    
    try {
      const success = await api.refreshSession();
      
      if (success) {
        if (import.meta.env.DEV) { console.log('🔧 Session refresh successful'); }
        this.refreshAttempts = 0; // Reset attempts on success
        return true;
      } else {
        if (import.meta.env.DEV) { console.log('🔧 Session refresh failed'); }
        return false;
      }
    } catch (error) {
      console.error('🔧 Session refresh error:', error);
      return false;
    }
  }

  /**
   * Get current session from localStorage
   */
  getCurrentSession(): Session | null {
    if (typeof window === 'undefined') return null;
    
    const sessionStr = localStorage.getItem('auth_session');
    if (!sessionStr) return null;
    
    try {
      return JSON.parse(sessionStr) as Session;
    } catch {
      return null;
    }
  }

  /**
   * Emit session expired event
   */
  private emitSessionExpired(): void {
    // Dispatch custom event for other parts of the app to listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
  }

  /**
   * Check if we should use mock mode.
   *
   * Active on localhost (any build mode) and on Cloudflare Pages *preview*
   * deployments. Cloudflare Pages URL structure:
   *   <hash-or-branch>.<project>.pages.dev  →  4+ segments  (preview → mock)
   *   <project>.pages.dev                   →  3 segments   (production → real auth)
   *
   * The previous check gated on `this.isDevelopment` (import.meta.env.DEV),
   * which is false on Cloudflare Pages (production build). That meant every
   * preview tried the real auth service and was blocked by CORS.
   */
  private shouldUseMock(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    // Cloudflare Pages preview URLs: <hash-or-branch>.<project>.pages.dev
    // Production Pages URLs:          <project>.pages.dev
    // Distinguish by segment count: previews have 4+, production has 3.
    if (hostname.endsWith('.pages.dev')) {
      return hostname.split('.').length >= 4;
    }

    return false;
  }

  /**
   * Generate mock user data
   */
  private generateMockUser(data: { email: string; firstName?: string; lastName?: string }): User {
    return {
      id: `mock-${Date.now()}`,
      email: data.email,
      firstName: data.firstName || 'Mock',
      lastName: data.lastName || 'User',
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Generate mock session data
   */
  private generateMockSession(): Session {
    return {
      id: `session-${Date.now()}`,
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      refreshToken: `mock-refresh-${Date.now()}`,
    };
  }

  /**
   * Login user
   */
  async login(loginData: LoginData, staySignedIn: boolean = true): Promise<User> {
    if (import.meta.env.DEV) { console.log('🔧 Auth login called with:', { 
      isDevelopment: this.isDevelopment, 
      shouldUseMock: this.shouldUseMock(),
      staySignedIn
    }); }

    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Using mock login'); }
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation
      if (!loginData.email || !loginData.password) {
        throw new Error('Email and password are required');
      }

      const user = this.generateMockUser({ email: loginData.email });
      const session = this.generateMockSession();
      
      // Store in localStorage
      localStorage.setItem('auth_token', session.token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_session', JSON.stringify(session));
      localStorage.setItem('auth_stay_signed_in', staySignedIn.toString());
      
      // Start session monitoring
      this.startSessionMonitoring();
      
      if (import.meta.env.DEV) { console.log('🔧 Mock login successful:', user); }
      return user;
    }

    if (import.meta.env.DEV) { console.log('🔧 Using real auth service login'); }
    
    try {
      const user = await api.login(loginData, staySignedIn);
      
      // Start session monitoring
      this.startSessionMonitoring();
      
      if (import.meta.env.DEV) { console.log('🔧 Login successful:', user); }
      return user;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  async signup(signupData: SignupData): Promise<User> {
    if (import.meta.env.DEV) { console.log('🔧 Auth signup called with:', { 
      isDevelopment: this.isDevelopment, 
      shouldUseMock: this.shouldUseMock() 
    }); }

    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Using mock signup'); }
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock validation
      if (!signupData.email || !signupData.password || !signupData.firstName || !signupData.lastName) {
        throw new Error('All fields are required');
      }
      


      const user = this.generateMockUser(signupData);
      const session = this.generateMockSession();
      
      // Store in localStorage
      localStorage.setItem('auth_token', session.token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_session', JSON.stringify(session));
      
      // Start session monitoring
      this.startSessionMonitoring();
      
      if (import.meta.env.DEV) { console.log('🔧 Mock registration successful:', user); }
      return user;
    }

    if (import.meta.env.DEV) { console.log('🔧 Using real auth service signup'); }
    
    try {
      const user = await api.signup(signupData);
      
      // Start session monitoring
      this.startSessionMonitoring();
      
      if (import.meta.env.DEV) { console.log('🔧 Signup successful:', user); }
      return user;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  }

  /**
   * Initiate OAuth flow
   */
  async initiateOAuth(provider: "google" | "github", staySignedIn: boolean = true, frontendRedirectUrl: string): Promise<void> {
    if (import.meta.env.DEV) { console.log(`🔧 Initiating OAuth flow for ${provider} with staySignedIn: ${staySignedIn}`) }

    try {
      const { url } = await api.initiateOAuth(provider, staySignedIn, frontendRedirectUrl)
      window.location.href = url
    } catch (error) {
      console.error(`Failed to initiate OAuth with ${provider}:`, error)
      throw error
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('auth_token');
    if (import.meta.env.DEV) { console.log('🔧 Logout called:', {
      hadToken: !!token,
      tokenLength: token?.length,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join(' | ') // Show call stack
    }); }
    
    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Mock logout successful'); }
    } else {
      await api.logout();
    }

    // Clear all auth data from localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_session');
    localStorage.removeItem('auth_stay_signed_in');

    // Stop session monitoring
    this.stopSessionMonitoring();
  }

  /**
   * Validate current session with server
   */
  async validateSession(): Promise<boolean> {
    if (this.shouldUseMock()) {
      return this.isAuthenticated();
    }

    return await api.validateSession();
  }

  /**
   * Validate current session with server, distinguishing between an
   * authoritative invalid response and a transient/unknown failure.
   */
  async validateSessionDetailed(): Promise<'valid' | 'invalid' | 'unknown'> {
    if (this.shouldUseMock()) {
      return this.isAuthenticated() ? 'valid' : 'invalid';
    }

    return await api.validateSessionDetailed();
  }

  /**
   * Request a password reset link
   */
  async requestPasswordReset(email: string): Promise<AuthResponse> {
    if (import.meta.env.DEV) { console.log('🔧 Auth requestPasswordReset called with:', {
      isDevelopment: this.isDevelopment,
      shouldUseMock: this.shouldUseMock(),
      email
    }); }

    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Using mock requestPasswordReset'); }
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!email) {
        throw new Error('Email is required');
      }
      return { success: true, message: 'Password reset link sent (mock)' };
    }

    return await api.requestPasswordReset(email);
  }

  /**
   * Change user's password using a reset token
   */
  async changePassword(token: string, newPassword: string): Promise<AuthResponse> {
    if (import.meta.env.DEV) { console.log('🔧 Auth changePassword called with:', {
      isDevelopment: this.isDevelopment,
      shouldUseMock: this.shouldUseMock(),
      token: token ? 'present' : 'missing',
      newPassword: newPassword ? 'present' : 'missing'
    }); }

    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Using mock changePassword'); }
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!token || !newPassword) {
        throw new Error('Token and new password are required');
      }
      return { success: true, message: 'Password changed successfully (mock)' };
    }

    return await api.changePassword(token, newPassword);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    if (import.meta.env.DEV) { console.log('🔧 Auth verifyEmail called with:', {
      isDevelopment: this.isDevelopment,
      shouldUseMock: this.shouldUseMock(),
      token: token ? 'present' : 'missing'
    }); }

    if (this.shouldUseMock()) {
      if (import.meta.env.DEV) { console.log('🔧 Using mock verifyEmail'); }
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (!token) {
        throw new Error('Token is required');
      }
      return { success: true, message: 'Email verified successfully (mock)' };
    }

    return await api.verifyEmail(token);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    const token = localStorage.getItem('auth_token');
    if (import.meta.env.DEV) { console.log('🔧 isAuthenticated check:', {
      hasToken: !!token,
      tokenLength: token?.length,
      timestamp: new Date().toISOString(),
      stack: new Error().stack?.split('\n').slice(1, 4).join(' | ') // Show call stack
    }); }
    return !!token;
  }

  /**
   * Get current user from localStorage
   */
  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('auth_user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr) as User;
    } catch {
      return null;
    }
  }

  /**
   * Get session expiration time
   */
  getSessionExpiration(): Date | null {
    const session = this.getCurrentSession();
    return session ? new Date(session.expiresAt) : null;
  }

  /**
   * Check if session is about to expire
   */
  isSessionExpiringSoon(): boolean {
    const session = this.getCurrentSession();
    if (!session) return false;

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    const refreshThresholdMs = this.sessionConfig.refreshThreshold * 60 * 1000;

    return (expiresAt - now) <= refreshThresholdMs;
  }

  /**
   * Check if user opted to stay signed in
   */
  isStaySignedInEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('auth_stay_signed_in') === 'true';
  }

  /**
   * Get time until session expires
   */
  getTimeUntilExpiration(): number {
    const session = this.getCurrentSession();
    if (!session) return 0;

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  }

  /**
   * Get formatted time until expiration
   */
  getFormattedTimeUntilExpiration(): string {
    const timeMs = this.getTimeUntilExpiration();
    if (timeMs === 0) return 'Expired';

    const hours = Math.floor(timeMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return 'Less than 1m';
    }
  }

  /**
   * Update session configuration
   */
  updateSessionConfig(config: Partial<SessionConfig>): void {
    this.sessionConfig = { ...this.sessionConfig, ...config };
    
    // Restart monitoring with new config if currently monitoring
    if (this.sessionCheckInterval) {
      this.startSessionMonitoring();
    }
  }

  /**
   * Get current session configuration
   */
  getSessionConfig(): SessionConfig {
    return { ...this.sessionConfig };
  }

  /**
   * Check if we're using mock mode
   */
  isMockMode(): boolean {
    return this.shouldUseMock();
  }

  /**
   * Cleanup method to be called when the app unmounts
   */
  cleanup(): void {
    this.stopSessionMonitoring();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange.bind(this));
      document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
  }
}

// Create and export the auth instance
export const auth = new AuthClient();

// Re-export types for convenience
export type { User, Session, AuthResponse, LoginData, SignupData };
