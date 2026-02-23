import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import ProductPreviewModal from '../components/Modals/ProductPreviewModal'
import DeleteConfirmModal from '../components/Modals/DeleteConfirmModal'
import NoPermissionContent from '../components/NoPermissionContent'
import { Search, Filter, Calendar, Eye, Edit2, Trash2, Plus, ChevronDown } from 'lucide-react'
import { mockCategories } from '../utils/mockData'
import authService from '../services/api'

const Products = () => {
  const navigate = useNavigate()
  const hasPermission = authService.hasPermission('view_products')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All Categories')
  const [selectedBrand, setSelectedBrand] = useState('All Brands')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showBrandDropdown, setShowBrandDropdown] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [allProducts, setAllProducts] = useState([])
  const [filteredProducts, setFilteredProducts] = useState([])
  const [previewProduct, setPreviewProduct] = useState(null)
  const [deleteProduct, setDeleteProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const categoryDropdownRef = useRef(null)
  const brandDropdownRef = useRef(null)
  const datePickerRef = useRef(null)

  // Fetch products from API
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Fetching products from API...')

      const response = await authService.getProducts({ status: 'published', limit: 1000 })
      console.log('API Response:', response)

      if (response && response.products) {
        // Map API response to UI format
        const mappedProducts = response.products.map(product => {
          // Debug logging for products with multiple images
          if (product.images && product.images.length > 1) {
            console.log(`[DEBUG] Product "${product.product_name}" has ${product.images.length} images`)
          }
          
          return {
            id: product.id || product._id,
            productName: product.product_name,
            brand: product.parent_brand || 'N/A',
            category: product.category || 'Uncategorized',
            mrp: product.mrp ? `₹${product.mrp}` : '₹0',
            uploadDate: formatDate(product.created_at),
            packSize: product.pack_size || product.net_weight || 'Not specified',
            uploadedBy: 'Admin', // Default since we don't have user names in the response
            manufacturingDate: product.manufacturing_date || 'N/A',
            expiryDate: product.expiry_date || 'N/A',
            rawData: product, // Keep raw data for preview modal
            images: product.images || [], // Also store images at top level for quick access
            createdAt: product.created_at // Keep for sorting
          }
        })

        // Sort by latest created (newest first)
        const sortedProducts = mappedProducts.sort((a, b) => {
          return new Date(b.createdAt) - new Date(a.createdAt)
        })

        console.log('Mapped products:', sortedProducts.length)
        setAllProducts(sortedProducts)
        setFilteredProducts(sortedProducts)
      } else {
        console.warn('No products in response:', response)
        setError('No products found in the database.')
      }
    } catch (err) {
      console.error('Error fetching products:', err)
      setError(`Failed to load products: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleString('en-US', { month: 'long' })
    const year = date.getFullYear()

    const ordinal = (n) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = n % 100
      return n + (s[(v - 20) % 10] || s[v] || s[0])
    }

    return `${ordinal(day)} ${month} ${year}`
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false)
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target)) {
        setShowBrandDropdown(false)
      }
      if (datePickerRef.current && !datePickerRef.current.contains(event.target)) {
        setShowDatePicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get unique brands from products
  const uniqueBrands = ['All Brands', ...new Set(allProducts.map(p => p.brand).filter(b => b && b !== 'N/A').sort())]

  // Filter products based on search, category, and brand
  const handleSearch = (query) => {
    setSearchQuery(query)
    filterProducts(query, selectedCategory, selectedBrand)
  }

  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    setShowCategoryDropdown(false)
    filterProducts(searchQuery, category, selectedBrand)
  }

  const handleBrandSelect = (brand) => {
    setSelectedBrand(brand)
    setShowBrandDropdown(false)
    filterProducts(searchQuery, selectedCategory, brand)
  }

  const filterProducts = (search, category, brand) => {
    let filtered = allProducts

    // Filter by search
    if (search) {
      filtered = filtered.filter(product =>
        product.productName.toLowerCase().includes(search.toLowerCase()) ||
        product.brand.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase())
      )
    }

    // Filter by category
    if (category !== 'All Categories') {
      filtered = filtered.filter(product => product.category === category)
    }

    // Filter by brand
    if (brand !== 'All Brands') {
      filtered = filtered.filter(product => product.brand === brand)
    }

    setFilteredProducts(filtered)
  }

  // Update filtered products when allProducts changes
  useEffect(() => {
    filterProducts(searchQuery, selectedCategory, selectedBrand)
  }, [allProducts])

  return (
    <Layout>
      {!hasPermission ? (
        <NoPermissionContent pageName="Products Page" />
      ) : (
        <div className="p-4 md:p-6 h-full flex flex-col">
          {/* Page Header with Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
                Products
              </h1>
              <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
                Manage and view all captured product data
              </p>
            </div>
          <button
            onClick={() => navigate('/add-product')}
            className="bg-[#b455a0] flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search by product name or brand..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Brand Filter */}
            <div className="relative w-full sm:w-auto" ref={brandDropdownRef}>
              <button
                onClick={() => {
                  setShowBrandDropdown(!showBrandDropdown)
                  setShowCategoryDropdown(false)
                  setShowDatePicker(false)
                }}
                className="bg-[#f9fafb] border border-[#e1e7ef] h-10 px-4 rounded-md flex items-center gap-3 hover:bg-gray-100 transition-colors w-full sm:min-w-[160px]"
              >
                <Filter className="w-4 h-4 text-[#65758b]" />
                <span className="text-sm font-ibm-plex text-[#0f1729] flex-1 text-left truncate">
                  {selectedBrand}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#65758b] transition-transform ${showBrandDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showBrandDropdown && (
                <div className="absolute top-12 left-0 min-w-[160px] bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {uniqueBrands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => handleBrandSelect(brand)}
                      className={`w-full px-4 py-2.5 text-left text-sm font-ibm-plex hover:bg-gray-50 transition-colors ${
                        selectedBrand === brand
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-[#0f1729]'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative w-full sm:w-auto" ref={categoryDropdownRef}>
              <button
                onClick={() => {
                  setShowCategoryDropdown(!showCategoryDropdown)
                  setShowBrandDropdown(false)
                  setShowDatePicker(false)
                }}
                className="bg-[#f9fafb] border border-[#e1e7ef] h-10 px-4 rounded-md flex items-center gap-3 hover:bg-gray-100 transition-colors w-full sm:min-w-[180px]"
              >
                <Filter className="w-4 h-4 text-[#65758b]" />
                <span className="text-sm font-ibm-plex text-[#0f1729] flex-1 text-left truncate">
                  {selectedCategory}
                </span>
                <ChevronDown className={`w-4 h-4 text-[#65758b] transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {showCategoryDropdown && (
                <div className="absolute top-12 left-0 min-w-[180px] bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-60 overflow-y-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {mockCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => handleCategorySelect(category)}
                      className={`w-full px-4 py-2.5 text-left text-sm font-ibm-plex hover:bg-gray-50 transition-colors ${
                        selectedCategory === category
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-[#0f1729]'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date Filter */}
            <div className="relative w-full sm:w-auto" ref={datePickerRef}>
              <button 
                onClick={() => {
                  setShowDatePicker(!showDatePicker)
                  setShowCategoryDropdown(false)
                }}
                className="bg-[#f9fafb] border border-[#e1e7ef] h-10 px-4 rounded-md flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors w-full sm:w-auto"
              >
                <span className="text-sm font-ibm-plex text-[#0f1729]">
                  Date
                </span>
                <Calendar className="w-4 h-4 text-[#65758b]" />
              </button>

              {showDatePicker && (
                <div className="absolute top-12 right-0 bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 p-4 min-w-[280px]">
                  <p className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                    Select Date Range
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-ibm-plex text-[#65758b] mb-1 block">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="w-full px-3 py-2 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-ibm-plex text-[#65758b] mb-1 block">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="w-full px-3 py-2 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => {
                          setDateRange({ start: '', end: '' })
                          setShowDatePicker(false)
                        }}
                        className="flex-1 px-3 py-2 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#65758b] hover:bg-gray-50"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setShowDatePicker(false)}
                        className="flex-1 px-3 py-2 bg-primary text-white rounded-md text-sm font-ibm-plex hover:bg-[#a04890]"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Products Table - Scrollable */}
        <div 
          className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col"
          onClick={() => {
            setShowCategoryDropdown(false)
            setShowBrandDropdown(false)
            setShowDatePicker(false)
          }}
        >
          <div className="overflow-x-auto flex-1">
            <div className="inline-block min-w-full align-middle h-full">
              <div className="overflow-y-auto h-full">
                <table className="min-w-full divide-y divide-[#e1e7ef]">
                  <thead className="bg-[#f1f5f9] sticky top-0 z-20 shadow-sm">
                    <tr>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Product Name
                        </span>
                      </th>
                      <th className="px-4 py-4 text-left">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Brand
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Category
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          MRP
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Upload Date
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Pack Size
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">
                          Mfg Date
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">
                          Expiry Date
                        </span>
                      </th>
                      <th className="px-4 py-4 text-center">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider whitespace-nowrap">
                          Uploaded/Edited By
                        </span>
                      </th>
                      <th className="px-4 py-4 text-right">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Actions
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-[#e1e7ef]">
                    {loading ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-ibm-plex text-[#65758b]">Loading products...</p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-12 text-center">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <p className="text-sm font-ibm-plex text-red-600">{error}</p>
                            <button
                              onClick={fetchProducts}
                              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-ibm-plex hover:bg-[#a04890]"
                            >
                              Retry
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="px-4 py-12 text-center">
                          <p className="text-sm font-ibm-plex text-[#65758b]">
                            {searchQuery || selectedCategory !== 'All Categories'
                              ? 'No products found matching your filters.'
                              : 'No products available. Add your first product!'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product, index) => (
                        <tr
                          key={product.id}
                          className={`hover:bg-gray-50 transition-colors ${
                            index % 2 === 1 ? 'bg-[#f9fafb]' : ''
                          }`}
                        >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <p className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            {product.productName}
                          </p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.brand}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            {product.mrp}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.uploadDate}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.packSize}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.manufacturingDate}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.expiryDate}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <span className="text-sm font-ibm-plex text-[#65758b]">
                            {product.uploadedBy}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                console.log('[DEBUG] Opening preview for product:', product.productName)
                                console.log('[DEBUG] Product data:', product)
                                console.log('[DEBUG] Images in rawData:', product.rawData?.images?.length || 0)
                                console.log('[DEBUG] Images at top level:', product.images?.length || 0)
                                setPreviewProduct(product)
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => navigate(`/edit-product/${product.id}`)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-[#65758b]" />
                            </button>
                            <button
                              onClick={() => setDeleteProduct(product)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-200 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-[#65758b]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Modals */}
      <ProductPreviewModal
        product={previewProduct}
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
      />

      <DeleteConfirmModal
        isOpen={!!deleteProduct}
        onClose={() => setDeleteProduct(null)}
        onConfirm={async () => {
          console.log('Deleting product:', deleteProduct)
          try {
            const result = await authService.deleteProduct(deleteProduct.id)
            if (result.success) {
              // Remove from both allProducts and filteredProducts
              setAllProducts(allProducts.filter(p => p.id !== deleteProduct.id))
              setFilteredProducts(filteredProducts.filter(p => p.id !== deleteProduct.id))
              alert(`Product "${deleteProduct?.productName}" deleted successfully!`)
              setDeleteProduct(null)
            } else {
              alert(`Failed to delete product: ${result.error}`)
            }
          } catch (err) {
            console.error('Error deleting product:', err)
            alert('Failed to delete product. Please try again.')
          }
        }}
        itemName={deleteProduct?.productName}
      />
    </Layout>
  )
}

export default Products

