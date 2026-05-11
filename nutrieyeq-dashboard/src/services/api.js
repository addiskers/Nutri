import { authStorage } from './authStorage'

const RAW_API_URL = import.meta.env.VITE_API_URL
if (import.meta.env.PROD && !RAW_API_URL) {
  throw new Error('VITE_API_URL must be set at build time for production bundles')
}
const API_BASE_URL = RAW_API_URL || 'http://localhost:8000/api'

const getToken = () => authStorage.getAccessToken()

export const clearAuthData = () => authStorage.clear()

export function extractErrorMessage(body, fallback = 'Something went wrong') {
  if (body == null) return fallback
  if (typeof body === 'string') return body
  const detail = body.detail ?? body.message ?? body
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item.msg === 'string') return item.msg
        return null
      })
      .filter(Boolean)
    return parts.length ? parts.join('; ') : fallback
  }
  if (detail && typeof detail.msg === 'string') return detail.msg
  return fallback
}

const debugLog = (...args) => {
  if (import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args)
  }
}

let _refreshInFlight = null

async function refreshAccessToken() {
  if (_refreshInFlight) return _refreshInFlight
  const refresh_token = authStorage.getRefreshToken()
  if (!refresh_token) return null

  _refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token }),
      })
      if (!res.ok) return null
      const data = await res.json()
      authStorage.setTokens({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      return data.access_token
    } catch {
      return null
    } finally {
      _refreshInFlight = null
    }
  })()

  return _refreshInFlight
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData

  const buildConfig = (t) => ({
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
      ...(t && { 'Authorization': `Bearer ${t}` }),
    },
  })

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig(token))

    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        response = await fetch(`${API_BASE_URL}${endpoint}`, buildConfig(refreshed))
        if (response.status !== 401) {
          return response
        }
      }

      authStorage.clear()
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      throw new Error('Session expired. Please login again.')
    }

    return response
  } catch (error) {
    debugLog('API Request Error:', error)
    throw error
  }
}

export const productService = {
  async extractFromImages(images) {
    debugLog('[FRONTEND] Starting extraction with', images.length, 'images')
    try {
      const formData = new FormData()
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        debugLog(`[FRONTEND] Processing image ${i + 1}/${images.length}`)
        
        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          debugLog(`[FRONTEND] Image ${i + 1} converted to blob: ${blob.size} bytes`)
          formData.append('images', blob, `image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          debugLog(`[FRONTEND] Image ${i + 1} is File/Blob: ${image.size} bytes`)
          formData.append('images', image, `image_${i}.jpg`)
        }
      }
      
      debugLog('[FRONTEND] Calling API:', `${API_BASE_URL}/products/extract`)

      const response = await apiRequest('/products/extract', {
        method: 'POST',
        body: formData,
      })

      debugLog('[FRONTEND] Response status:', response.status)
      const result = await response.json()
      debugLog('[FRONTEND] Response data:', result)

      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: extractErrorMessage(result, 'Extraction failed')
        }
      }
    } catch (error) {
      debugLog('[FRONTEND] Extraction error:', error)
      return {
        success: false,
        error: error.message || 'Network error during extraction'
      }
    }
  },
  
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
          error: extractErrorMessage(result, 'Failed to create product')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  async getDashboardStats() {
    const response = await apiRequest('/products/dashboard-stats', { method: 'GET' })
    if (response.ok) return await response.json()
    const errorData = await response.json().catch(() => ({}))
    throw new Error(extractErrorMessage(errorData, 'Failed to fetch dashboard stats'))
  },

  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.category) queryParams.append('category', params.category)
      if (params.status) queryParams.append('status', params.status)
      if (params.search) queryParams.append('search', params.search)

      const response = await apiRequest(`/products?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch products:', error)
      throw error
    }
  },

  async getProduct(id) {
    try {
      const response = await apiRequest(`/products/${id}`)
      
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      debugLog('Failed to fetch product:', error)
      return null
    }
  },
  
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
        error: extractErrorMessage(result, 'Failed to update product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },
  
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
        error: extractErrorMessage(result, 'Failed to delete product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export const authService = {
  async register(name, email, password, department) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, department })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: extractErrorMessage(result, 'Registration failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  async login(email, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        if (result.success === false) {
          return { success: false, error: extractErrorMessage(result, 'Login failed') }
        }
        return { success: true, message: result.message }
      } else {
        return { success: false, error: extractErrorMessage(result, 'Login failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  async verifyLoginOtp(email, otp) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, otp })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        authStorage.setTokens({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
          user: result.user,
        })
        return { success: true, user: result.user }
      } else {
        return { success: false, error: extractErrorMessage(result, 'OTP verification failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  async forgotPassword(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: extractErrorMessage(result, 'Request failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  async resetPassword(email, otp, newPassword) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, otp, new_password: newPassword })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: extractErrorMessage(result, 'Password reset failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

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
        return { success: false, error: extractErrorMessage(result, 'Password change failed') }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  async getCurrentUserInfo() {
    const response = await apiRequest('/auth/me', {
      method: 'GET'
    })
    
    if (response.ok) {
      const user = await response.json()
      authStorage.setUser(user)
      return user
    }
    
    return null
  },

  async refreshUserData() {
    try {
      if (!getToken()) return null

      const response = await apiRequest('/auth/me', { method: 'GET' })

      if (response.ok) {
        const user = await response.json()
        authStorage.setUser(user)
        window.location.reload()
        return user
      }
    } catch (error) {
      debugLog('Failed to refresh user data:', error)
    }
    return null
  },
  
  async logout() {
    try {
      const token = getToken()
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      }
    } catch (e) {
    }
    authStorage.clear()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },
  
  getCurrentUser() {
    return authStorage.getUser()
  },

  isAuthenticated() {
    return !!getToken()
  },

  hasPermission(permission) {
    const user = this.getCurrentUser()
    return user?.permissions?.includes(permission) || false
  },

  hasRole(role) {
    const user = this.getCurrentUser()
    return user?.role === role
  },

  async getBrands() {
    try {
      const response = await apiRequest('/products/brands', { method: 'GET' })
      if (response.ok) return await response.json()
      return { brands: [] }
    } catch (err) {
      debugLog('Failed to fetch brands:', err)
      return { brands: [] }
    }
  },

  async getProducts(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.category) queryParams.append('category', params.category)
      if (params.status) queryParams.append('status', params.status)
      if (params.search) queryParams.append('search', params.search)

      const response = await apiRequest(`/products?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch products: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch products:', error)
      throw error
    }
  },

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
        error: extractErrorMessage(result, 'Failed to delete product')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export const nomenclatureService = {
  async getBuildMap() {
    const response = await apiRequest('/nomenclature/map', { method: 'GET' })
    if (response.ok) return await response.json()
    const errorData = await response.json().catch(() => ({}))
    throw new Error(extractErrorMessage(errorData, 'Failed to build nomenclature map'))
  },

  async getNomenclature(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)

      const response = await apiRequest(`/nomenclature?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch nomenclature: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch nomenclature:', error)
      throw error
    }
  },

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
          error: extractErrorMessage(result, 'Failed to create nomenclature mapping')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to update nomenclature mapping')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to delete nomenclature mapping')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  async addSynonyms(id, rawNames) {
    try {
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
        error: extractErrorMessage(result, 'Failed to add synonyms')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to remove synonym')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export const userService = {
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
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch users: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch users:', error)
      throw error
    }
  }
}

