import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock the api module BEFORE importing auth
vi.mock('./api', () => {
  const mock = {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn(),
    changePassword: vi.fn(),
    verifyEmail: vi.fn(),
    validateSession: vi.fn(),
    validateSessionDetailed: vi.fn(),
    getCSRFToken: vi.fn().mockResolvedValue('csrf'),
    refreshSession: vi.fn(),
    initiateOAuth: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    getSubscriptionStatus: vi.fn(),
  }
  return { default: mock, ...mock }
})

import { auth } from './auth'
import api from './api'

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>

function setMockHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname, origin: `https://${hostname}`, href: `https://${hostname}/` },
  })
}

function makeSession(expiresAt: string) {
  return {
    id: 'sess-1',
    token: 'mock-token',
    expiresAt,
    refreshToken: 'refresh-1',
  }
}

describe('AuthClient', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockApi.logout.mockResolvedValue(undefined)
    mockApi.getCSRFToken.mockResolvedValue('csrf')
  })

  afterEach(() => {
    auth.cleanup()
    vi.useRealTimers()
  })

  describe('mock mode detection', () => {
    it('uses mock on localhost', () => {
      setMockHostname('localhost')
      expect(auth.isMockMode()).toBe(true)
    })

    it('uses mock on 127.0.0.1', () => {
      setMockHostname('127.0.0.1')
      expect(auth.isMockMode()).toBe(true)
    })

    it('uses mock on Cloudflare Pages preview deployments (4+ segments)', () => {
      setMockHostname('abc123.myproject.pages.dev')
      expect(auth.isMockMode()).toBe(true)
    })

    it('does not mock on production Cloudflare Pages (3 segments)', () => {
      setMockHostname('myproject.pages.dev')
      expect(auth.isMockMode()).toBe(false)
    })

    it('does not mock on other production hosts', () => {
      setMockHostname('example.com')
      expect(auth.isMockMode()).toBe(false)
    })
  })

  describe('login (mock mode)', () => {
    beforeEach(() => {
      setMockHostname('localhost')
    })

    it('throws when missing email', async () => {
      await expect(
        auth.login({ email: '', password: 'x' })
      ).rejects.toThrow(/required/)
    })

    it('throws when missing password', async () => {
      await expect(
        auth.login({ email: 'a@b.com', password: '' })
      ).rejects.toThrow(/required/)
    })

    it('creates mock user and session', async () => {
      const user = await auth.login({ email: 'a@b.com', password: 'x' })
      expect(user.email).toBe('a@b.com')
      expect(localStorage.getItem('auth_token')).toMatch(/^mock-token-/)
      expect(localStorage.getItem('auth_user')).toContain('a@b.com')
      expect(localStorage.getItem('auth_stay_signed_in')).toBe('true')
    })

    it('respects staySignedIn=false', async () => {
      await auth.login({ email: 'a@b.com', password: 'x' }, false)
      expect(localStorage.getItem('auth_stay_signed_in')).toBe('false')
    })
  })

  describe('login (real mode)', () => {
    beforeEach(() => {
      setMockHostname('example.com')
    })

    it('delegates to api.login on success', async () => {
      const user = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', createdAt: 'x' }
      mockApi.login.mockResolvedValue(user)

      const result = await auth.login({ email: 'a@b.com', password: 'pw' })
      expect(mockApi.login).toHaveBeenCalledWith(
        { email: 'a@b.com', password: 'pw' },
        true
      )
      expect(result).toEqual(user)
    })

    it('rethrows on failure', async () => {
      mockApi.login.mockRejectedValue(new Error('nope'))
      await expect(
        auth.login({ email: 'a@b.com', password: 'pw' })
      ).rejects.toThrow(/nope/)
    })
  })

  describe('signup (mock mode)', () => {
    beforeEach(() => {
      setMockHostname('localhost')
    })

    it('throws when missing fields', async () => {
      await expect(
        auth.signup({ email: '', password: '', firstName: '', lastName: '' })
      ).rejects.toThrow(/required/)
    })

    it('creates mock user', async () => {
      const user = await auth.signup({
        email: 'a@b.com',
        password: 'x',
        firstName: 'A',
        lastName: 'B',
      })
      expect(user.firstName).toBe('A')
      expect(localStorage.getItem('auth_token')).toMatch(/^mock-token-/)
    })
  })

  describe('signup (real mode)', () => {
    beforeEach(() => {
      setMockHostname('example.com')
    })

    it('delegates to api.signup on success', async () => {
      const user = { id: '2', email: 'a@b.com', firstName: 'A', lastName: 'B', createdAt: 'x' }
      mockApi.signup.mockResolvedValue(user)

      const result = await auth.signup({
        email: 'a@b.com',
        password: 'pw',
        firstName: 'A',
        lastName: 'B',
      })
      expect(result).toEqual(user)
      expect(mockApi.signup).toHaveBeenCalled()
    })

    it('rethrows on failure', async () => {
      mockApi.signup.mockRejectedValue(new Error('exists'))
      await expect(
        auth.signup({
          email: 'a@b.com',
          password: 'pw',
          firstName: 'A',
          lastName: 'B',
        })
      ).rejects.toThrow(/exists/)
    })
  })

  describe('logout', () => {
    it('clears localStorage on mock', async () => {
      setMockHostname('localhost')
      localStorage.setItem('auth_token', 'x')
      localStorage.setItem('auth_user', '{"a":1}')
      localStorage.setItem('auth_session', '{}')
      localStorage.setItem('auth_stay_signed_in', 'true')
      await auth.logout()
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_user')).toBeNull()
      expect(localStorage.getItem('auth_session')).toBeNull()
      expect(localStorage.getItem('auth_stay_signed_in')).toBeNull()
    })

    it('calls api.logout in real mode', async () => {
      setMockHostname('example.com')
      localStorage.setItem('auth_token', 'x')
      await auth.logout()
      expect(mockApi.logout).toHaveBeenCalled()
    })
  })

  describe('validateSession', () => {
    it('in mock mode, returns true if authenticated', async () => {
      setMockHostname('localhost')
      localStorage.setItem('auth_token', 'x')
      expect(await auth.validateSession()).toBe(true)
    })

    it('in mock mode, returns false if not authenticated', async () => {
      setMockHostname('localhost')
      expect(await auth.validateSession()).toBe(false)
    })

    it('delegates to api in real mode', async () => {
      setMockHostname('example.com')
      mockApi.validateSession.mockResolvedValue(true)
      expect(await auth.validateSession()).toBe(true)
      expect(mockApi.validateSession).toHaveBeenCalled()
    })
  })

  describe('validateSessionDetailed', () => {
    it("in mock mode, returns 'valid' when authenticated", async () => {
      setMockHostname('localhost')
      localStorage.setItem('auth_token', 'x')
      expect(await auth.validateSessionDetailed()).toBe('valid')
    })

    it("in mock mode, returns 'invalid' when not authenticated", async () => {
      setMockHostname('localhost')
      expect(await auth.validateSessionDetailed()).toBe('invalid')
    })

    it('delegates to api in real mode and passes through unknown', async () => {
      setMockHostname('example.com')
      mockApi.validateSessionDetailed.mockResolvedValue('unknown')
      expect(await auth.validateSessionDetailed()).toBe('unknown')
      expect(mockApi.validateSessionDetailed).toHaveBeenCalled()
    })
  })

  // Regression coverage for the original bug: tab visibility flips
  // would call validateSession() and clear the local session on *any*
  // failure, including transient network errors. The fix only clears on
  // an authoritative 'invalid' from the server.
  describe('visibility change behavior', () => {
    beforeEach(() => {
      setMockHostname('example.com')
      // Seed an authenticated session that's nowhere near expiry so the
      // post-validation refresh check is a no-op.
      const oneDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      localStorage.setItem('auth_token', 'tok')
      localStorage.setItem('auth_session', JSON.stringify(makeSession(oneDay)))
      // Pretend the tab is currently visible.
      Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    })

    afterEach(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    })

    async function fireVisibilityAndDrain(timesToAdvanceMs: number[] = []) {
      document.dispatchEvent(new Event('visibilitychange'))
      // Let the chained promises / retry backoff resolve.
      for (const ms of timesToAdvanceMs) {
        await vi.advanceTimersByTimeAsync(ms)
      }
      await vi.runOnlyPendingTimersAsync()
    }

    it("keeps the session when validation is 'unknown' (transient network error)", async () => {
      vi.useFakeTimers()
      mockApi.validateSessionDetailed.mockResolvedValue('unknown')

      await fireVisibilityAndDrain([500, 1000, 2000])

      expect(localStorage.getItem('auth_token')).toBe('tok')
      // Three retry attempts before giving up.
      expect(mockApi.validateSessionDetailed).toHaveBeenCalledTimes(3)
    })

    it("clears the session on an authoritative 'invalid' response", async () => {
      vi.useFakeTimers()
      mockApi.validateSessionDetailed.mockResolvedValue('invalid')
      const expired = vi.fn()
      window.addEventListener('auth:session-expired', expired, { once: true })

      await fireVisibilityAndDrain()

      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(expired).toHaveBeenCalled()
      // No retry once we have a definitive answer.
      expect(mockApi.validateSessionDetailed).toHaveBeenCalledTimes(1)
    })

    it("stops retrying as soon as a definitive result arrives", async () => {
      vi.useFakeTimers()
      // Suppress the post-validation periodic check by marking validation as fresh.
      localStorage.setItem('auth_last_validation', Date.now().toString())
      mockApi.validateSessionDetailed
        .mockResolvedValueOnce('unknown')
        .mockResolvedValueOnce('valid')
        .mockResolvedValueOnce('valid')

      await fireVisibilityAndDrain([500, 1000])

      expect(localStorage.getItem('auth_token')).toBe('tok')
      expect(mockApi.validateSessionDetailed).toHaveBeenCalledTimes(2)
    })
  })

  describe('requestPasswordReset', () => {
    it('throws when email empty in mock mode', async () => {
      setMockHostname('localhost')
      await expect(auth.requestPasswordReset('')).rejects.toThrow(/required/)
    })

    it('returns mock success in mock mode', async () => {
      setMockHostname('localhost')
      const result = await auth.requestPasswordReset('a@b.com')
      expect(result.success).toBe(true)
    })

    it('delegates to api in real mode', async () => {
      setMockHostname('example.com')
      mockApi.requestPasswordReset.mockResolvedValue({ success: true })
      const result = await auth.requestPasswordReset('a@b.com')
      expect(result.success).toBe(true)
    })
  })

  describe('changePassword', () => {
    it('throws when token or password missing in mock mode', async () => {
      setMockHostname('localhost')
      await expect(auth.changePassword('', 'x')).rejects.toThrow(/required/)
      await expect(auth.changePassword('x', '')).rejects.toThrow(/required/)
    })

    it('returns mock success in mock mode', async () => {
      setMockHostname('localhost')
      const result = await auth.changePassword('tok', 'newpass')
      expect(result.success).toBe(true)
    })

    it('delegates to api in real mode', async () => {
      setMockHostname('example.com')
      mockApi.changePassword.mockResolvedValue({ success: true })
      const result = await auth.changePassword('tok', 'newpass')
      expect(result.success).toBe(true)
    })
  })

  describe('verifyEmail', () => {
    it('throws when token missing in mock mode', async () => {
      setMockHostname('localhost')
      await expect(auth.verifyEmail('')).rejects.toThrow(/required/)
    })

    it('returns mock success in mock mode', async () => {
      setMockHostname('localhost')
      const result = await auth.verifyEmail('tok')
      expect(result.success).toBe(true)
    })

    it('delegates to api in real mode', async () => {
      setMockHostname('example.com')
      mockApi.verifyEmail.mockResolvedValue({ success: true })
      const result = await auth.verifyEmail('tok')
      expect(result.success).toBe(true)
    })
  })

  describe('initiateOAuth', () => {
    it('navigates the window to returned url', async () => {
      setMockHostname('example.com')
      mockApi.initiateOAuth.mockResolvedValue({ url: 'https://oauth' })

      // Replace location.href setter
      const originalLocation = window.location
      const locationMock = { ...originalLocation, href: '' }
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: locationMock,
      })

      await auth.initiateOAuth('google', true, 'https://app/cb')
      expect(locationMock.href).toBe('https://oauth')
    })

    it('rethrows on failure', async () => {
      setMockHostname('example.com')
      mockApi.initiateOAuth.mockRejectedValue(new Error('fail'))
      await expect(
        auth.initiateOAuth('google', true, 'https://app/cb')
      ).rejects.toThrow(/fail/)
    })
  })

  describe('session helpers', () => {
    it('isAuthenticated is true when token is set', () => {
      localStorage.setItem('auth_token', 'x')
      expect(auth.isAuthenticated()).toBe(true)
    })

    it('isAuthenticated is false when no token', () => {
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('getCurrentUser returns null when missing', () => {
      expect(auth.getCurrentUser()).toBeNull()
    })

    it('getCurrentUser parses stored user', () => {
      const user = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', createdAt: 'x' }
      localStorage.setItem('auth_user', JSON.stringify(user))
      expect(auth.getCurrentUser()).toEqual(user)
    })

    it('getCurrentUser returns null for invalid JSON', () => {
      localStorage.setItem('auth_user', 'not-json')
      expect(auth.getCurrentUser()).toBeNull()
    })

    it('getCurrentSession returns null when missing', () => {
      expect(auth.getCurrentSession()).toBeNull()
    })

    it('getCurrentSession parses stored session', () => {
      const session = makeSession('2099-01-01')
      localStorage.setItem('auth_session', JSON.stringify(session))
      expect(auth.getCurrentSession()).toEqual(session)
    })

    it('getCurrentSession returns null on invalid JSON', () => {
      localStorage.setItem('auth_session', 'not-json')
      expect(auth.getCurrentSession()).toBeNull()
    })

    it('getSessionExpiration returns null when no session', () => {
      expect(auth.getSessionExpiration()).toBeNull()
    })

    it('getSessionExpiration returns Date for active session', () => {
      localStorage.setItem('auth_session', JSON.stringify(makeSession('2099-01-01')))
      expect(auth.getSessionExpiration()).toBeInstanceOf(Date)
    })

    it('isSessionExpiringSoon returns false without session', () => {
      expect(auth.isSessionExpiringSoon()).toBe(false)
    })

    it('isSessionExpiringSoon is true when within threshold', () => {
      const soon = new Date(Date.now() + 2 * 60 * 1000).toISOString() // 2 minutes
      localStorage.setItem('auth_session', JSON.stringify(makeSession(soon)))
      expect(auth.isSessionExpiringSoon()).toBe(true)
    })

    it('isSessionExpiringSoon is false when far away', () => {
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
      localStorage.setItem('auth_session', JSON.stringify(makeSession(later)))
      expect(auth.isSessionExpiringSoon()).toBe(false)
    })

    it('isStaySignedInEnabled returns true when set', () => {
      localStorage.setItem('auth_stay_signed_in', 'true')
      expect(auth.isStaySignedInEnabled()).toBe(true)
    })

    it('isStaySignedInEnabled returns false otherwise', () => {
      expect(auth.isStaySignedInEnabled()).toBe(false)
      localStorage.setItem('auth_stay_signed_in', 'false')
      expect(auth.isStaySignedInEnabled()).toBe(false)
    })

    it('getTimeUntilExpiration returns 0 when no session', () => {
      expect(auth.getTimeUntilExpiration()).toBe(0)
    })

    it('getTimeUntilExpiration returns positive for future expiration', () => {
      const later = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      localStorage.setItem('auth_session', JSON.stringify(makeSession(later)))
      expect(auth.getTimeUntilExpiration()).toBeGreaterThan(0)
    })

    it('getTimeUntilExpiration returns 0 for past session', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      localStorage.setItem('auth_session', JSON.stringify(makeSession(past)))
      expect(auth.getTimeUntilExpiration()).toBe(0)
    })

    it('getFormattedTimeUntilExpiration returns "Expired" when no session', () => {
      expect(auth.getFormattedTimeUntilExpiration()).toBe('Expired')
    })

    it('getFormattedTimeUntilExpiration formats hours', () => {
      const later = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
      localStorage.setItem('auth_session', JSON.stringify(makeSession(later)))
      expect(auth.getFormattedTimeUntilExpiration()).toMatch(/^\d+h \d+m$/)
    })

    it('getFormattedTimeUntilExpiration formats minutes', () => {
      const later = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      localStorage.setItem('auth_session', JSON.stringify(makeSession(later)))
      expect(auth.getFormattedTimeUntilExpiration()).toMatch(/^\d+m$/)
    })

    it('getFormattedTimeUntilExpiration returns "Less than 1m" for small window', () => {
      const later = new Date(Date.now() + 30 * 1000).toISOString() // 30 seconds
      localStorage.setItem('auth_session', JSON.stringify(makeSession(later)))
      expect(auth.getFormattedTimeUntilExpiration()).toBe('Less than 1m')
    })
  })

  describe('session config', () => {
    it('getSessionConfig returns defaults', () => {
      const config = auth.getSessionConfig()
      expect(config).toHaveProperty('refreshThreshold')
      expect(config).toHaveProperty('checkInterval')
      expect(config).toHaveProperty('maxRefreshAttempts')
    })

    it('updateSessionConfig merges partial config', () => {
      const original = auth.getSessionConfig()
      auth.updateSessionConfig({ refreshThreshold: 99 })
      const updated = auth.getSessionConfig()
      expect(updated.refreshThreshold).toBe(99)
      expect(updated.checkInterval).toBe(original.checkInterval)
      // Restore defaults
      auth.updateSessionConfig(original)
    })
  })
})
