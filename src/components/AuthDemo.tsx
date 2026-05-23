"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertTriangle, Clock, Shield, ShieldOff, LogOut } from "lucide-react"
import LoginForm from "./LoginForm"
import RegistrationForm from "./RegistrationForm"
import PasswordResetForm from "./PasswordResetForm"
import ChangePasswordForm from "./ChangePasswordForm"
import EmailVerificationForm from "./EmailVerificationForm"
import AccountSettings from "./AccountSettings"
import { auth } from "@/lib/auth"
import { useAuth } from "@/lib/useAuth"
import type { User } from "@/lib/auth"
import { getApiUrl } from "@/lib/utils"

type AuthView = "login" | "register" | "forgotPassword" | "changePassword" | "verifyEmail" | "accountSettings"

export default function AuthDemo() {
  const [view, setView] = useState<AuthView>("login")
  const [showDevButtons, setShowDevButtons] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isMockMode, setIsMockMode] = useState(false)
  const [timeUntilExpiration, setTimeUntilExpiration] = useState<string>("")
  const [isSessionExpiringSoon, setIsSessionExpiringSoon] = useState(false)
  const [isSignedIn, setIsSignedIn] = useState(false)

  // Read reset / verify tokens from the URL (#7 MED-5). Distinct param
  // names so they don't collide with the OAuth callback's ?token= flow.
  // No param → undefined → form's "token is required" error surfaces.
  const resetToken = useMemo(
    () => new URLSearchParams(window.location.search).get("reset_token") ?? undefined,
    [],
  )
  const verifyToken = useMemo(
    () => new URLSearchParams(window.location.search).get("verify_token") ?? undefined,
    [],
  )

  const { user, logout, isLoading } = useAuth()

  useEffect(() => {
    // Check if we're in mock mode
    setIsMockMode(auth.isMockMode())
  }, [])

  // Update session time display
  useEffect(() => {
    if (!user) return

    const updateTime = () => {
      setTimeUntilExpiration(auth.getFormattedTimeUntilExpiration())
      setIsSessionExpiringSoon(auth.isSessionExpiringSoon())
    }

    updateTime() // Initial update
    const interval = setInterval(updateTime, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [user])

  const handleSuccess = (user: User) => {
    setSuccessMessage(`Welcome, ${user.firstName}! You have been successfully ${view === 'login' ? 'logged in' : 'registered'}.`)
    setErrorMessage("")
    setIsSignedIn(true)
  }

  const handleError = (error: string) => {
    setErrorMessage(error)
    setSuccessMessage("")
  }

  const handleViewChange = (newView: AuthView) => {
    setView(newView)
    setSuccessMessage("")
    setErrorMessage("")
  }

  const handleLogout = async () => {
    try {
      await logout()
      setSuccessMessage("")
      setErrorMessage("")
      setIsSignedIn(false)
    } catch (error) {
      setErrorMessage("Logout failed")
    }
  }

  // Show authenticated user interface
  if (user || isSignedIn) {
    const isStaySignedIn = auth.isStaySignedInEnabled()
    const sessionConfig = auth.getSessionConfig()

    return (
      <div className="flex items-center justify-center p-4 bg-gray-50 py-8">
        <div className="w-full max-w-md space-y-4">
          {/* Mock Mode Warning */}
          {isMockMode && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 text-yellow-700">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">Development Mode</p>
                    <p className="text-xs text-yellow-600">
                      Using mock authentication. No real auth service is connected.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Success Message */}
          {successMessage && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">{successMessage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Session Status */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">
                      {user?.firstName || "John"} {user?.lastName || "Doe"}
                    </h3>
                    <p className="text-sm text-blue-700">{user?.email || "john.doe@example.com"}</p>
                  </div>
                  <div className="flex items-center space-x-1 text-xs">
                    {isStaySignedIn ? (
                      <>
                        <Shield className="h-3 w-3 text-blue-600" />
                        <span className="text-blue-700">Persistent</span>
                      </>
                    ) : (
                      <>
                        <ShieldOff className="h-3 w-3 text-blue-600" />
                        <span className="text-blue-700">Temporary</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Session Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-700">Session expires in:</span>
                    <span className={`font-medium ${isSessionExpiringSoon ? 'text-orange-600' : 'text-blue-900'}`}>
                      {timeUntilExpiration || "2 hours 30 minutes"}
                    </span>
                  </div>

                  {isSessionExpiringSoon && (
                    <div className="flex items-center space-x-2 text-orange-600 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>Session will refresh automatically soon</span>
                    </div>
                  )}

                  {/* Session Configuration Info */}
                  <div className="text-xs text-blue-600 space-y-1">
                    <div>Refresh threshold: {sessionConfig.refreshThreshold} minutes</div>
                    <div>Check interval: {sessionConfig.checkInterval} minute{sessionConfig.checkInterval !== 1 ? 's' : ''}</div>
                    <div>Max refresh attempts: {sessionConfig.maxRefreshAttempts}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSignedIn(false)}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Switch to Not Signed In
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Show login/register forms
  return (
    <div className="flex items-center justify-center p-4 bg-gray-50 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Mock Mode Warning */}
        {isMockMode && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-yellow-700">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="text-sm font-medium">Development Mode</p>
                  <p className="text-xs text-yellow-600">
                    Using mock authentication. No real auth service is connected.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success/Error Messages */}
        {successMessage && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{successMessage}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {errorMessage && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-700">
                <XCircle className="h-5 w-5" />
                <p className="text-sm font-medium">{errorMessage}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dev Buttons */}
        <div className="flex justify-center mb-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowDevButtons(!showDevButtons)}
          >
            {showDevButtons ? "Hide Dev Buttons" : "Show Dev Buttons"}
          </Button>
        </div>

        {showDevButtons && (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-6 flex flex-wrap gap-2 justify-center">
              <Button onClick={() => handleViewChange("login")} size="sm">Login</Button>
              <Button onClick={() => handleViewChange("register")} size="sm">Register</Button>
              <Button onClick={() => handleViewChange("forgotPassword")} size="sm">Forgot Password</Button>
              <Button onClick={() => handleViewChange("changePassword")} size="sm">Change Password</Button>
              <Button onClick={() => handleViewChange("verifyEmail")} size="sm">Verify Email</Button>
              <Button onClick={() => handleViewChange("accountSettings")} size="sm">Account Settings</Button>
            </CardContent>
          </Card>
        )}

        {/* Auth Form */}
        {view === "login" && (
          <LoginForm 
            onSuccess={handleSuccess}
            onError={handleError}
            onSwitchToRegister={() => handleViewChange("register")}
          />
        )}
        {view === "register" && (
          <RegistrationForm 
            onSuccess={handleSuccess}
            onError={handleError}
            onSwitchToLogin={() => handleViewChange("login")}
          />
        )}
        {view === "forgotPassword" && (
          <PasswordResetForm 
            onSuccess={() => {
              setSuccessMessage("A password reset link has been sent to your email.")
              setView("login")
            }}
            onError={handleError}
            onSwitchToLogin={() => handleViewChange("login")}
          />
        )}
        {view === "changePassword" && (
          <ChangePasswordForm
            onSuccess={() => {
              setSuccessMessage("Your password has been successfully changed.")
              setView("login")
            }}
            onError={handleError}
            onSwitchToLogin={() => handleViewChange("login")}
            token={resetToken}
          />
        )}
        {view === "verifyEmail" && (
          <EmailVerificationForm
            onSuccess={() => {
              setSuccessMessage("Your email has been successfully verified.")
              setView("login")
            }}
            onError={handleError}
            onSwitchToLogin={() => handleViewChange("login")}
            token={verifyToken}
          />
        )}
        {view === "accountSettings" && (
          <AccountSettings
            user={{
              email: "john.doe@example.com",
              firstName: "John",
              lastName: "Doe",
              memberSince: "2024-01-15"
            }}
            successRedirectUrl={`${getApiUrl()}?status=success`}
            cancelRedirectUrl={`${getApiUrl()}?status=cancelled`}
            returnRedirectUrl={getApiUrl()}
            priceId={import.meta.env.VITE_STRIPE_PRICE_ID || 'fallback_price_id'}
            monthlyPriceId={import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID}
            lifetimePriceId={import.meta.env.VITE_STRIPE_LIFETIME_PRICE_ID}
          />
        )}
      </div>
    </div>
  )
}