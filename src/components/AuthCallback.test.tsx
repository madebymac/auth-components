import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AuthCallback from './AuthCallback'

const originalLocation = window.location

function setSearchParams(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      search,
      href: 'http://localhost/',
      pathname: '/',
    },
  })
}

describe('AuthCallback', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.textContent = ''
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    })
  })

  it('processes URL parameter token and stores session', async () => {
    vi.useFakeTimers()
    setSearchParams(
      '?token=abc&userId=1&email=a%40b.com&firstName=A&lastName=B&createdAt=2020-01-01'
    )

    render(<AuthCallback onSuccess={vi.fn()} onError={vi.fn()} />)

    await vi.waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('abc')
    })
    const user = JSON.parse(localStorage.getItem('auth_user')!)
    expect(user.email).toBe('a@b.com')
    expect(user.firstName).toBe('A')
    vi.useRealTimers()
  })

  it('exchanges oauth_code for a session and stores it', async () => {
    setSearchParams('?oauth_code=code-123')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          token: 'sess-tok',
          userId: '7',
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          staySignedIn: false,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    )

    render(<AuthCallback onSuccess={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => {
      expect(localStorage.getItem('auth_token')).toBe('sess-tok')
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ code: 'code-123' })

    const user = JSON.parse(localStorage.getItem('auth_user')!)
    expect(user.id).toBe('7')
    expect(user.email).toBe('a@b.com')
    expect(localStorage.getItem('auth_stay_signed_in')).toBe('false')
    expect(screen.getByText(/authentication successful/i)).toBeInTheDocument()
  })

  it('shows an error when the oauth_code exchange is rejected', async () => {
    setSearchParams('?oauth_code=stale')
    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('', { status: 400, statusText: 'Bad Request' })
    )

    render(<AuthCallback onSuccess={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    })
    expect(localStorage.getItem('auth_token')).toBeNull()
  })

  it('shows error when no data found', async () => {
    setSearchParams('')
    document.body.textContent = ''
    render(<AuthCallback onSuccess={vi.fn()} onError={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/no valid authentication data/i)).toBeInTheDocument()
  })

  it('clears storage on error', async () => {
    setSearchParams('')
    localStorage.setItem('auth_token', 'junk')
    render(<AuthCallback onSuccess={vi.fn()} onError={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/authentication failed/i)).toBeInTheDocument()
    })
    expect(localStorage.getItem('auth_token')).toBeNull()
  })
})
