"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { auth } from "@/lib/auth"
import { isSafeRedirect } from "@/lib/utils"
import type { User } from "@/lib/types"
import OAuthButtons from "./OAuthButtons"

interface LoginFormProps {
  onSuccess?: (user: User) => void
  onError?: (error: string) => void
  redirectUrl?: string
  onSwitchToRegister?: () => void
}

export default function LoginForm({ onSuccess, onError, redirectUrl, onSwitchToRegister }: LoginFormProps) {
  const [view, setView] = useState<'login' | 'passwordReset'>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [staySignedIn, setStaySignedIn] = useState(true) // Default to true for better UX
  const [resetSuccess, setResetSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError("Please fill in all fields")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      // Update session configuration based on user preference
      if (staySignedIn) {
        // Enable persistent sessions with longer refresh intervals
        auth.updateSessionConfig({
          refreshThreshold: 10, // Refresh 10 minutes before expiration
          checkInterval: 5, // Check every 5 minutes
          maxRefreshAttempts: 5
        });
      } else {
        // Use shorter sessions for temporary login
        auth.updateSessionConfig({
          refreshThreshold: 2, // Refresh 2 minutes before expiration
          checkInterval: 1, // Check every minute
          maxRefreshAttempts: 2
        });
      }

      const user = await auth.login({ email, password }, staySignedIn)
      if (import.meta.env.DEV) { console.log("Login successful:", user) }
      onSuccess?.(user)

      // Same-origin gate (#7 HIGH-1) — anything off-origin is dropped
      // silently rather than handing a phisher a live session.
      if (redirectUrl) {
        if (isSafeRedirect(redirectUrl)) {
          setTimeout(() => {
            window.location.href = redirectUrl
          }, 1000)
        } else if (import.meta.env.DEV) {
          console.warn(`[auth-components] Ignoring cross-origin redirectUrl: ${redirectUrl}`)
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Login failed"
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError("Please enter your email address")
      return
    }

    setIsLoading(true)
    setError("")
    setResetSuccess(false)

    try {
      const response = await auth.requestPasswordReset(email)
      if (import.meta.env.DEV) { console.log("Password reset requested:", response) }
      
      setResetSuccess(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset link"
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBackToLogin = () => {
    setView('login')
    setError("")
    setResetSuccess(false)
  }

  // Password Reset View
  if (view === 'passwordReset') {
    if (resetSuccess) {
      return (
        <Card className="w-full max-w-sm sm:max-w-md mx-auto border-none shadow-none">
          <CardHeader className="space-y-1 px-2 sm:px-6 pt-3 sm:pt-6">
            <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Check your inbox</CardTitle>
            <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
              A password reset link has been sent to your email address.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
            <Button onClick={handleBackToLogin} className="w-full h-9 sm:h-11 text-sm sm:text-base">
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      )
    }

    return (
      <Card className="w-full max-w-sm sm:max-w-md mx-auto border-none shadow-none">
        <CardHeader className="space-y-1 px-2 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Reset your password</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
            Enter your email to receive a password reset link
          </CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordReset}>
          <CardContent className="space-y-2 sm:space-y-4 px-2 sm:px-6">
            {error && (
              <div className="p-2 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}
            
            <div className="space-y-1 mb-4">
              <Label htmlFor="resetEmail" className="text-xs sm:text-sm lg:text-base">Email</Label>
              <Input 
                id="resetEmail" 
                name="email" 
                type="email" 
                placeholder="john.doe@example.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
                disabled={isLoading}
                className="h-9 sm:h-11 text-base sm:text-base"
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
            <Button type="submit" className="w-full h-9 sm:h-11 text-sm sm:text-base" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
            <p className="text-xs sm:text-sm text-center text-muted-foreground">
              Remember your password?{" "}
              <button 
                type="button"
                onClick={handleBackToLogin}
                className="text-primary hover:underline font-medium"
              >
                Back to Login
              </button>
            </p>
          </CardFooter>
        </form>
      </Card>
    )
  }

  // Login View
  return (
    <Card className="w-full max-w-sm sm:max-w-md mx-auto border-none shadow-none">
      <CardHeader className="space-y-1 px-2 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Welcome Back</CardTitle>
        <CardDescription className="text-center text-xs sm:text-sm lg:text-base">Enter your credentials to access your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-2 sm:space-y-4 px-2 sm:px-6">
          {error && (
            <div className="p-2 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          {/* SSO Buttons - Moved above form for better visibility */}
          <div className="space-y-3">
            <OAuthButtons type="login" onError={setError} onSuccess={onSuccess} staySignedIn={staySignedIn} />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs sm:text-sm">
                <span className="bg-white px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs sm:text-sm lg:text-base">Email</Label>
            <Input 
              id="email" 
              name="email" 
              type="email" 
              placeholder="john.doe@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              disabled={isLoading}
              className="h-9 sm:h-11 text-base sm:text-base"
            />
          </div>

          <div className="space-y-1 mb-2 sm:mb-4">
            <Label htmlFor="password" className="text-xs sm:text-sm lg:text-base">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-9 sm:h-11 text-base sm:text-base pr-10 sm:pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2 py-1 sm:px-3 sm:py-2 hover:bg-transparent min-h-0"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
              </Button>
            </div>
          </div>

          {/* Stay signed in checkbox */}
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="staySignedIn"
              checked={staySignedIn}
              onCheckedChange={(checked) => setStaySignedIn(checked as boolean)}
              disabled={isLoading}
            />
            <Label 
              htmlFor="staySignedIn" 
              className="text-xs sm:text-sm text-muted-foreground cursor-pointer"
            >
              Stay signed in
            </Label>
          </div>
          

        </CardContent>

        <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
          <Button type="submit" className="w-full h-9 sm:h-11 text-sm sm:text-base" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          <div className="w-full flex justify-between items-center text-xs sm:text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <button 
                type="button"
                onClick={onSwitchToRegister}
                className="text-primary hover:underline font-medium"
              >
                Create account
              </button>
            </p>
            <button 
              type="button"
              onClick={() => setView('passwordReset')}
              className="text-primary hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}