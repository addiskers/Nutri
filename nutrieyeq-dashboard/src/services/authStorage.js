// Centralised auth token / user storage.
//
// Tokens live in sessionStorage (not localStorage) so they are scoped to a
// single tab and cleared on tab close. Combined with the strict CSP served
// by nginx this narrows the XSS blast radius — injected scripts can't
// execute, and even if they could, tokens don't persist across tabs.
//
// On first page load we migrate any pre-existing localStorage tokens into
// sessionStorage so active users aren't silently logged out.

const KEYS = ['access_token', 'refresh_token', 'user']

function migrateFromLocalStorage() {
  try {
    for (const key of KEYS) {
      const legacy = localStorage.getItem(key)
      if (legacy != null && sessionStorage.getItem(key) == null) {
        sessionStorage.setItem(key, legacy)
      }
      if (legacy != null) {
        localStorage.removeItem(key)
      }
    }
  } catch (e) {
    // sessionStorage / localStorage can be unavailable (private mode in some
    // browsers, disabled by policy, etc.). Auth will simply not persist.
    console.warn('[authStorage] migration skipped:', e)
  }
}

migrateFromLocalStorage()

export const authStorage = {
  getAccessToken() {
    try {
      return sessionStorage.getItem('access_token')
    } catch {
      return null
    }
  },
  getRefreshToken() {
    try {
      return sessionStorage.getItem('refresh_token')
    } catch {
      return null
    }
  },
  getUser() {
    try {
      const raw = sessionStorage.getItem('user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },
  setTokens({ access_token, refresh_token, user }) {
    try {
      if (access_token) sessionStorage.setItem('access_token', access_token)
      if (refresh_token) sessionStorage.setItem('refresh_token', refresh_token)
      if (user) sessionStorage.setItem('user', JSON.stringify(user))
    } catch (e) {
      console.warn('[authStorage] failed to persist tokens:', e)
    }
  },
  setUser(user) {
    try {
      sessionStorage.setItem('user', JSON.stringify(user))
    } catch (e) {
      console.warn('[authStorage] failed to persist user:', e)
    }
  },
  clear() {
    try {
      for (const key of KEYS) {
        sessionStorage.removeItem(key)
        localStorage.removeItem(key)
      }
    } catch (e) {
      console.warn('[authStorage] clear failed:', e)
    }
  },
}

export default authStorage