export const categoryService = {
  async getCategories(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)

      const response = await apiRequest(`/categories?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch categories: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch categories:', error)
      throw error
    }
  },

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
          error: extractErrorMessage(result, 'Failed to create category')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to update category')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to delete category')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export const coaService = {
  async extractFromImages(images) {
    debugLog('[FRONTEND] Starting COA extraction with', images.length, 'images')
    try {
      const formData = new FormData()

      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        debugLog(`[FRONTEND] Processing COA image ${i + 1}/${images.length}`)

        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          debugLog(`[FRONTEND] Image ${i + 1} converted to blob: ${blob.size} bytes`)
          formData.append('images', blob, `coa_image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          debugLog(`[FRONTEND] Image ${i + 1} is File/Blob: ${image.size} bytes`)
          formData.append('images', image, image.name || `coa_image_${i}.jpg`)
        }
      }
      
      debugLog('[FRONTEND] Calling API:', `${API_BASE_URL}/coa/extract`)

      const response = await apiRequest('/coa/extract', {
        method: 'POST',
        body: formData,
      })

      debugLog('[FRONTEND] Response status:', response.status)
      const result = await response.json()
      debugLog('[FRONTEND] Response data:', result)

      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: extractErrorMessage(result, 'COA extraction failed')
        }
      }
    } catch (error) {
      debugLog('[FRONTEND] COA extraction error:', error)
      return {
        success: false,
        error: error.message || 'Network error during COA extraction'
      }
    }
  },

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
          error: extractErrorMessage(result, 'Failed to create COA')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

  async getCOAs(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      if (params.search) queryParams.append('search', params.search)
      if (params.status) queryParams.append('status', params.status)

      const response = await apiRequest(`/coa?${queryParams.toString()}`, {
        method: 'GET'
      })

      if (response.ok) {
        return await response.json()
      } else {
        debugLog('API response not OK:', response.status, response.statusText)
        throw new Error(`Failed to fetch COAs: ${response.statusText}`)
      }
    } catch (error) {
      debugLog('Failed to fetch COAs:', error)
      throw error
    }
  },

  async getCOA(id) {
    try {
      const response = await apiRequest(`/coa/${id}`)
      
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      debugLog('Failed to fetch COA:', error)
      return null
    }
  },

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
        error: extractErrorMessage(result, 'Failed to update COA')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  },

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
        error: extractErrorMessage(result, 'Failed to delete COA')
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
}

