"use client"

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle, Loader2, CheckCircle } from 'lucide-react';
import type { User, Session } from '@/lib/types';

interface AuthCallbackProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function AuthCallback({}: AuthCallbackProps) {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        setIsProcessing(true);
        setError(null);
        setSuccess(false);

        // Read session data from URL parameters. This path is itself
        // unsafe (see #7 CRIT-2 — unsigned URL params are not
        // authentication), and is being migrated to a server-side
        // code-exchange flow in a follow-up paired with deployments
        // #168 C-2. CRIT-5 removed the dangerous secondary path
        // (parsing document.body.textContent as JSON), so this is the
        // only branch now.
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const userId = params.get('userId');
        const email = params.get('email');
        const firstName = params.get('firstName');
        const lastName = params.get('lastName');
        const createdAt = params.get('createdAt');

        if (token && userId && email && firstName && lastName && createdAt) {
          const user: User = {
            id: userId,
            email,
            firstName,
            lastName,
            createdAt,
          };

          const session: Session = {
            id: `session-${Date.now()}`,
            token: token,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
          };

          // Store the session data
          localStorage.setItem('auth_token', session.token);
          localStorage.setItem('auth_user', JSON.stringify(user));
          localStorage.setItem('auth_session', JSON.stringify(session));
          localStorage.setItem('auth_stay_signed_in', 'true');

          // Clear URL parameters
          window.history.replaceState({}, document.title, window.location.pathname);
          
          setSuccess(true);
          setTimeout(() => {
            window.location.href = '/';
          }, 1500);
          return;
        }

        // If we get here, no valid data was found
        throw new Error('No valid authentication data found. Please try signing in again.');

      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during authentication';
        setError(errorMessage);
        setIsProcessing(false);
        
        // Clear any partial data that might have been stored
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_stay_signed_in');
      }
    };

    // Process the callback immediately
    handleOAuthCallback();
  }, []);

  // Show success state
  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-green-700 mb-4">
              <CheckCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Authentication Successful</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              You have been successfully signed in. Redirecting to dashboard...
            </p>
            <div className="flex items-center space-x-2 text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If there's an error, show it to the user
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-700 mb-4">
              <XCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Authentication Failed</h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => window.location.href = '/'}
                className="w-full"
              >
                Return to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading state while processing
  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-2 text-blue-700 mb-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <h2 className="text-lg font-semibold">Completing Authentication</h2>
          </div>
          <p className="text-sm text-gray-600">
            Please wait while we complete your sign-in...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}