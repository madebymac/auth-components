import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import api from './api'

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

function textResponse(text: string, init: ResponseInit = {}): Response {
  return new Response(text, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
    ...init,
  })
}

describe('api', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('login', () => {
    it('stores session and returns user on success', async () => {
      const user = {
        id: '1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        createdAt: '2020-01-01',
      }
      const session = { id: 's1', token: 'tok', expiresAt: '2099-01-01' }

      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, user, session }))
      )

      const result = await api.login({ email: 'a@b.com', password: 'pw' })
      expect(result).toEqual(user)
      expect(localStorage.getItem('auth_token')).toBe('tok')
      expect(localStorage.getItem('auth_user')).toBe(JSON.stringify(user))
      expect(localStorage.getItem('auth_session')).toBe(JSON.stringify(session))
      expect(localStorage.getItem('auth_stay_signed_in')).toBe('true')
    })

    it('passes staySignedIn=false through', async () => {
      const user = {
        id: '1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        createdAt: 'x',
      }
      const session = { id: 's1', token: 'tok', expiresAt: '2099-01-01' }
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, user, session }))
      )

      await api.login({ email: 'a@b.com', password: 'pw' }, false)
      expect(localStorage.getItem('auth_stay_signed_in')).toBe('false')
    })

    it('returns existing user when success but no session', async () => {
      const existingUser = {
        id: '1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        createdAt: 'x',
      }
      localStorage.setItem('auth_user', JSON.stringify(existingUser))
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      const result = await api.login({ email: 'a@b.com', password: 'pw' })
      expect(result).toEqual(existingUser)
    })

    it('throws when success but no session and no stored user', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      await expect(
        api.login({ email: 'a@b.com', password: 'pw' })
      ).rejects.toThrow(/no user data received/)
    })

    it('throws when server returns error', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false, error: 'Bad creds' }))
      )

      await expect(
        api.login({ email: 'a@b.com', password: 'pw' })
      ).rejects.toThrow(/Bad creds/)
    })

    it('throws with default message when no error provided', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false }))
      )

      await expect(
        api.login({ email: 'a@b.com', password: 'pw' })
      ).rejects.toThrow(/Login failed/)
    })
  })

  describe('signup', () => {
    it('stores session and returns user on success', async () => {
      const user = {
        id: '1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        createdAt: 'x',
      }
      const session = { id: 's1', token: 'tok', expiresAt: '2099-01-01' }

      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, user, session }))
      )

      const result = await api.signup({
        email: 'a@b.com',
        password: 'pw',
        firstName: 'A',
        lastName: 'B',
      })
      expect(result).toEqual(user)
      expect(localStorage.getItem('auth_token')).toBe('tok')
    })

    it('returns existing user when success but no session', async () => {
      const existingUser = {
        id: '1',
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
        createdAt: 'x',
      }
      localStorage.setItem('auth_user', JSON.stringify(existingUser))
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      const result = await api.signup({
        email: 'a@b.com',
        password: 'pw',
        firstName: 'A',
        lastName: 'B',
      })
      expect(result).toEqual(existingUser)
    })

    it('throws when success but no session and no stored user', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      await expect(
        api.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow(/no user data received/)
    })

    it('throws when server returns error', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false, error: 'Signup failure' }))
      )

      await expect(
        api.signup({ email: 'a@b.com', password: 'pw', firstName: 'A', lastName: 'B' })
      ).rejects.toThrow(/Signup failure/)
    })
  })

  describe('logout', () => {
    it('posts to logout endpoint when token exists', async () => {
      localStorage.setItem('auth_token', 'tok')
      localStorage.setItem('auth_user', '{"x":1}')
      const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 200 })
      )

      await api.logout()
      expect(fetchMock).toHaveBeenCalledWith(
        `${ORIGIN}/auth/logout`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
        })
      )
      expect(localStorage.getItem('auth_token')).toBeNull()
      expect(localStorage.getItem('auth_user')).toBeNull()
    })

    it('skips fetch when no token present but still clears storage', async () => {
      localStorage.setItem('auth_user', '{"x":1}')
      const fetchMock = vi.spyOn(global, 'fetch')

      await api.logout()
      expect(fetchMock).not.toHaveBeenCalled()
      expect(localStorage.getItem('auth_user')).toBeNull()
    })

    it('tolerates fetch failures silently', async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network'))
      await expect(api.logout()).resolves.toBeUndefined()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })

  describe('requestPasswordReset', () => {
    it('returns data on success', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, message: 'Sent' }))
      )

      const res = await api.requestPasswordReset('a@b.com')
      expect(res.success).toBe(true)
    })

    it('throws on failure', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false, error: 'No user' }))
      )

      await expect(api.requestPasswordReset('a@b.com')).rejects.toThrow(/No user/)
    })
  })

  describe('changePassword', () => {
    it('returns data on success', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      const res = await api.changePassword('reset-token', 'newpass')
      expect(res.success).toBe(true)
    })

    it('throws on failure', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false }))
      )

      await expect(api.changePassword('x', 'y')).rejects.toThrow(
        /Failed to change password/
      )
    })
  })

  describe('verifyEmail', () => {
    it('returns data on success', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true }))
      )

      const res = await api.verifyEmail('tok')
      expect(res.success).toBe(true)
    })

    it('throws on failure', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: false, error: 'Bad token' }))
      )

      await expect(api.verifyEmail('tok')).rejects.toThrow(/Bad token/)
    })
  })

  describe('validateSession', () => {
    it('returns false when no token', async () => {
      const result = await api.validateSession()
      expect(result).toBe(false)
    })

    it('returns true when server validates session', async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: true })
      )
      expect(await api.validateSession()).toBe(true)
    })

    it('returns false when server returns success=false', async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: false })
      )
      expect(await api.validateSession()).toBe(false)
    })

    it('returns false when response not ok', async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 401 })
      )
      expect(await api.validateSession()).toBe(false)
    })

    it('returns false when fetch throws', async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('boom'))
      expect(await api.validateSession()).toBe(false)
    })
  })

  describe('validateSessionDetailed', () => {
    it("returns 'invalid' when no token", async () => {
      expect(await api.validateSessionDetailed()).toBe('invalid')
    })

    it("returns 'valid' when server validates session", async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: true })
      )
      expect(await api.validateSessionDetailed()).toBe('valid')
    })

    it("returns 'invalid' on 401", async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 401 })
      )
      expect(await api.validateSessionDetailed()).toBe('invalid')
    })

    it("returns 'unknown' on 5xx", async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 503 })
      )
      expect(await api.validateSessionDetailed()).toBe('unknown')
    })

    it("returns 'unknown' when fetch throws (network error)", async () => {
      localStorage.setItem('auth_token', 'tok')
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('boom'))
      expect(await api.validateSessionDetailed()).toBe('unknown')
    })
  })

  describe('getCSRFToken', () => {
    it('returns token on successful response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: true, token: 'abc123' })
      )
      expect(await api.getCSRFToken()).toBe('abc123')
    })

    it('throws when response not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 500, statusText: 'Internal Error' })
      )
      await expect(api.getCSRFToken()).rejects.toThrow(/Failed to get CSRF token/)
    })

    it('throws when response has no token', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: false, message: 'no-op' })
      )
      await expect(api.getCSRFToken()).rejects.toThrow(/Invalid CSRF token response/)
    })
  })

  describe('refreshSession', () => {
    it('returns false when no token', async () => {
      expect(await api.refreshSession()).toBe(false)
    })

    it('updates storage and returns true on success', async () => {
      localStorage.setItem('auth_token', 'old')
      const session = { id: 's1', token: 'new-tok', expiresAt: '2099-01-01' }
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ success: true, session })
      )
      expect(await api.refreshSession()).toBe(true)
      expect(localStorage.getItem('auth_token')).toBe('new-tok')
      expect(JSON.parse(localStorage.getItem('auth_session')!)).toEqual(session)
    })

    it('returns false when response not ok', async () => {
      localStorage.setItem('auth_token', 'old')
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 401 })
      )
      expect(await api.refreshSession()).toBe(false)
    })

    it('returns false when success but no session', async () => {
      localStorage.setItem('auth_token', 'old')
      vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ success: true }))
      expect(await api.refreshSession()).toBe(false)
    })

    it('returns false when fetch throws', async () => {
      localStorage.setItem('auth_token', 'old')
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('boom'))
      expect(await api.refreshSession()).toBe(false)
    })
  })

  describe('initiateOAuth', () => {
    it('returns url on success', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        jsonResponse({ url: 'https://example.com/oauth' })
      )
      const result = await api.initiateOAuth('google', true, 'https://app/callback')
      expect(result.url).toBe('https://example.com/oauth')
    })

    it('throws when response not ok', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(
        new Response('', { status: 500, statusText: 'Server Error' })
      )
      await expect(
        api.initiateOAuth('google', true, 'https://app/callback')
      ).rejects.toThrow(/Failed to initiate OAuth/)
    })

    it('throws clear error for non-JSON body', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(textResponse('OK'))
      await expect(
        api.initiateOAuth('google', true, 'https://app/callback')
      ).rejects.toThrow(/non-JSON response/)
    })

    it('throws when no url in response', async () => {
      vi.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({}))
      await expect(
        api.initiateOAuth('google', true, 'https://app/callback')
      ).rejects.toThrow(/missing redirect url/)
    })
  })

  describe('stripe', () => {
    describe('createCheckoutSession', () => {
      it('throws when not authenticated', async () => {
        await expect(
          api.createCheckoutSession({
            priceId: 'price_123',
            successUrl: 'https://s',
            cancelUrl: 'https://c',
          })
        ).rejects.toThrow(/not authenticated/)
      })

      it('returns checkout response on success', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({ url: 'https://checkout', checkoutUrl: 'https://checkout' })
        )
        const res = await api.createCheckoutSession({
          priceId: 'price_123',
          successUrl: 'https://s',
          cancelUrl: 'https://c',
        })
        expect(res.url).toBe('https://checkout')
      })

      it('throws on non-ok response', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          new Response('nope', { status: 500, statusText: 'Server' })
        )
        await expect(
          api.createCheckoutSession({
            priceId: 'price',
            successUrl: 'https://s',
            cancelUrl: 'https://c',
          })
        ).rejects.toThrow(/Failed to create checkout session/)
      })
    })

    describe('createPortalSession', () => {
      it('throws when not authenticated', async () => {
        await expect(
          api.createPortalSession({ returnUrl: 'https://r' })
        ).rejects.toThrow(/not authenticated/)
      })

      it('returns mapped portal url on success', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({ success: true, portalUrl: 'https://portal' })
        )
        const res = await api.createPortalSession({ returnUrl: 'https://r' })
        expect(res.url).toBe('https://portal')
      })

      it('throws on non-ok response', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          new Response('nope', { status: 500, statusText: 'Server' })
        )
        await expect(
          api.createPortalSession({ returnUrl: 'https://r' })
        ).rejects.toThrow(/Failed to create portal session/)
      })
    })

    describe('getSubscriptionStatus', () => {
      it('throws when not authenticated', async () => {
        await expect(api.getSubscriptionStatus()).rejects.toThrow(/not authenticated/)
      })

      it('throws on non-ok response', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          new Response('nope', { status: 500, statusText: 'Server' })
        )
        await expect(api.getSubscriptionStatus()).rejects.toThrow(
          /Failed to get subscription status/
        )
      })

      it('maps standard status', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({
            success: true,
            subscription: { status: 'standard', currentPeriodEnd: '2099-01-01' },
          })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('standard')
        expect(res.status).toBe('standard')
        expect(res.nextBillingDate).toBe('2099-01-01')
      })

      it('maps past_due status to standard', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({
            success: true,
            subscription: { status: 'past_due' },
          })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('standard')
        expect(res.status).toBe('standard')
      })

      it('maps lifetime status', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({
            success: true,
            subscription: { status: 'lifetime' },
          })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('lifetime')
        expect(res.status).toBe('lifetime')
      })

      it('maps canceled status to cancelled/free plan', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({
            success: true,
            subscription: { status: 'canceled' },
          })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('free')
        expect(res.status).toBe('cancelled')
      })

      it('defaults to free for unknown status', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({
            success: true,
            subscription: { status: 'weird' },
          })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('free')
        expect(res.status).toBe('free')
      })

      it('returns free fallback when no subscription', async () => {
        localStorage.setItem('auth_token', 'tok')
        vi.spyOn(global, 'fetch').mockResolvedValue(
          jsonResponse({ success: true })
        )
        const res = await api.getSubscriptionStatus()
        expect(res.currentPlan).toBe('free')
        expect(res.status).toBe('free')
      })
    })
  })

  describe('makeAuthenticatedRequest (indirect)', () => {
    it('throws on non-ok response', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(
          new Response('', { status: 500, statusText: 'Server Error' })
        )
      )

      await expect(api.verifyEmail('tok')).rejects.toThrow(/Request failed/)
    })

    it('handles plain OK text response as success', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() => Promise.resolve(textResponse('OK')))
      // requestPasswordReset would hit this; but since success is true, it returns
      const res = await api.requestPasswordReset('a@b.com')
      expect(res.success).toBe(true)
    })

    it('throws on unknown non-JSON response body', async () => {
      const fetchMock = vi.spyOn(global, 'fetch')
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(jsonResponse({ success: true, token: 'csrf-token' }))
      )
      fetchMock.mockImplementationOnce(() =>
        Promise.resolve(textResponse('something weird'))
      )
      await expect(api.requestPasswordReset('a@b.com')).rejects.toThrow(
        /Unexpected response format/
      )
    })
  })
})
