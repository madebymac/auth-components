# Auth Components Library

A React component library for authentication forms that connects to the centralized auth service.

## Features

- 🔐 **Login Form** - User authentication with email/password
- 📝 **Registration Form** - User registration with validation
- 🎨 **shadcn/ui Styled** - Beautiful, accessible UI components
- 🔒 **CSRF Protection** - Built-in CSRF token handling
- 📱 **Responsive Design** - Works on all device sizes
- ⚡ **TypeScript** - Full type safety
- 🎯 **Auth Service Integration** - Connects to centralized auth service
- 🧪 **Mock Mode** - Development mode with mock authentication

## Installation

### For Library Consumers

```bash
npm install auth-components
```

**Peer Dependencies:**
This library requires React 18+ and React DOM 18+ as peer dependencies. Make sure you have them installed:

```bash
npm install react react-dom
```

### Using as Git Submodule (Development)

If you want to use this library directly from source during development:

#### 1. Add as a submodule to your project:

```bash
# In your frontend project directory
git submodule add <auth-components-repo-url> auth-components
git submodule update --init --recursive

# Install the submodule's dependencies. node_modules/ is no longer
# committed (every package would otherwise bypass npm's package-lock
# integrity checks); `npm ci` produces a reproducible tree from the
# committed package-lock.json.
cd auth-components && npm ci && cd ..
```

#### 2. Import components directly from source:

```tsx
// Import from the submodule source
import { LoginForm, RegistrationForm, auth } from '../auth-components/src'
// or
import { LoginForm, RegistrationForm, auth } from './auth-components/src'
```

#### 3. Update the submodule when changes are made:

```bash
# Pull latest changes from the auth-components repo
git submodule update --remote auth-components

# Or go into the submodule and pull manually
cd auth-components
git pull origin main
cd ..
git add auth-components
git commit -m "Update auth-components submodule"
```

#### 4. Clone a project with submodules:

```bash
# Clone the main project
git clone <your-project-url>
# Initialize and update submodules
git submodule update --init --recursive
```

**Note:** When using as a submodule, you'll need to ensure your project can handle TypeScript compilation and that React versions are compatible.

### For Library Development

```bash
git clone <repository-url>
cd auth-components
npm install
```

## Quick Start

### Basic Usage

```tsx
import { LoginForm, RegistrationForm, AuthDemo } from 'auth-components'

// Use the demo component (recommended for testing)
function App() {
  return <AuthDemo />
}

// Or use individual forms
function LoginPage() {
  const handleSuccess = (user) => {
    console.log('User logged in:', user)
    // Redirect or update app state
  }

  const handleError = (error) => {
    console.error('Login failed:', error)
    // Show error message
  }

  return (
    <LoginForm 
      onSuccess={handleSuccess}
      onError={handleError}
      redirectUrl="/dashboard"
    />
  )
}
```

### Individual Component Imports

You can also import specific components or utilities:

```tsx
// Import specific components
import { LoginForm } from 'auth-components/login'
import { RegistrationForm } from 'auth-components/register'

// Import auth utilities
import { auth } from 'auth-components/auth'

// Import UI components
import { Button, Card, Input } from 'auth-components'
```

### Auth Utilities Usage

```tsx
import { auth } from 'auth-components'

// Check if user is authenticated
const isLoggedIn = auth.isAuthenticated()

// Get current user
const user = auth.getCurrentUser()

// Manual login
try {
  const user = await auth.login({ email: 'user@example.com', password: 'password' })
  console.log('Logged in:', user)
} catch (error) {
  console.error('Login failed:', error)
}

// Manual registration
try {
  const user = await auth.signup({ 
    email: 'user@example.com', 
    password: 'password',
    firstName: 'John',
    lastName: 'Doe'
  })
  console.log('Registered:', user)
} catch (error) {
  console.error('Registration failed:', error)
}

// Logout
await auth.logout()

// Validate session
const isValid = await auth.validateSession()

// Check if in mock mode
const isMock = auth.isMockMode()
```

## Components

### LoginForm

A complete login form with email and password fields.

```tsx
import { LoginForm } from 'auth-components'

<LoginForm 
  onSuccess={(user) => console.log('Logged in:', user)}
  onError={(error) => console.error('Login failed:', error)}
  redirectUrl="/dashboard"
/>
```

