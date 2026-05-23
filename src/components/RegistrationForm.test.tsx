import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/auth', () => ({
  auth: {
    signup: vi.fn(),
    initiateOAuth: vi.fn(),
    isMockMode: vi.fn().mockReturnValue(true),
  },
}))

import RegistrationForm from './RegistrationForm'
import { auth } from '@/lib/auth'

const mockAuth = auth as unknown as Record<string, ReturnType<typeof vi.fn>>

// Satisfies isPasswordMinimallyValid (>= 6 chars, no complexity rule).
// Used wherever we need the submit gate to open.
const VALID_PASSWORD = 'abcdef'

describe('RegistrationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.isMockMode.mockReturnValue(true)
  })

  it('renders all fields', () => {
    render(<RegistrationForm />)
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('disables submit when password is empty', () => {
    render(<RegistrationForm />)
    expect(screen.getByRole('button', { name: /create account/i })).toBeDisabled()
  })

  it('shows error when fields are blank', async () => {
    render(<RegistrationForm />)
    // Type a valid password so the submit gate opens — the other fields
    // are deliberately left blank to exercise the handler's
    // "fill in all fields" branch.
    await userEvent.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    const form = screen.getByRole('button', { name: /create account/i }).closest('form')!
    form.noValidate = true
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/fill in all fields/i)).toBeInTheDocument()
  })

  it('submits when all fields valid and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    mockAuth.signup.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      firstName: 'A',
      lastName: 'B',
      createdAt: 'x',
    })
    render(<RegistrationForm onSuccess={onSuccess} />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'A')
    await userEvent.type(screen.getByLabelText(/last name/i), 'B')
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(mockAuth.signup).toHaveBeenCalledWith({
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.com',
      password: VALID_PASSWORD,
    })
    expect(onSuccess).toHaveBeenCalled()
  })

  it('shows error on failure', async () => {
    const onError = vi.fn()
    mockAuth.signup.mockRejectedValue(new Error('Taken'))
    render(<RegistrationForm onError={onError} />)
    await userEvent.type(screen.getByLabelText(/first name/i), 'A')
    await userEvent.type(screen.getByLabelText(/last name/i), 'B')
    await userEvent.type(screen.getByLabelText(/email/i), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/^password$/i), VALID_PASSWORD)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText(/taken/i)).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith('Taken')
  })

  it('toggles password visibility', async () => {
    render(<RegistrationForm />)
    const input = screen.getByLabelText(/^password$/i) as HTMLInputElement
    expect(input.type).toBe('password')
    await userEvent.click(screen.getByRole('button', { name: /show password/i }))
    expect(input.type).toBe('text')
  })

  it('shows password strength indicator on typing', async () => {
    render(<RegistrationForm />)
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Abc123!@')
    expect(screen.getByText(/Strong|Good|Fair|Weak|Very/)).toBeInTheDocument()
  })

  it('calls onSwitchToLogin when clicked', async () => {
    const onSwitch = vi.fn()
    render(<RegistrationForm onSwitchToLogin={onSwitch} />)
    await userEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
    expect(onSwitch).toHaveBeenCalled()
  })
})
