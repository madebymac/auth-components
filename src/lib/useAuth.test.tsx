import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('./api', () => {
  const mock = {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn(),
    changePassword: vi.fn(),
    verifyEmail: vi.fn(),
    validateSession: vi.fn().mockResolvedValue(true),
    getCSRFToken: vi.fn().mockResolvedValue('csrf'),
    refreshSession: vi.fn(),
    initiateOAuth: vi.fn(),
  }
  return { default: mock, ...mock }
})

import { useAuth } from './useAuth'
import { auth } from './auth'

function setHostname(hostname: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hostname, origin: `https://${hostname}` },
  })
}

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    setHostname('localhost')
  })

  afterEach(() => {
    auth.cleanup()
  })

  it('returns initial unauthenticated state', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns authenticated state when storage has token and user', async () => {
    const user = { id: '1', email: 'a@b.com', firstName: 'A', lastName: 'B', createdAt: 'x' }
    localStorage.setItem('auth_token', 'tok')
    localStorage.setItem('auth_user', JSON.stringify(user))

    const { result } = renderHook(() => useAuth())
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user).toEqual(user)
    })
  })

  it('login sets state on success (mock mode)', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.login('a@b.com', 'pw')
    })
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.email).toBe('a@b.com')
    })
  })

  it('login sets error on failure', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      try {
        await result.current.login('', 'pw')
      } catch {
        /* expected */
      }
    })
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })

  it('signup sets state on success (mock mode)', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      await result.current.signup('a@b.com', 'pw', 'A', 'B')
    })
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true)
      expect(result.current.user?.firstName).toBe('A')
    })
  })

  it('signup sets error on failure', async () => {
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      try {
        await result.current.signup('', '', '', '')
      } catch {
        /* expected */
      }
    })
    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })

  it('logout clears state', async () => {
    const { result } = renderHook(() => useAuth())
    // First login
    await act(async () => {
      await result.current.login('a@b.com', 'pw')
    })
    expect(result.current.isAuthenticated).toBe(true)

    await act(async () => {
      await result.current.logout()
    })
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false)
      expect(result.current.user).toBeNull()
    })
  })

  it('refreshSession returns boolean from validateSession', async () => {
    localStorage.setItem('auth_token', 'x')
    const { result } = renderHook(() => useAuth())
    let valid: boolean | undefined
    await act(async () => {
      valid = await result.current.refreshSession()
    })
    expect(typeof valid).toBe('boolean')
  })

  it('updateSessionConfig and getSessionConfig proxy to auth', () => {
    const { result } = renderHook(() => useAuth())
    result.current.updateSessionConfig({ refreshThreshold: 42 })
    expect(result.current.getSessionConfig().refreshThreshold).toBe(42)
    // restore
    result.current.updateSessionConfig({ refreshThreshold: 5 })
  })

  it('reacts to the auth:session-expired event emitted by AuthClient', async () => {
    // Pre-#7 HIGH-7 the listener was on 'sessionExpired' but the emitter
    // (auth.ts) dispatches 'auth:session-expired' — so the handler never
    // fired in real flows. The previous version of this test happened to
    // dispatch the same misspelled name as the listener and so passed
    // while users saw nothing on session expiry. Pin the actual contract.
    const { result } = renderHook(() => useAuth())
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:session-expired'))
    })
    await waitFor(() => {
      expect(result.current.error).toMatch(/expired/i)
    })
  })
})