export const formulationService = {
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
      return { success: false, error: extractErrorMessage(result, 'Failed to save formulation') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async getFormulations(params = {}) {
    try {
      const queryParams = new URLSearchParams()
      if (params.skip) queryParams.append('skip', params.skip)
      if (params.limit) queryParams.append('limit', params.limit)
      const response = await apiRequest(`/formulations/list?${queryParams.toString()}`)
      if (response.ok) {
        return await response.json()
      }
      return { formulations: [], total: 0 }
    } catch (error) {
      debugLog('Failed to fetch formulations:', error)
      return { formulations: [], total: 0 }
    }
  },

  async getFormulation(id) {
    try {
      const response = await apiRequest(`/formulations/${id}`)
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      debugLog('Failed to fetch formulation:', error)
      return null
    }
  },

  async deleteFormulation(id) {
    try {
      const response = await apiRequest(`/formulations/${id}`, {
        method: 'DELETE'
      })
      const result = await response.json()
      if (response.ok) {
        return { success: true, ...result }
      }
      return { success: false, error: extractErrorMessage(result, 'Failed to delete formulation') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  }
}

export const coaNomenclatureService = {
  async getAll(params = {}) {
    try {
      const qs = new URLSearchParams()
      if (params.skip != null) qs.append('skip', params.skip)
      if (params.limit != null) qs.append('limit', params.limit)
      if (params.search) qs.append('search', params.search)
      const response = await apiRequest(`/coa-nomenclature?${qs.toString()}`, {
        method: 'GET',
      })
      if (response.ok) return await response.json()
      return { mappings: [], total: 0 }
    } catch (error) {
      debugLog('Failed to fetch COA nomenclature:', error)
      return { mappings: [], total: 0 }
    }
  },

  async getMap() {
    try {
      const response = await apiRequest('/coa-nomenclature/map', { method: 'GET' })
      if (response.ok) return await response.json()
      return { map: {}, unit_map: {}, total_mappings: 0, total_raw_names: 0 }
    } catch (error) {
      debugLog('Failed to fetch COA nomenclature map:', error)
      return { map: {}, unit_map: {}, total_mappings: 0, total_raw_names: 0 }
    }
  },

  async resolve(rawNames) {
    try {
      const response = await apiRequest('/coa-nomenclature/resolve', {
        method: 'POST',
        body: JSON.stringify({ raw_names: rawNames || [] }),
      })
      if (response.ok) return await response.json()
      return { resolved: {} }
    } catch (error) {
      debugLog('Failed to resolve raw names:', error)
      return { resolved: {} }
    }
  },

  async create(data) {
    try {
      const response = await apiRequest('/coa-nomenclature', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to create mapping') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async update(id, data) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to update mapping') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async delete(id) {
    try {
      const response = await apiRequest(`/coa-nomenclature/${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to delete mapping') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async removeSynonym(id, rawName) {
    try {
      const response = await apiRequest(
        `/coa-nomenclature/${id}/synonyms/${encodeURIComponent(rawName)}`,
        { method: 'DELETE' }
      )
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to remove synonym') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async seed() {
    try {
      const response = await apiRequest('/coa-nomenclature/seed', { method: 'POST' })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to seed mappings') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },
}

export const nutrientHierarchyService = {
  async getTree() {
    try {
      const response = await apiRequest('/nutrient-hierarchy/tree', { method: 'GET' })
      if (response.ok) return await response.json()
      return { tree: [], total: 0 }
    } catch (error) {
      debugLog('Failed to fetch hierarchy tree:', error)
      return { tree: [], total: 0 }
    }
  },

  async getAll() {
    try {
      const response = await apiRequest('/nutrient-hierarchy', { method: 'GET' })
      if (response.ok) return await response.json()
      return { nodes: [], total: 0 }
    } catch (error) {
      debugLog('Failed to fetch hierarchy nodes:', error)
      return { nodes: [], total: 0 }
    }
  },

  async create(data) {
    try {
      const response = await apiRequest('/nutrient-hierarchy', {
        method: 'POST',
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to create node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async update(id, data) {
    try {
      const response = await apiRequest(`/nutrient-hierarchy/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to update node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async remove(id, cascade = false) {
    try {
      const qs = cascade ? '?cascade=true' : ''
      const response = await apiRequest(`/nutrient-hierarchy/${id}${qs}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to delete node') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },

  async seed() {
    try {
      const response = await apiRequest('/nutrient-hierarchy/seed', { method: 'POST' })
      const result = await response.json()
      if (response.ok) return { success: true, ...result }
      return { success: false, error: extractErrorMessage(result, 'Failed to seed hierarchy') }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  },
}

export default authService

