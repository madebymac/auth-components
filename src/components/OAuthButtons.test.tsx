import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/auth', () => ({
  auth: {
    initiateOAuth: vi.fn(),
    isMockMode: vi.fn(),
  },
}))

import OAuthButtons from './OAuthButtons'
import { auth } from '@/lib/auth'

const mockAuth = auth as unknown as Record<string, ReturnType<typeof vi.fn>>

describe('OAuthButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders login button text', () => {
    mockAuth.isMockMode.mockReturnValue(true)
    render(<OAuthButtons type="login" />)
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('renders signup button text', () => {
    mockAuth.isMockMode.mockReturnValue(true)
    render(<OAuthButtons type="signup" />)
    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument()
  })

  it('creates mock user and calls onSuccess when in mock mode', async () => {
    mockAuth.isMockMode.mockReturnValue(true)
    const onSuccess = vi.fn()
    render(<OAuthButtons type="login" onSuccess={onSuccess} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onSuccess).toHaveBeenCalled()
    expect(localStorage.getItem('auth_token')).toMatch(/^mock-oauth-token-\d+$/)
  })

  it('calls auth.initiateOAuth when not mock mode', async () => {
    mockAuth.isMockMode.mockReturnValue(false)
    mockAuth.initiateOAuth.mockResolvedValue(undefined)
    render(<OAuthButtons type="login" staySignedIn={false} />)
    await userEvent.click(screen.getByRole('button'))
    expect(mockAuth.initiateOAuth).toHaveBeenCalledWith(
      'google',
      false,
      expect.stringContaining('/auth/callback')
    )
  })

  it('calls onError when auth.initiateOAuth fails', async () => {
    mockAuth.isMockMode.mockReturnValue(false)
    mockAuth.initiateOAuth.mockRejectedValue(new Error('Denied'))
    const onError = vi.fn()
    render(<OAuthButtons type="login" onError={onError} />)
    await userEvent.click(screen.getByRole('button'))
    await new Promise((r) => setTimeout(r, 0))
    expect(onError).toHaveBeenCalledWith('Denied')
  })

  it('uses signup error message for signup flow on failure', async () => {
    mockAuth.isMockMode.mockReturnValue(false)
    mockAuth.initiateOAuth.mockRejectedValue(undefined)
    const onError = vi.fn()
    render(<OAuthButtons type="signup" onError={onError} />)
    await userEvent.click(screen.getByRole('button'))
    await new Promise((r) => setTimeout(r, 0))
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('sign up'))
  })
})
