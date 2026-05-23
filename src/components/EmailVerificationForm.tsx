"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, MailCheck } from "lucide-react"
import { auth } from "@/lib/auth"

interface EmailVerificationFormProps {
  onSuccess?: () => void
  onError?: (error: string) => void
  onSwitchToLogin?: () => void
  token?: string // Assuming a token will be passed for email verification
}

export default function EmailVerificationForm({ onSuccess, onError, onSwitchToLogin, token }: EmailVerificationFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      setError("Verification token is missing.")
      return
    }

    setIsLoading(true)
    setError("")
    setSuccess(false)

    try {
      const response = await auth.verifyEmail(token)
      if (import.meta.env.DEV) { console.log("Email verification response:", response) }
      
      setSuccess(true)
      onSuccess?.()

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Email verification failed"
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
          <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Email Verified!</CardTitle>
          <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
            Your email address has been successfully verified.
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
        
        <CardTitle className="text-base sm:text-xl lg:text-2xl font-bold text-center">Email Verification</CardTitle>
        <div className="flex justify-center mb-4">
          <MailCheck className="h-12 w-12 text-green-500" />
        </div>
        <CardDescription className="text-center text-xs sm:text-sm lg:text-base">
          Confirm your email address to continue.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleVerify}>
        <CardContent className="space-y-2 sm:space-y-4 px-2 sm:px-6">
          {error && (
            <div className="p-2 text-xs sm:text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-2 sm:space-y-4 px-2 sm:px-6 pb-3 sm:pb-6">
          <Button type="submit" className="w-full h-9 sm:h-11 text-sm sm:text-base" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