**Props:**
- `onSuccess?: (user: User) => void` - Called when login is successful
- `onError?: (error: string) => void` - Called when login fails
- `redirectUrl?: string` - URL to redirect to after successful login

### RegistrationForm

A complete registration form with validation.

```tsx
import { RegistrationForm } from 'auth-components'

<RegistrationForm 
  onSuccess={(user) => console.log('Registered:', user)}
  onError={(error) => console.error('Registration failed:', error)}
  redirectUrl="/welcome"
/>
```

**Props:**
- `onSuccess?: (user: User) => void` - Called when registration is successful
- `onError?: (error: string) => void` - Called when registration fails
- `redirectUrl?: string` - URL to redirect to after successful registration

### AuthDemo

A demo component that switches between login and registration forms.

```tsx
import { AuthDemo } from 'auth-components'

<AuthDemo />
```

## Configuration

The auth components automatically connect to the auth service running on your domain at `/auth`. No environment variables are required.

### Development Mode

When running locally without an auth service, the components automatically use mock authentication:

- ✅ Show a "Development Mode" warning
- ✅ Use mock data for authentication
- ✅ Simulate network delays
- ✅ Store mock sessions in localStorage
- ✅ Allow full UI testing

## Auth Service Integration

The components automatically connect to the auth service running on your domain at `/auth`. The auth service provides these endpoints:

- `POST /auth/login` - User authentication
- `POST /auth/signup` - User registration  
- `POST /auth/logout` - Session termination
- `GET /auth/session` - Session validation
- `GET /auth/csrf-token` - CSRF token generation
- `GET /auth/health` - Service health check

### CSRF Protection

The components automatically handle CSRF tokens for security. The auth client will:
1. Fetch a CSRF token before form submission
2. Include the token in login/registration requests
3. Clear the token on logout

### Session Management

The auth client manages sessions using localStorage:
- Stores session tokens securely
- Validates sessions automatically
- Clears invalid sessions
- Provides session status utilities

## Development

### Running the Demo

```bash
npm run dev
```

This will start the development server with the AuthDemo component in mock mode.

### Building

```bash
npm run build
```

### Mock Mode Features

When running in development without an auth service:

- ✅ **Automatic Detection** - Detects when no auth service is available
- ✅ **Mock Data** - Generates realistic user and session data
- ✅ **Network Simulation** - Simulates 1-second network delays
- ✅ **Validation** - Performs client-side validation
- ✅ **localStorage** - Stores mock sessions for testing
- ✅ **Console Logging** - Logs mock operations for debugging
- ✅ **Visual Indicators** - Shows "Development Mode" warning

### Testing

The components are designed to work with the auth service. For local development, you can:

1. **Use Mock Mode** (recommended) - Test UI without auth service
2. **Test in Production** - Deploy and test with real auth service

### Troubleshooting

**"Unexpected token '<', "<!doctype "... is not valid JSON"**

This error occurs when the auth service isn't running or accessible. The components now automatically fall back to mock mode in development.

**Mock Mode Not Working**

1. **Check console** for mock mode detection
2. **Verify environment** - should be development mode
3. **Check base URL** - should not contain 'http' for mock mode

## Types

```tsx
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
}

interface Session {
  id: string
  token: string
  expiresAt: string
}

interface LoginData {
  email: string
  password: string
}

interface SignupData {
  email: string
  password: string
  firstName: string
  lastName: string
}
```

## Error Handling

The components handle various error scenarios:

- **Validation Errors** - Password length, email format, required fields
- **Network Errors** - Connection issues, timeouts
- **Auth Service Errors** - User already exists, invalid credentials
- **CSRF Errors** - Invalid or expired tokens

All errors are displayed to the user and passed to the `onError` callback.

## Security Features

- ✅ CSRF token protection
- ✅ Password validation (minimum 8 characters + 2 complexity requirements)
- ✅ Password strength grading (12 characters + 4 complexity requirements)
- ✅ Secure session management
- ✅ Input sanitization
- ✅ Rate limiting (handled by auth service)
- ✅ Secure headers (handled by auth service)

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

MIT
