// Auth-related types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

export interface Session {
  id: string;
  token: string;
  expiresAt: string;
  refreshToken?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: User;
  session?: Session;
}

/**
 * Body of a successful POST /auth/session/exchange — the session token and
 * user details the auth service used to pass as OAuth callback query params.
 */
export interface OAuthExchangeResult {
  token: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  staySignedIn: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Stripe-related types
export interface CreateCheckoutSessionRequest {
    priceId?: string;
    successUrl: string;
    cancelUrl: string;
}

export interface CreatePortalSessionRequest {
    returnUrl: string;
}

export interface CreatePortalSessionResponse {
    success: boolean;
    portalUrl: string;
}

export interface SubscriptionStatus {
    currentPlan: "free" | "standard" | "lifetime";
    status: "free" | "standard" | "lifetime" | "cancelled";
    nextBillingDate?: string;
    amount?: number;
    currency?: string;
    interval?: "month" | "year" | "lifetime";
}
