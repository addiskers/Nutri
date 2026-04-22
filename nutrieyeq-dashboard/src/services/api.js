const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const getToken = () => sessionStorage.getItem('access_token')

export function clearAuthData() {
  sessionStorage.removeItem('access_token')
  sessionStorage.removeItem('refresh_token')
  sessionStorage.removeItem('user')
}

function storeAuthData(data) {
  sessionStorage.setItem('access_token', data.access_token)
  sessionStorage.setItem('refresh_token', data.refresh_token)
  if (data.user) sessionStorage.setItem('user', JSON.stringify(data.user))
}

function safeParseUser() {
  try {
    const raw = sessionStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    sessionStorage.removeItem('user')
    return null
  }
}

function sanitizeError(detail, fallback = 'Request failed') {
  if (!detail) return fallback
  if (typeof detail === 'string') {
    if (/traceback|stack|exception|internal server/i.test(detail)) return fallback
    return detail
  }
  if (Array.isArray(detail)) {
    return detail.map(d => d?.msg || d?.message || fallback).join('; ')
  }
  return fallback
}

const DEFAULT_TIMEOUT_MS = 30000

function withTimeout(options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  if (options.signal) return options
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return { ...options, signal: controller.signal }
}

async function unauthenticatedRequest(endpoint, options = {}) {
  return fetch(`${API_BASE_URL}${endpoint}`, withTimeout({
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  }))
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, withTimeout(config))
    
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${getToken()}`
        return fetch(`${API_BASE_URL}${endpoint}`, withTimeout(config))
      } else {
        clearAuthData()
        window.location.href = '/login'
        throw new Error('Session expired. Please login again.')
      }
    }
    
    return response
  } catch (error) {
    throw error
  }
}

async function apiUpload(endpoint, formData) {
  const token = getToken()
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, withTimeout({
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: formData
  }, 120000))

  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      return fetch(`${API_BASE_URL}${endpoint}`, withTimeout({
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}` },
        body: formData
      }, 120000))
    } else {
      clearAuthData()
      window.location.href = '/login'
      throw new Error('Session expired. Please login again.')
    }
  }

  return response
}

let _refreshPromise = null

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = (async () => {
    const refreshToken = sessionStorage.getItem('refresh_token')
    if (!refreshToken) return false

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      })

      if (response.ok) {
        const data = await response.json()
        storeAuthData(data)
        return true
      }
    } catch {
      // refresh failed
    }

    return false
  })()

  try {
    return await _refreshPromise
  } finally {
    _refreshPromise = null
  }
}

