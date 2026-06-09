"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { auth } from "@/lib/auth"
import { isValidEmail } from "@/lib/utils"

interface PasswordResetFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  onSwitchToLogin?: () => void
}

export default function PasswordResetForm({ onSuccess, onError, onSwitchToLogin }: PasswordResetFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [email, setEmail] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      setError("Please enter your email address")
      return
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess(false)

    try {
      const response = await auth.requestPasswordReset(email)
      if (import.meta.env.DEV) { console.log("Password reset requested:", response) }
      
      setSuccess(true)
      onSuccess?.()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to send reset link"
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
          <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Check your inbox</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
            A password reset link has been sent to your email address.
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
        <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Reset your password</CardTitle>
        <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
          Enter your email to receive a password reset link
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-2 sm:space-y-4 px-2 sm:px-6">
          {error && (
            <div className="p-2 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <div className="space-y-1 mb-4">
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
