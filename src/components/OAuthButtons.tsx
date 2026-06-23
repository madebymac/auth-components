"use client"

import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"

interface OAuthButtonsProps {
  type: 'login' | 'signup'
  onError?: (error: string) => void
  onSuccess?: (user: any) => void
  staySignedIn?: boolean // Add this prop
}

export default function OAuthButtons({ type, onError, onSuccess, staySignedIn }: OAuthButtonsProps) {
  const handleOAuth = async (provider: "google") => {
    try {
      // In mock mode, simulate OAuth login
      if (auth.isMockMode()) {
        // Simulate OAuth login with mock user
        const mockUser = {
          id: "oauth-user-123",
          email: "user@gmail.com",
          firstName: "Google",
          lastName: "User",
          isEmailVerified: true,
          memberSince: new Date().toISOString().split('T')[0]
        };
        
        // Generate a non-static mock token so mock sessions can't collide
        // with a real token value and aren't predictable (MED-3).
        const mockToken = `mock-oauth-token-${Date.now()}`;
        const mockSessionId = `mock-oauth-session-${Date.now()}`;

        localStorage.setItem('auth_token', mockToken);
        localStorage.setItem('auth_user', JSON.stringify(mockUser));
        localStorage.setItem('auth_session', JSON.stringify({
          id: mockSessionId,
          token: mockToken,
          expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        }));
        
        onSuccess?.(mockUser);
      } else {
        // Real OAuth flow
        await auth.initiateOAuth(provider, staySignedIn, window.location.origin + '/auth/callback');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : `Failed to ${type === 'login' ? 'sign in' : 'sign up'} with ${provider}`
      onError?.(errorMessage)
    }
  }

  const buttonText = type === 'login' ? 'Sign in with Google' : 'Sign up with Google';

  return (
    <Button variant="outline" type="button" className="w-full h-9 sm:h-11 text-sm sm:text-base" onClick={() => handleOAuth("google")}>
        <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {buttonText}
      </Button>
  )
}