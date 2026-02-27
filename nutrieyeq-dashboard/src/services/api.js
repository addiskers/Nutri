const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const getToken = () => localStorage.getItem('access_token')

async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': '69420',
      'User-Agent': 'CustomClient',
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    
    if (response.status === 401 && token) {
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        config.headers['Authorization'] = `Bearer ${getToken()}`
        return fetch(`${API_BASE_URL}${endpoint}`, config)
      } else {
        localStorage.clear()
        window.location.href = '/login'
        throw new Error('Session expired. Please login again.')
      }
    }
    
    return response
  } catch (error) {
    console.error('API Request Error:', error)
    throw error
  }
}

// Refresh access token
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return false
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': '69420'
      },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    
    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      return true
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
  
  return false
}

export const productService = {
  async extractFromImages(images) {
    console.log('[FRONTEND] Starting extraction with', images.length, 'images')
    try {
      const formData = new FormData()
      
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        console.log(`[FRONTEND] Processing image ${i + 1}/${images.length}`)
        
        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          console.log(`[FRONTEND] Image ${i + 1} converted to blob: ${blob.size} bytes`)
          formData.append('images', blob, `image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          console.log(`[FRONTEND] Image ${i + 1} is File/Blob: ${image.size} bytes`)
          formData.append('images', image, `image_${i}.jpg`)
        }
      }
      
      const token = localStorage.getItem('access_token')
      console.log('[FRONTEND] Token present:', !!token)
      console.log('[FRONTEND] Calling API:', `${API_BASE_URL}/products/extract`)
      
      const response = await fetch(`${API_BASE_URL}/products/extract`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': '69420',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      })
      
      console.log('[FRONTEND] Response status:', response.status)
      const result = await response.json()
      console.log('[FRONTEND] Response data:', result)
      
      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: result.detail || 'Extraction failed'
        }
      }
    } catch (error) {
      console.error('[FRONTEND] Extraction error:', error)
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
          error: result.detail || 'Failed to create product'
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

      // Direct fetch without auth for public endpoint
      const response = await fetch(`${API_BASE_URL}/products?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

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
        error: result.detail || 'Failed to update product'
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
        error: result.detail || 'Failed to delete product'
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
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ name, email, password, department })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.detail || 'Registration failed' }
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
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, password })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        // Check backend's success field, not just HTTP status
        if (result.success === false) {
          return { success: false, error: result.message || 'Login failed' }
        }
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.detail || 'Login failed' }
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
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, otp })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        localStorage.setItem('access_token', result.access_token)
        localStorage.setItem('refresh_token', result.refresh_token)
        localStorage.setItem('user', JSON.stringify(result.user))
        return { success: true, user: result.user }
      } else {
        return { success: false, error: result.detail || 'OTP verification failed' }
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
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.detail || 'Request failed' }
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
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify({ email, otp, new_password: newPassword })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        return { success: true, message: result.message }
      } else {
        return { success: false, error: result.detail || 'Password reset failed' }
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
        return { success: false, error: result.detail || 'Password change failed' }
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' }
    }
  },

  /**
   * Get current user info
   */
  async getCurrentUserInfo() {
    const response = await apiRequest('/auth/me', {
      method: 'GET'
    })
    
    if (response.ok) {
      const user = await response.json()
      localStorage.setItem('user', JSON.stringify(user))
      return user
    }
    
    return null
  },

  /**
   * Refresh current user data (for real-time permission updates)
   */
  async refreshUserData() {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) return null

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const user = await response.json()
        localStorage.setItem('user', JSON.stringify(user))
        
        // Trigger a page reload to apply new permissions
        window.location.reload()
        return user
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
    return null
  },
  
  /**
   * Logout
   */
  logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    window.location.href = '/login'
  },
  
  /**
   * Get stored user
   */
  getCurrentUser() {
    const userStr = localStorage.getItem('user')
    return userStr ? JSON.parse(userStr) : null
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

      // Direct fetch without auth for public endpoint
      const response = await fetch(`${API_BASE_URL}/products?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

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
        error: result.detail || 'Failed to delete product'
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

      const response = await fetch(`${API_BASE_URL}/nomenclature?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (response.ok) {
        return await response.json()
      } else {
        console.error('API response not OK:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
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
          error: result.detail || 'Failed to create nomenclature mapping'
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
        error: result.detail || 'Failed to update nomenclature mapping'
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
        error: result.detail || 'Failed to delete nomenclature mapping'
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
        error: result.detail || 'Failed to add synonyms'
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
        error: result.detail || 'Failed to remove synonym'
      }
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Network error'
      }
    }
  }
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

      const response = await fetch(`${API_BASE_URL}/categories?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (response.ok) {
        return await response.json()
      } else {
        console.error('API response not OK:', response.status, response.statusText)
        const errorData = await response.json().catch(() => ({}))
        console.error('Error details:', errorData)
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
          error: result.detail || 'Failed to create category'
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
        error: result.detail || 'Failed to update category'
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
        error: result.detail || 'Failed to delete category'
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
    console.log('[FRONTEND] Starting COA extraction with', images.length, 'images')
    try {
      const formData = new FormData()
      
      // Add each image to form data
      for (let i = 0; i < images.length; i++) {
        const image = images[i]
        console.log(`[FRONTEND] Processing COA image ${i + 1}/${images.length}`)
        
        // Convert base64 to blob if needed
        if (typeof image === 'string' && image.startsWith('data:')) {
          const response = await fetch(image)
          const blob = await response.blob()
          console.log(`[FRONTEND] Image ${i + 1} converted to blob: ${blob.size} bytes`)
          formData.append('images', blob, `coa_image_${i}.jpg`)
        } else if (image instanceof File || image instanceof Blob) {
          console.log(`[FRONTEND] Image ${i + 1} is File/Blob: ${image.size} bytes`)
          formData.append('images', image, image.name || `coa_image_${i}.jpg`)
        }
      }
      
      const token = localStorage.getItem('access_token')
      console.log('[FRONTEND] Token present:', !!token)
      console.log('[FRONTEND] Calling API:', `${API_BASE_URL}/coa/extract`)
      
      const response = await fetch(`${API_BASE_URL}/coa/extract`, {
        method: 'POST',
        headers: {
          'ngrok-skip-browser-warning': '69420',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: formData
      })
      
      console.log('[FRONTEND] Response status:', response.status)
      const result = await response.json()
      console.log('[FRONTEND] Response data:', result)
      
      if (response.ok) {
        return result
      } else {
        return {
          success: false,
          error: result.detail || 'COA extraction failed'
        }
      }
    } catch (error) {
      console.error('[FRONTEND] COA extraction error:', error)
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
          error: result.detail || 'Failed to create COA'
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

      const response = await fetch(`${API_BASE_URL}/coa?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

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
        error: result.detail || 'Failed to update COA'
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
        error: result.detail || 'Failed to delete COA'
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
      return { success: false, error: result.detail || 'Failed to save formulation' }
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
      return { success: false, error: result.detail || 'Failed to delete formulation' }
    } catch (error) {
      return { success: false, error: error.message || 'Network error' }
    }
  }
}

export default authService