export const productService = {
  async extractFromImages(images) {
    try {
      const formData = new FormData()
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        
        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          formData.append('images', blob, `image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          formData.append('images', image, `image_${i}.jpg`)
        }
      }
      
      const response = await apiUpload('/products/extract', formData)
      const result = await response.json()
      
      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'Extraction failed'),
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error during extraction'
      }
    }
  },
  
  /**
   * Create a new product
   */
  async createProduct(productData) {
    try {
      const response = await apiRequest('/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'Failed to create product')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },
  
  /**
   * Get all products
   */
  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.category) queryParams.append('category', params.category)
      if (params.status) queryParams.append('status', params.status)
      if (params.search) queryParams.append('search', params.search)

      const response = await apiRequest(`/products?${queryParams.toString()}`)

      if (response.ok) {
        return await response.json()
      } else {
        console.error('API response not OK:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      throw error
    }
  },

  /**
   * Get dashboard stats (counts + recent products + category breakdown)
   */
  async getDashboardStats() {
    try {
      const response = await apiRequest('/products/stats')
      if (response.ok) return await response.json()
      throw new Error(`Failed to fetch stats: ${response.statusText}`)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      throw error
    }
  },

  /**
   * Get single product
   */
  async getProduct(id) {
    try {
      const response = await apiRequest(`/products/${id}`)
      
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('Failed to fetch product:', error)
      return null
    }
  },
  
  /**
   * Update product
   */
  async updateProduct(id, productData) {
    try {
      const response = await apiRequest(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to update product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },
  
  /**
   * Delete product
   */
  async deleteProduct(id) {
    try {
      const response = await apiRequest(`/products/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to delete product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

// Authentication Service
export const authService = {
  /**
   * Register new user with email/password
   */
  async register(name, email, password, department) {
    try {
      const response = await unauthenticatedRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, department })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'Registration failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Login with email/password (sends OTP)
   */
  async login(email, password) {
    try {
      const response = await unauthenticatedRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        if (result.success === false) {
          return { success: false, error: result.message || 'Login failed' }
        }
        return { success: true, message: result.message }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'Login failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Verify login OTP
   */
  async verifyLoginOtp(email, otp) {
    try {
      const response = await unauthenticatedRequest('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        storeAuthData(result)
        return { success: true, user: result.user }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'OTP verification failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Request password reset OTP
   */
  async forgotPassword(email) {
    try {
      const response = await unauthenticatedRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'Request failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Reset password with OTP
   */
  async resetPassword(email, otp, newPassword) {
    try {
      const response = await unauthenticatedRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp, new_password: newPassword })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'Password reset failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Change password (authenticated user)
   */
  async changePassword(currentPassword, newPassword) {
    try {
      const response = await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: sanitizeError(result.detail, 'Password change failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Get current user info
   */
  async getCurrentUserInfo() {
    try {
      const response = await apiRequest('/auth/me', { method: 'GET' })
      
      if (response.ok) {
        const user = await response.json()
        sessionStorage.setItem('user', JSON.stringify(user))
        return user
      }
    } catch {
      // silently fail
    }
    return null
  },

  async refreshUserData() {
    try {
      if (!getToken()) return null

      const response = await apiRequest('/auth/me', { method: 'GET' })

      if (response.ok) {
        const user = await response.json()
        sessionStorage.setItem('user', JSON.stringify(user))
        window.location.reload()
        return user
      }
    } catch {
      // silently fail
    }
    return null
  },
  
  /**
   * Logout
   */
  logout() {
    clearAuthData()
    window.location.href = '/login'
  },
  
  getCurrentUser() {
    return safeParseUser()
  },
  
  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!getToken()
  },
  
  /**
   * Check if user has permission
   */
  hasPermission(permission) {
    const user = this.getCurrentUser()
    return user?.permissions?.includes(permission) || false
  },
  
  /**
   * Check if user has role
   */
  hasRole(role) {
    const user = this.getCurrentUser()
    return user?.role === role
  },

  // Product methods
  /**
   * Get products (server-side filtered + paginated)
   */
  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip  != null) queryParams.append('skip',     params.skip)
      if (params.limit != null) queryParams.append('limit',    params.limit)
      if (params.category)      queryParams.append('category', params.category)
      if (params.status)        queryParams.append('status',   params.status)
      if (params.brand)         queryParams.append('brand',    params.brand)
      if (params.search)        queryParams.append('search',   params.search)

      const response = await apiRequest(`/products?${queryParams.toString()}`)

      if (response.ok) {
        return await response.json()
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Failed to fetch products: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch products:', error)
      throw error
    }
  },

  /**
   * Get all distinct brand names (for filter dropdown)
   */
  async getBrands() {
    try {
      const response = await apiRequest('/products/brands')
      if (response.ok) return await response.json()
      throw new Error('Failed to fetch brands')
    } catch (error) {
      console.error('Failed to fetch brands:', error)
      return { brands: [] }
    }
  },

  /**
   * Get dashboard stats (counts + recent products + category breakdown)
   */
  async getDashboardStats() {
    try {
      const response = await apiRequest('/products/stats')
      if (response.ok) return await response.json()
      throw new Error(`Failed to fetch stats: ${response.statusText}`)
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      throw error
    }
  },

  /**
   * Delete product
   */
  async deleteProduct(id) {
    try {
      const response = await apiRequest(`/products/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to delete product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

// Nomenclature Service
export const nomenclatureService = {
  /**
   * Get all nomenclature mappings
   */
  async getNomenclature(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)

      const response = await apiRequest(`/nomenclature?${queryParams.toString()}`)

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`Failed to fetch nomenclature: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch nomenclature:', error)
      throw error
    }
  },

  /**
   * Create a new nomenclature mapping
   */
  async createNomenclature(nomenclatureData) {
    try {
      const response = await apiRequest('/nomenclature', {
        method: 'POST',
        body: JSON.stringify(nomenclatureData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'Failed to create nomenclature mapping')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Update a nomenclature mapping
   */
  async updateNomenclature(id, nomenclatureData) {
    try {
      const response = await apiRequest(`/nomenclature/${id}`, {
        method: 'PUT',
        body: JSON.stringify(nomenclatureData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to update nomenclature mapping')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Delete a nomenclature mapping
   */
  async deleteNomenclature(id) {
    try {
      const response = await apiRequest(`/nomenclature/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to delete nomenclature mapping')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Add synonyms to a nomenclature mapping
   */
  async addSynonyms(id, rawNames) {
    try {
      // Add multiple synonyms by updating the raw_names array
      const response = await apiRequest(`/nomenclature/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ raw_names: rawNames })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to add synonyms')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Remove a synonym from a nomenclature mapping
   */
  async removeSynonym(id, rawName) {
    try {
      const response = await apiRequest(`/nomenclature/${id}/synonyms/${encodeURIComponent(rawName)}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to remove synonym')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Get the full reverse lookup map (raw_name -> standardized_name) from DB
   */
  async getBuildMap() {
    try {
      const response = await apiRequest('/nomenclature/map')
      if (response.ok) {
        return await response.json()
      }
      throw new Error('Failed to fetch nomenclature map')
    } catch (error) {
      console.error('Failed to fetch nomenclature map:', error)
      throw error
    }
  },

  /**
   * Seed nomenclature from hardcoded map
   */
  async seedNomenclature() {
    try {
      const response = await apiRequest('/nomenclature/seed', {
        method: 'POST'
      })
      const result = await response.json()
      if (response.ok) {
        return { success: true, ...result }
      }
      return { success: false, error: sanitizeError(result.detail, 'Failed to seed nomenclature') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  }
}

// COA Nomenclature Service
export const coaNomenclatureService = {
  async getAll(params = {}) {
    const qp = new URLSearchParams()
    if (params.skip) qp.append('skip', params.skip)
    if (params.limit) qp.append('limit', params.limit)
    if (params.search) qp.append('search', params.search)
    const response = await apiRequest(`/coa-nomenclature?${qp.toString()}`)
    if (response.ok) return await response.json()
    throw new Error('Failed to fetch COA nomenclature')
  },

  async getMap() {
    const response = await apiRequest('/coa-nomenclature/map')
    if (response.ok) return await response.json()
    throw new Error('Failed to fetch COA nomenclature map')
  },

  async resolve(rawNames) {
    try {
      const response = await apiRequest('/coa-nomenclature/resolve', {
        method: 'POST',
        body: JSON.stringify({ raw_names: rawNames })
      })
      if (response.ok) return await response.json()
      return { resolved: {} }
    } catch {
      return { resolved: {} }
    }
  },

  async create(data) {
    try {
      const response = await apiRequest('/coa-nomenclature', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to create COA nomenclature') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async update(id, data) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to update COA nomenclature') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async delete(id) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to delete COA nomenclature') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async addSynonym(id, rawName) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}/synonyms`, {
        method: 'POST',
        body: JSON.stringify({ raw_name: rawName })
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to add synonym') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async removeSynonym(id, rawName) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}/synonyms/${encodeURIComponent(rawName)}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to remove synonym') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async seed() {
    try {
      const response = await apiRequest('/coa-nomenclature/seed', {
        method: 'POST'
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to seed COA nomenclature') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },
}

// Nutrient Hierarchy Service
export const nutrientHierarchyService = {
  async getAll() {
    const response = await apiRequest('/nutrient-hierarchy')
    if (response.ok) return await response.json()
    throw new Error('Failed to fetch nutrient hierarchy')
  },

  async getTree() {
    const response = await apiRequest('/nutrient-hierarchy/tree')
    if (response.ok) return await response.json()
    throw new Error('Failed to fetch nutrient hierarchy tree')
  },

  async create(data) {
    try {
      const response = await apiRequest('/nutrient-hierarchy', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to create hierarchy node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async update(id, data) {
    try {
      const response = await apiRequest(`/nutrient-hierarchy/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to update hierarchy node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async remove(id, cascade = false) {
    try {
      const response = await apiRequest(`/nutrient-hierarchy/${id}?cascade=${cascade}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to delete hierarchy node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async seed() {
    try {
      const response = await apiRequest('/nutrient-hierarchy/seed', {
        method: 'POST'
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: sanitizeError(result.detail, 'Failed to seed hierarchy') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },
}

// User Service
export const userService = {
  /**
   * Get all users
   */
  async getUsers(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.page) queryParams.append('page', params.page)
      if (params.page_size) queryParams.append('page_size', params.page_size)

      const response = await apiRequest(`/users?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        console.error('API response not OK:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
        throw new Error(`Failed to fetch users: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
      throw error
    }
  }
}

// Category Service
export const categoryService = {
  /**
   * Get all categories
   */
  async getCategories(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)

      const response = await apiRequest(`/categories?${queryParams.toString()}`)

      if (response.ok) {
        return await response.json()
      } else {
        throw new Error(`Failed to fetch categories: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error)
      throw error
    }
  },

  /**
   * Create a new category
   */
  async createCategory(categoryData) {
    try {
      const response = await apiRequest('/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'Failed to create category')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Update a category
   */
  async updateCategory(id, categoryData) {
    try {
      const response = await apiRequest(`/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify(categoryData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to update category')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Delete a category
   */
  async deleteCategory(id) {
    try {
      const response = await apiRequest(`/categories/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to delete category')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

// COA Service
export const coaService = {
  /**
   * Extract COA data from images using AI
   */
  async extractFromImages(images) {
    try {
      const formData = new FormData()
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        
        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          formData.append('images', blob, `coa_image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          formData.append('images', image, image.name || `coa_image_${i}.jpg`)
        }
      }
      
      const response = await apiUpload('/coa/extract', formData)
      const result = await response.json()
      
      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'COA extraction failed')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error during COA extraction'
      }
    }
  },

  /**
   * Create a new COA entry
   */
  async createCOA(coaData) {
    try {
      const response = await apiRequest('/coa', {
        method: 'POST',
        body: JSON.stringify(coaData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      } else {
        return {
          success: false,
          error: sanitizeError(result.detail, 'Failed to create COA')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Get all COAs
   */
  async getCOAs(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.search) queryParams.append('search', params.search)
      if (params.status) queryParams.append('status', params.status)

      const response = await apiRequest(`/coa?${queryParams.toString()}`)

      if (response.ok) {
        return await response.json()
      } else {
        console.error('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch COAs: ${response.statusText}`)
      }
    } catch (error) {
      console.error('Failed to fetch COAs:', error)
      throw error
    }
  },

  /**
   * Get single COA
   */
  async getCOA(id) {
    try {
      const response = await apiRequest(`/coa/${id}`)
      
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('Failed to fetch COA:', error)
      return null
    }
  },

  /**
   * Update COA
   */
  async updateCOA(id, coaData) {
    try {
      const response = await apiRequest(`/coa/${id}`, {
        method: 'PUT',
        body: JSON.stringify(coaData)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to update COA')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  /**
   * Delete COA
   */
  async deleteCOA(id) {
    try {
      const response = await apiRequest(`/coa/${id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, ...result }
      }
      return {
        success: false,
        error: sanitizeError(result.detail, 'Failed to delete COA')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

// ==================== Formulation Service ====================
export const formulationService = {
  /**
   * Save a formulation
   */
  async saveFormulation(data) {
    try {
      const response = await apiRequest('/formulations/save', {
        method: 'POST',
        body: JSON.stringify(data)
      })
      const result = await response.json()
      if (response.ok) {
        return { success: true, ...result }
      }
      return { success: false, error: sanitizeError(result.detail, 'Failed to save formulation') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  /**
   * List saved formulations
   */
  async getFormulations(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.created_by) queryParams.append('created_by', params.created_by)
      const response = await apiRequest(`/formulations/list?${queryParams.toString()}`)
      if (response.ok) {
        return await response.json()
      }
      return { formulations: [], total: 0 }
    } catch (error) {
      console.error('Failed to fetch formulations:', error)
      return { formulations: [], total: 0 }
    }
  },

  /**
   * Get a single formulation by ID
   */
  async getFormulation(id) {
    try {
      const response = await apiRequest(`/formulations/${id}`)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.error('Failed to fetch formulation:', error)
      return null
    }
  },

  /**
   * Delete a formulation
   */
  async deleteFormulation(id) {
    try {
      const response = await apiRequest(`/formulations/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (response.ok) {
        return { success: true, ...result }
      }
      return { success: false, error: sanitizeError(result.detail, 'Failed to delete formulation') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  }
}

export default authService

