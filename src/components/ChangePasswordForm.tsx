"use client"

import type React from "react"
import { useState, useMemo } from "react"
import { isPasswordMinimallyValid, validatePassword } from "@/lib/utils"
import { PasswordStrengthIndicator } from "./ui/password-strength-indicator"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { auth } from "@/lib/auth"

interface ChangePasswordFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  onSwitchToLogin?: () => void
  token?: string // Assuming a token will be passed for password reset
}

export default function ChangePasswordForm({ onSuccess, onError, onSwitchToLogin, token }: ChangePasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [success, setSuccess] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Calculate password strength whenever newPassword changes
  const passwordStrength = useMemo(() => {
    return validatePassword(newPassword)
  }, [newPassword])

  // Submit is gated on the same "8 chars + 2-of-4 complexity" rule that
  // RegistrationForm uses (#7 HIGH-8). The strength indicator above is
  // informational only; the gate is what actually keeps weak passwords
  // out of the authenticated-reset path.
  const isFormValid = useMemo(() => {
    return !!newPassword &&
           !!confirmPassword &&
           newPassword === confirmPassword &&
           isPasswordMinimallyValid(newPassword)
  }, [newPassword, confirmPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }



    if (!token) {
      setError("Reset token is required")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess(false)

    try {
      const response = await auth.changePassword(token, newPassword)
      console.log("Password change response:", response)
      
      setSuccess(true)
      onSuccess?.()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to change password"
      setError(errorMessage)
      onError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm sm:max-w-md mx-auto border-none shadow-none">
        <CardHeader className="space-y-1 px-2 sm:px-6 pt-3 sm:pt-6">
          <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Password Changed</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
            Your password has been successfully updated.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
          <Button onClick={onSwitchToLogin} className="w-full h-9 sm:h-11 text-sm sm:text-base">
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm sm:max-w-md mx-auto border-none shadow-none">
      <CardHeader className="space-y-1 px-2 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Set New Password</CardTitle>
        <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
          Enter your new password below
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-2 sm:space-y-4 px-2 sm:px-6">
          {error && (
            <div className="p-2 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <div className="space-y-1">
            <Label htmlFor="newPassword" className="text-xs sm:text-sm lg:text-base">New Password</Label>
            <div className="relative">
              <Input 
                id="newPassword" 
                name="newPassword" 
                type={showNewPassword ? "text" : "password"} 
                placeholder="Enter new password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required 
                disabled={isLoading}
                className="h-9 sm:h-11 text-base sm:text-base pr-10 sm:pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2 py-1 sm:px-3 sm:py-2 hover:bg-transparent min-h-0"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={isLoading}
              >
                {showNewPassword ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="sr-only">{showNewPassword ? "Hide password" : "Show password"}</span>
              </Button>
            </div>
            {/* Ultra-compact password strength indicator on mobile */}
            {newPassword && (
              <div className="mt-1 sm:mt-3 p-1.5 sm:p-3 bg-gray-50 rounded-md border">
                <PasswordStrengthIndicator strength={passwordStrength} compact={true} />
              </div>
            )}
          </div>

          <div className="space-y-1 mb-4">
            <Label htmlFor="confirmPassword" className="text-xs sm:text-sm lg:text-base">Confirm New Password</Label>
            <div className="relative">
              <Input 
                id="confirmPassword" 
                name="confirmPassword" 
                type={showConfirmPassword ? "text" : "password"} 
                placeholder="Confirm new password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required 
                disabled={isLoading}
                className="h-9 sm:h-11 text-base sm:text-base pr-10 sm:pr-12"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-2 py-1 sm:px-3 sm:py-2 hover:bg-transparent min-h-0"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
                <span className="sr-only">{showConfirmPassword ? "Hide password" : "Show password"}</span>
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
          <Button type="submit" className="w-full h-9 sm:h-11 text-sm sm:text-base" disabled={isLoading || !isFormValid}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                Changing Password...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
          <p className="text-xs sm:text-sm text-center text-muted-foreground">
            Remember your password?{" "}
            <button 
              type="button"
              onClick={onSwitchToLogin}
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
