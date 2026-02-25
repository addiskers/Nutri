import { useState, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import Layout from '../components/Layout/Layout'
import NoPermissionContent from '../components/NoPermissionContent'
import { Search, X, Table as TableIcon, BarChart3, Download, ChevronLeft, ChevronRight, Menu, Loader2, Filter, ChevronDown } from 'lucide-react'
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import authService, { productService } from '../services/api'

const Compare = () => {
  const hasPermission = authService.hasPermission('run_comparisons')
  const [selectedProducts, setSelectedProducts] = useState([])
  const [viewMode, setViewMode] = useState('table') // 'table' or 'charts'
  const [activeTab, setActiveTab] = useState('basic')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSidebar, setShowSidebar] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState({})
  const [filterBrand, setFilterBrand] = useState('All Brands')
  const [filterCategory, setFilterCategory] = useState('All Categories')
  const [showBrandFilter, setShowBrandFilter] = useState(false)
  const [showCategoryFilter, setShowCategoryFilter] = useState(false)

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
      if (window.innerWidth < 1024) {
        setShowSidebar(false)
      } else {
        setShowSidebar(true)
      }
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch all products from API
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true)
        const data = await productService.getProducts({ limit: 200 })
        if (data && data.products) {
          // Sort by created_at descending (newest first) and limit to 15
          const sorted = [...data.products].sort((a, b) => {
            const dateA = new Date(a.created_at || 0)
            const dateB = new Date(b.created_at || 0)
            return dateB - dateA
          }).slice(0, 15)
          setAllProducts(sorted)
        }
      } catch (error) {
        console.error('Failed to fetch products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])

  // Transform API product detail to comparison-friendly format
  const transformProduct = (p) => {
    // Parse ingredients string to array
    let ingredientsArr = []
    if (typeof p.ingredients === 'string' && p.ingredients) {
      ingredientsArr = p.ingredients.split(',').map(i => i.trim()).filter(Boolean)
    } else if (Array.isArray(p.ingredients)) {
      ingredientsArr = p.ingredients
    }

    // Parse allergens string to array
    let allergensArr = []
    if (typeof p.allergen_info === 'string' && p.allergen_info) {
      allergensArr = p.allergen_info.split(',').map(a => a.trim()).filter(Boolean)
    } else if (Array.isArray(p.allergen_info)) {
      allergensArr = p.allergen_info
    }

    // Parse nutrition_table to a keyed object
    const nutrition = {}
    if (Array.isArray(p.nutrition_table)) {
      p.nutrition_table.forEach(row => {
        const name = row.nutrient_name || row.nutrient
        if (name) {
          const vals = row.values || {}
          // Try to extract per100g, perServe, rda from values object
          const per100gKey = Object.keys(vals).find(k => k.toLowerCase().includes('100'))
          const perServeKey = Object.keys(vals).find(k => k.toLowerCase().includes('serve'))
          const rdaKey = Object.keys(vals).find(k => k.toLowerCase().includes('rda'))
          nutrition[name] = {
            per100g: per100gKey ? vals[per100gKey] : (row.per100g || null),
            perServe: perServeKey ? vals[perServeKey] : (row.perServe || null),
            rda: rdaKey ? vals[rdaKey] : (row.rda || null)
          }
        }
      })
    }

    // Extract manufacturer info
    let marketedBy = ''
    let manufacturedBy = ''
    let packedBy = ''
    let fssai = ''
    if (Array.isArray(p.manufacturer_details)) {
      p.manufacturer_details.forEach(m => {
        const type = (m.type || '').toLowerCase()
        const info = [m.name, m.address].filter(Boolean).join(', ')
        if (type.includes('market')) marketedBy = info
        else if (type.includes('manufactur')) manufacturedBy = info
        else if (type.includes('pack')) packedBy = info
        if (m.fssai && m.fssai !== 'not specified') fssai = fssai || m.fssai
      })
    }
    if (!fssai && Array.isArray(p.fssai_licenses) && p.fssai_licenses.length > 0) {
      fssai = p.fssai_licenses[0]
    }

    // Get first image
    const firstImage = (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : null

    return {
      id: p.id,
      firstImage,
      productName: p.product_name || '',
      brand: p.parent_brand || '',
      subBrand: p.sub_brand || '',
      variant: p.variant || '',
      packSize: p.net_weight || p.pack_size || '',
      serveSize: p.serving_size || '',
      mrp: p.mrp != null ? `₹${p.mrp}` : '',
      packingFormat: p.packing_format || '',
      manufactured: p.manufacturing_date || '',
      expiry: p.expiry_date || '',
      shelfLife: p.shelf_life || '',
      category: p.category || '',
      vegNonVeg: p.veg_nonveg || '',
      claims: Array.isArray(p.claims) ? p.claims : [],
      tags: Array.isArray(p.tags) ? p.tags : [],
      nutrition,
      ingredients: ingredientsArr,
      allergens: allergensArr,
      storageCondition: p.storage_instructions || '',
      instructionsToUse: p.instructions_to_use || '',
      marketedBy: marketedBy,
      manufacturedBy: manufacturedBy,
      packedBy: packedBy,
      fssai: fssai,
      barcode: p.barcode || '',
      otherNotes: p.customer_care ? (typeof p.customer_care === 'object' ? [p.customer_care.phone, p.customer_care.email, p.customer_care.website].filter(Boolean).join(', ') : '') : '',
    }
  }

  // Get unique brands and categories for filters
  const uniqueBrands = ['All Brands', ...new Set(allProducts.map(p => p.parent_brand).filter(Boolean).sort())]
  const uniqueCategories = ['All Categories', ...new Set(allProducts.map(p => p.category).filter(Boolean).sort())]

  const availableProducts = allProducts.filter(
    p => !selectedProducts.find(sp => sp.id === (p.id || p._id))
  )

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'composition', label: 'Composition' },
    { id: 'company', label: 'Company' }
  ]

  const handleProductSelect = async (product) => {
    if (selectedProducts.length >= 8) return
    const productId = product.id || product._id
    try {
      setLoadingDetails(prev => ({ ...prev, [productId]: true }))
      const fullProduct = await productService.getProduct(productId)
      if (fullProduct) {
        const transformed = transformProduct(fullProduct)
        setSelectedProducts(prev => [...prev, transformed])
      }
    } catch (error) {
      console.error('Failed to fetch product details:', error)
    } finally {
      setLoadingDetails(prev => ({ ...prev, [productId]: false }))
    }
  }

  const handleProductRemove = (productId) => {
    setSelectedProducts(selectedProducts.filter(p => p.id !== productId))
  }

  const handleExport = async () => {
    if (selectedProducts.length < 2) {
      alert('Please select at least 2 products to export.')
      return
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'NutriEyeQ'
    wb.created = new Date()

    // ---- Sheet 1: Product Info (Image + Basic + Composition + Company) ----
    const ws1 = wb.addWorksheet('Product Info')

    const sheet1Fields = [
      { label: 'Product Image', key: '_image', section: 'Product Image' },
      { label: 'Product Name', key: 'productName', section: 'Basic Information' },
      { label: 'Brand', key: 'brand' },
      { label: 'Sub Brand', key: 'subBrand' },
      { label: 'Variant', key: 'variant' },
      { label: 'Net Weight / Pack Size', key: 'packSize' },
      { label: 'Serve Size', key: 'serveSize' },
      { label: 'MRP', key: 'mrp' },
      { label: 'Packing Format', key: 'packingFormat' },
      { label: 'Manufacturing Date', key: 'manufactured' },
      { label: 'Expiry Date', key: 'expiry' },
      { label: 'Shelf Life', key: 'shelfLife' },
      { label: 'Category', key: 'category' },
      { label: 'Veg/Non-Veg', key: 'vegNonVeg' },
      { label: 'Claims on Pack', key: 'claims', isArray: true },
      { label: 'Tags', key: 'tags', isArray: true },
      { label: 'Ingredients', key: 'ingredients', section: 'Composition', isArray: true },
      { label: 'Allergens', key: 'allergens', isArray: true },
      { label: 'Shelf Life', key: 'shelfLife' },
      { label: 'Storage Condition', key: 'storageCondition' },
      { label: 'Instructions to Use', key: 'instructionsToUse' },
      { label: 'Marketed By', key: 'marketedBy', section: 'Company Information' },
      { label: 'Manufactured By', key: 'manufacturedBy' },
      { label: 'Packed By', key: 'packedBy' },
      { label: 'FSSAI License No.', key: 'fssai' },
      { label: 'Barcode', key: 'barcode' },
      { label: 'Other Notes', key: 'otherNotes' },
    ]

    // Set column widths
    ws1.getColumn(1).width = 28
    selectedProducts.forEach((_, i) => {
      ws1.getColumn(i + 2).width = 32
    })

    // Header row
    const headerRow = ws1.addRow(['Field', ...selectedProducts.map(p => p.productName)])
    headerRow.font = { bold: true, size: 11 }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    let currentSection = ''
    let imageRowNumber = null

    sheet1Fields.forEach(field => {
      // Section header
      if (field.section && field.section !== currentSection) {
        currentSection = field.section
        const sectionRow = ws1.addRow([`--- ${currentSection} ---`])
        sectionRow.font = { bold: true, color: { argb: 'FF6B7280' } }
        sectionRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      }

      if (field.key === '_image') {
        // Image row — add placeholder text, images added after
        const imgRow = ws1.addRow(['Product Image', ...selectedProducts.map(p => p.firstImage ? '' : 'No Image')])
        imgRow.height = 120
        imgRow.alignment = { vertical: 'middle', horizontal: 'center' }
        imgRow.font = { italic: true, color: { argb: 'FF9CA3AF' } }
        imageRowNumber = imgRow.number
      } else {
        const row = [field.label]
        selectedProducts.forEach(p => {
          const val = p[field.key]
          if (field.isArray) {
            row.push(Array.isArray(val) && val.length > 0 ? val.join(', ') : 'Not specified')
          } else {
            row.push(val || 'Not specified')
          }
        })
        const dataRow = ws1.addRow(row)
        dataRow.alignment = { vertical: 'middle', wrapText: true }
        // Bold the field label
        dataRow.getCell(1).font = { bold: true }
      }
    })

    // Embed images into the image row
    if (imageRowNumber) {
      selectedProducts.forEach((product, colIndex) => {
        if (product.firstImage) {
          try {
            // Extract base64 data and extension from data URL
            const match = product.firstImage.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/)
            if (match) {
              const ext = match[1] === 'jpg' ? 'jpeg' : match[1]
              const base64Data = match[2]
              const imageId = wb.addImage({ base64: base64Data, extension: ext })
              ws1.addImage(imageId, {
                tl: { col: colIndex + 1, row: imageRowNumber - 1 },
                ext: { width: 140, height: 110 },
              })
            }
          } catch (e) {
            console.warn('Could not embed image for', product.productName, e)
          }
        }
      })
    }

    // ---- Sheet 2: Nutrition ----
    const ws2 = wb.addWorksheet('Nutrition')
    const allNutrients = [...new Set(selectedProducts.flatMap(p => Object.keys(p.nutrition || {})))]

    ws2.getColumn(1).width = 28
    selectedProducts.forEach((_, i) => {
      ws2.getColumn(i + 2).width = 32
    })

    // Header
    const nutHeaderRow = ws2.addRow(['Nutrient', ...selectedProducts.map(p => p.productName)])
    nutHeaderRow.font = { bold: true, size: 11 }
    nutHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }
    nutHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    // Sub-header
    const subHeaderRow = ws2.addRow(['', ...selectedProducts.map(() => 'Per 100g / Per Serve / %RDA')])
    subHeaderRow.font = { italic: true, size: 10, color: { argb: 'FF6B7280' } }
    subHeaderRow.alignment = { horizontal: 'center' }

    allNutrients.forEach(nutrient => {
      const row = [nutrient]
      selectedProducts.forEach(p => {
        const data = p.nutrition?.[nutrient]
        if (data) {
          row.push(`${data.per100g || '-'} / ${data.perServe || '-'} / ${data.rda || '-'}`)
        } else {
          row.push('Not specified')
        }
      })
      const dataRow = ws2.addRow(row)
      dataRow.getCell(1).font = { bold: true }
      dataRow.alignment = { vertical: 'middle', wrapText: true }
    })

    // Download
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `Product_Comparison_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Light background colors for each product column
  const getProductColumnColor = (index) => {
    const colors = [
      'bg-blue-50/50',      // Light blue
      'bg-green-50/50',     // Light green
      'bg-purple-50/50',    // Light purple
      'bg-amber-50/50',     // Light amber
      'bg-pink-50/50',      // Light pink
      'bg-teal-50/50',      // Light teal
      'bg-orange-50/50',    // Light orange
      'bg-indigo-50/50'     // Light indigo
    ]
    return colors[index % colors.length]
  }

  const getHighlightClass = (value, fieldValues) => {
    if (!value || value === 'Not specified' || value === null) {
      return 'text-gray-500'
    }

    const numValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
    if (isNaN(numValue)) return ''

    const allNums = fieldValues
      .map(v => parseFloat(v?.toString().replace(/[^0-9.-]/g, '')))
      .filter(v => !isNaN(v))

    if (allNums.length < 2) return ''

    const max = Math.max(...allNums)
    const min = Math.min(...allNums)

    if (numValue === max) {
      return 'font-semibold text-green-700'
    }
    if (numValue === min && allNums.length > 2) {
      return 'text-yellow-700'
    }

    return ''
  }

  // Prepare radar chart data - try multiple key formats from standardized API
  const nutrientKeyMap = {
    'Protein': ['Protein', 'Protein (g)'],
    'Carbs': ['Total Carbohydrates', 'Carbohydrates (g)', 'Carbohydrate (g)'],
    'Sugar': ['Total Sugars', 'Sugar (g)', 'Added Sugars'],
    'Fiber': ['Dietary Fiber', 'Fiber (g)'],
    'Fat': ['Total Fat', 'Fat (g)']
  }
  const radarData = Object.entries(nutrientKeyMap).map(([label, keys]) => {
    const dataPoint = { nutrient: label }
    selectedProducts.forEach(product => {
      let value = null
      for (const key of keys) {
        if (product.nutrition?.[key]?.per100g) {
          value = product.nutrition[key].per100g
          break
        }
      }
      dataPoint[product.productName] = parseFloat(value) || 0
    })
    return dataPoint
  })

  // Prepare bar chart data (Price per serve)
  const priceData = selectedProducts.map(product => ({
    name: product.productName.substring(0, 15) + '...',
    price: parseFloat(product.mrp?.replace(/[^0-9.-]/g, '')) || 0
  }))

  return (
    <Layout>
      {!hasPermission ? (
        <NoPermissionContent pageName="Compare Page" />
      ) : (
        <div className="flex h-full relative">
          {/* Main Content */}
          <div className={`flex flex-col overflow-hidden transition-all duration-300 ${showSidebar ? 'flex-1' : 'w-full'}`}>
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-[#e1e7ef] bg-white">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
                    Product Comparison
                </h1>
                <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
                  Compare products side-by-side across all standardized fields
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm transition-colors ${
                    viewMode === 'table'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-[#65758b] hover:bg-gray-200'
                  }`}
                >
                  <TableIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  onClick={() => setViewMode('charts')}
                  className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm transition-colors ${
                    viewMode === 'charts'
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-[#65758b] hover:bg-gray-200'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Charts</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-md bg-gray-100 text-[#65758b] hover:bg-gray-200 font-ibm-plex font-medium text-xs md:text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-md bg-primary text-white hover:bg-primary/90 font-ibm-plex font-medium text-xs md:text-sm transition-colors"
                  title={showSidebar ? 'Hide product selector' : 'Show product selector'}
                >
                  {isMobile ? (
                    <Menu className="w-4 h-4" />
                  ) : showSidebar ? (
                    <>
                      <ChevronRight className="w-4 h-4" />
                      <span className="hidden md:inline">Hide</span>
                    </>
                  ) : (
                    <>
                      <ChevronLeft className="w-4 h-4" />
                      <span className="hidden md:inline">Select Products</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Tabs */}
            {viewMode === 'table' && (
              <div className="bg-[#f3f3f3] rounded-md p-1 overflow-x-auto">
                <div className="flex gap-1 min-w-max sm:min-w-0">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 px-3 md:px-4 py-2 rounded text-xs md:text-sm font-ibm-plex font-medium transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-white text-[#0f1729] shadow-sm'
                          : 'text-[#65758b] hover:text-[#0f1729]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {selectedProducts.length < 2 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-lg font-ibm-plex text-[#65758b]">
                    Select at least 2 products to start comparing
                  </p>
                </div>
              </div>
            ) : viewMode === 'charts' ? (
              /* Charts View */
              <div className="space-y-4 md:space-y-6">
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                    Nutrition Profile Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={300} className="md:hidden">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: 10 }} />
                      {selectedProducts.map((product, index) => (
                        <Radar
                          key={product.id}
                          name={product.productName}
                          dataKey={product.productName}
                          stroke={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]}
                          fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]}
                          fillOpacity={0.3}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                  <ResponsiveContainer width="100%" height={400} className="hidden md:block">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="nutrient" />
                      {selectedProducts.map((product, index) => (
                        <Radar
                          key={product.id}
                          name={product.productName}
                          dataKey={product.productName}
                          stroke={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]}
                          fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444'][index % 4]}
                          fillOpacity={0.3}
                        />
                      ))}
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      Key Nutrients (per 100g)
                    </h3>
                    <ResponsiveContainer width="100%" height={250} className="md:hidden">
                      <BarChart data={selectedProducts.map(p => {
                        const getVal = (keys) => { for (const k of keys) { if (p.nutrition?.[k]?.per100g) return parseFloat(p.nutrition[k].per100g) || 0 } return 0 }
                        return {
                          name: p.productName.substring(0, 10),
                          Protein: getVal(['Protein', 'Protein (g)']),
                          Sugar: getVal(['Total Sugars', 'Sugar (g)', 'Added Sugars'])
                        }
                      })}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="Protein" fill="#2563eb" />
                        <Bar dataKey="Sugar" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={300} className="hidden md:block">
                      <BarChart data={selectedProducts.map(p => {
                        const getVal = (keys) => { for (const k of keys) { if (p.nutrition?.[k]?.per100g) return parseFloat(p.nutrition[k].per100g) || 0 } return 0 }
                        return {
                          name: p.productName.substring(0, 12),
                          Protein: getVal(['Protein', 'Protein (g)']),
                          Sugar: getVal(['Total Sugars', 'Sugar (g)', 'Added Sugars'])
                        }
                      })}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="Protein" fill="#2563eb" />
                        <Bar dataKey="Sugar" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      Price per Serve (₹)
                    </h3>
                    <ResponsiveContainer width="100%" height={250} className="md:hidden">
                      <BarChart data={priceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="price" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={300} className="hidden md:block">
                      <BarChart data={priceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="price" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              /* Table View */
              <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden">
                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 md:px-0">
                    <table className="min-w-full">
                      <thead className="bg-[#f1f5f9] border-b border-[#e1e7ef] sticky top-0 z-10">
                        <tr>
                          <th className="px-2 md:px-4 py-2 md:py-3 text-left min-w-[120px] md:min-w-[200px] bg-[#f1f5f9] sticky left-0 z-20">
                            <span className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729]">
                              Field
                            </span>
                          </th>
                          {selectedProducts.map((product, index) => (
                            <th key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-left min-w-[150px] md:min-w-[200px] ${getProductColumnColor(index)}`}>
                              <span className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] line-clamp-2">
                                {product.productName}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e1e7ef]">
                        {/* Basic Tab */}
                        {activeTab === 'basic' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Basic Information</span></td></tr>
                            {[
                              { label: 'Product Name', key: 'productName' },
                              { label: 'Brand', key: 'brand' },
                              { label: 'Sub Brand', key: 'subBrand' },
                              { label: 'Variant', key: 'variant' },
                              { label: 'Net Weight / Pack Size', key: 'packSize' },
                              { label: 'Serve Size', key: 'serveSize' },
                              { label: 'MRP (₹)', key: 'mrp' },
                              { label: 'Packing Format', key: 'packingFormat' },
                              { label: 'Manufacturing Date', key: 'manufactured' },
                              { label: 'Expiry Date', key: 'expiry' },
                              { label: 'Shelf Life', key: 'shelfLife' },
                              { label: 'Category', key: 'category' },
                              { label: 'Veg/Non-Veg', key: 'vegNonVeg' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => {
                                  const value = product[field.key] || 'Not specified'
                                  const allValues = selectedProducts.map(p => p[field.key])
                                  return (
                                    <td
                                      key={product.id}
                                      className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)} ${getHighlightClass(value, allValues, field.key)}`}
                                    >
                                      <div className="line-clamp-3">{value}</div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                            {/* Claims on Pack */}
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Claims on Pack
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="line-clamp-4">{product.claims?.length > 0 ? product.claims.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            {/* Tags */}
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Tags
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="line-clamp-3">{product.tags?.length > 0 ? product.tags.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                          </>
                        )}

                        {/* Nutrition Tab */}
                        {activeTab === 'nutrition' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Nutrient (per 100g / serve / %RDA)</span></td></tr>
                            {[...new Set(selectedProducts.flatMap(p => Object.keys(p.nutrition || {})))].map((nutrient) => (
                              <tr key={nutrient}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {nutrient}
                                </td>
                                {selectedProducts.map((product, index) => {
                                  const data = product.nutrition?.[nutrient]
                                  const value = data ? `${data.per100g || '-'} / ${data.perServe || '-'} / ${data.rda || '-'}` : 'Not specified'
                                  const per100gValues = selectedProducts.map(p => p.nutrition?.[nutrient]?.per100g)
                                  return (
                                    <td
                                      key={product.id}
                                      className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)} ${getHighlightClass(data?.per100g, per100gValues, 'nutrition')}`}
                                    >
                                      <div className="line-clamp-2">{value}</div>
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </>
                        )}

                        {/* Composition Tab */}
                        {activeTab === 'composition' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Ingredients</span></td></tr>
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Ingredients
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="line-clamp-6">{product.ingredients?.length > 0 ? product.ingredients.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Allergens</span></td></tr>
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Allergens
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="line-clamp-3">{product.allergens?.length > 0 ? product.allergens.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Storage & Usage</span></td></tr>
                            {[
                              { label: 'Shelf Life', key: 'shelfLife' },
                              { label: 'Storage Condition', key: 'storageCondition' },
                              { label: 'Instructions to Use', key: 'instructionsToUse' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="line-clamp-4">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </>
                        )}

                        {/* Company Tab */}
                        {activeTab === 'company' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Company Information</span></td></tr>
                            {[
                              { label: 'Marketed By', key: 'marketedBy' },
                              { label: 'Manufactured By', key: 'manufacturedBy' },
                              { label: 'Packed By', key: 'packedBy' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="line-clamp-4">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Regulatory Information</span></td></tr>
                            {[
                              { label: 'FSSAI License No.', key: 'fssai' },
                              { label: 'Barcode', key: 'barcode' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="line-clamp-2">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Additional Notes</span></td></tr>
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Other Notes
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="line-clamp-4">{product.otherNotes || 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Overlay for mobile */}
        {isMobile && showSidebar && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Right Sidebar - Product Selector */}
        {(showSidebar || isMobile) && (
          <div className={`
            ${isMobile ? `fixed right-0 top-0 h-full z-50 w-full max-w-sm shadow-2xl ${showSidebar ? 'translate-x-0' : 'translate-x-full'}` : 'w-80 border-l'}
            border-[#e1e7ef] bg-white p-4 md:p-6 overflow-y-auto transition-all duration-300 ease-in-out
          `}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
              Select Products to Compare
            </h3>
            {isMobile && (
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#65758b]" />
              </button>
            )}
          </div>

          {/* Selected Products */}
          {selectedProducts.length > 0 && (
            <div className="mb-4 space-y-2">
              {selectedProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-md px-3 py-2"
                >
                  <span className="text-sm font-ibm-plex text-[#0f1729] font-medium truncate mr-2">
                    {product.productName}
                  </span>
                  <button
                    onClick={() => handleProductRemove(product.id)}
                    className="hover:bg-primary/20 rounded-full p-1 flex-shrink-0"
                  >
                    <X className="w-4 h-4 text-[#0f1729]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#65758b]" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Brand & Category Filters */}
          <div className="flex gap-2 mb-3">
            {/* Brand Filter */}
            <div className="relative flex-1">
              <button
                onClick={() => {
                  setShowBrandFilter(!showBrandFilter)
                  setShowCategoryFilter(false)
                }}
                className="w-full bg-[#f9fafb] border border-[#e1e7ef] h-9 px-3 rounded-md flex items-center gap-2 hover:bg-gray-100 transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-[#65758b] flex-shrink-0" />
                <span className="text-xs font-ibm-plex text-[#0f1729] flex-1 text-left truncate">
                  {filterBrand}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#65758b] transition-transform flex-shrink-0 ${showBrandFilter ? 'rotate-180' : ''}`} />
              </button>
              {showBrandFilter && (
                <div className="absolute top-10 left-0 w-full bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {uniqueBrands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => {
                        setFilterBrand(brand)
                        setShowBrandFilter(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-ibm-plex hover:bg-gray-50 transition-colors ${
                        filterBrand === brand
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
            <div className="relative flex-1">
              <button
                onClick={() => {
                  setShowCategoryFilter(!showCategoryFilter)
                  setShowBrandFilter(false)
                }}
                className="w-full bg-[#f9fafb] border border-[#e1e7ef] h-9 px-3 rounded-md flex items-center gap-2 hover:bg-gray-100 transition-colors"
              >
                <Filter className="w-3.5 h-3.5 text-[#65758b] flex-shrink-0" />
                <span className="text-xs font-ibm-plex text-[#0f1729] flex-1 text-left truncate">
                  {filterCategory}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-[#65758b] transition-transform flex-shrink-0 ${showCategoryFilter ? 'rotate-180' : ''}`} />
              </button>
              {showCategoryFilter && (
                <div className="absolute top-10 left-0 w-full bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {uniqueCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setFilterCategory(cat)
                        setShowCategoryFilter(false)
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-ibm-plex hover:bg-gray-50 transition-colors ${
                        filterCategory === cat
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-[#0f1729]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="text-xs font-ibm-plex text-[#65758b] mb-3">
            {selectedProducts.length >= 8 
              ? 'Maximum 8 products selected' 
              : `Select ${8 - selectedProducts.length} more product${8 - selectedProducts.length !== 1 ? 's' : ''} (max 8)`}
          </p>

          {/* Available Products */}
          <div className="space-y-2">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="ml-2 text-sm text-[#65758b]">Loading products...</span>
              </div>
            ) : availableProducts
              .filter(p => {
                const name = p.product_name || ''
                const brand = p.parent_brand || ''
                const category = p.category || ''
                // Search filter
                const matchesSearch = searchQuery === '' ||
                  name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  brand.toLowerCase().includes(searchQuery.toLowerCase())
                // Brand filter
                const matchesBrand = filterBrand === 'All Brands' || brand === filterBrand
                // Category filter
                const matchesCategory = filterCategory === 'All Categories' || category === filterCategory
                return matchesSearch && matchesBrand && matchesCategory
              })
              .map((product) => {
                const productId = product.id || product._id
                const isLoading = loadingDetails[productId]
                return (
                  <label
                    key={productId}
                    className={`flex items-start gap-3 p-3 border border-[#e1e7ef] rounded-md hover:bg-gray-50 cursor-pointer transition-colors ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mt-1 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => handleProductSelect(product)}
                        disabled={selectedProducts.length >= 8}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-ibm-plex font-medium text-[#0f1729] truncate">
                        {product.product_name}
                      </p>
                      <p className="text-xs font-ibm-plex text-[#65758b] truncate">
                        {product.parent_brand}{product.category ? ` • ${product.category}` : ''}{product.net_weight ? ` • ${product.net_weight}` : ''}{product.mrp != null ? ` • ₹${product.mrp}` : ''}
                      </p>
                    </div>
                  </label>
                )
              })}
          </div>

          {/* Highlight Legend */}
          <div className="mt-6 pt-6 border-t border-[#e1e7ef]">
            <h4 className="text-sm font-ibm-plex font-semibold text-[#0f1729] mb-3">
              Highlight Legend
            </h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
                <span className="text-xs font-ibm-plex text-[#65758b]">
                  Best value / Superior
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
                <span className="text-xs font-ibm-plex text-[#65758b]">
                  Different from others
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                <span className="text-xs font-ibm-plex text-[#65758b]">
                  Not specified
                </span>
              </div>
            </div>
          </div>
          </div>
        )}
      </div>
      )}
    </Layout>
  )
}

const getHighlightClass = (value, allValues, field) => {
  if (!value || value === 'Not specified' || value === null) {
    return 'bg-gray-50 text-gray-500'
  }

  // For text fields, check if all values are the same
  const uniqueValues = [...new Set(allValues.filter(v => v && v !== 'Not specified'))]
  
  if (uniqueValues.length === 1) return '' // All same, no highlighting

  // For numeric fields, highlight best value
  const numValue = parseFloat(value.toString().replace(/[^0-9.-]/g, ''))
  if (!isNaN(numValue)) {
    const allNums = allValues
      .map(v => parseFloat(v?.toString().replace(/[^0-9.-]/g, '')))
      .filter(v => !isNaN(v))

    if (allNums.length > 1) {
      const max = Math.max(...allNums)
      const min = Math.min(...allNums)

      // For price, lower is better
      if (field === 'mrp' && numValue === min) {
        return 'bg-green-50 text-green-700 font-medium'
      }
      // For nutrients, higher is better
      if (field !== 'mrp' && numValue === max) {
        return 'bg-green-50 text-green-700 font-medium'
      }
      // Different but not best
      return 'bg-yellow-50 text-yellow-700'
    }
  }

  return ''
}

export default Compare


