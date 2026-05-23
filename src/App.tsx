import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import LoginForm from "./components/LoginForm"
import RegistrationForm from "./components/RegistrationForm"
import PasswordResetForm from "./components/PasswordResetForm"
import ChangePasswordForm from "./components/ChangePasswordForm"
import EmailVerificationForm from "./components/EmailVerificationForm"
import AccountSettings from "./components/AccountSettings"
import AuthCallback from "./components/AuthCallback"
import { auth } from "./lib/auth"
import { useAuth } from "./lib/useAuth"
import type { User as UserType } from "./lib/auth"

type AuthView = "login" | "register" | "forgotPassword" | "changePassword" | "verifyEmail" | "accountSettings" | "authCallback"

function App() {
  const [view, setView] = useState<AuthView>("login")
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [isMockMode, setIsMockMode] = useState(false)

  const { user, logout, isLoading } = useAuth()

  // Read reset / verify tokens from the URL (#7 MED-5). Distinct param
  // names so they don't collide with the OAuth callback's ?token=
  // detection above.
  const resetToken = useMemo(
    () => new URLSearchParams(window.location.search).get("reset_token") ?? undefined,
    [],
  )
  const verifyToken = useMemo(
    () => new URLSearchParams(window.location.search).get("verify_token") ?? undefined,
    [],
  )

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('token')) {
      setView('authCallback');
    }
  }, []);

  // Check if we're in mock mode
  useEffect(() => {
    setIsMockMode(auth.isMockMode())
  }, [])

  const handleSuccess = (user: UserType) => {
    setSuccessMessage(`Welcome, ${user.firstName}! You have been successfully ${view === 'login' ? 'logged in' : 'registered'}.`)
    setErrorMessage("")
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
    } catch (error) {
      setErrorMessage("Logout failed")
    }
  }

  // Show authenticated user interface
  if (user) {
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

          {/* Authenticated User Info */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-blue-900">
                    {user.firstName} {user.lastName}
                  </h3>
                  <p className="text-sm text-blue-700">{user.email}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewChange("accountSettings")}
                    className="w-full"
                  >
                    Account Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewChange("changePassword")}
                    className="w-full"
                  >
                    Change Password
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleLogout}
                    disabled={isLoading}
                    className="w-full"
                  >
                    Sign Out
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings View */}
          {view === "accountSettings" && (
            <AccountSettings
              user={{
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                memberSince: "2024-01-15"
              }}
            />
          )}

          {/* Change Password Form */}
          {view === "changePassword" && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
                <ChangePasswordForm
                  onSuccess={() => {
                    setSuccessMessage("Your password has been successfully changed.")
                    setView("login")
                  }}
                  onError={handleError}
                  onSwitchToLogin={() => setView("login")}
                  token={resetToken}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    )
  }

  // Show authentication forms
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
        {view === "authCallback" && (
          <AuthCallback 
            onSuccess={() => setView('login')}
            onError={handleError} 
          />
        )}
      </div>
    </div>
  )
}

export default App
