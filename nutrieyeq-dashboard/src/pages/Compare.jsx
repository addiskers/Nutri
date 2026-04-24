import { useState, useEffect } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import Layout from '../components/Layout/Layout'
import NoPermissionContent from '../components/NoPermissionContent'
import { Search, X, Table as TableIcon, BarChart3, Download, ChevronLeft, ChevronRight, Menu, Loader2, Filter, ChevronDown, ImageOff, ZoomIn } from 'lucide-react'
import ProductPreviewModal from '../components/Modals/ProductPreviewModal'
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
  const [previewProduct, setPreviewProduct] = useState(null)
  const [imageIndices, setImageIndices] = useState({})

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

    // Parse allergens — new schema uses allergen_information
    const allergenRaw = p.allergen_information || p.allergen_info || ''
    let allergensArr = []
    if (typeof allergenRaw === 'string' && allergenRaw) {
      allergensArr = allergenRaw.split(',').map(a => a.trim()).filter(Boolean)
    } else if (Array.isArray(allergenRaw)) {
      allergensArr = allergenRaw
    }

    // Parse nutrition_table — use nutrient_name (standardized/mapped) as the key
    // so "Energy^" and "Energy" both merge under "Energy (kcal)"
    const nutritionRows = []
    if (Array.isArray(p.nutrition_table)) {
      p.nutrition_table.forEach(row => {
        const stdName = row.nutrient_name || row.nutrient || ''
        let name = stdName
        let unit = row.unit || ''
        if (name) {
          if (unit) {
            const suffix = ` (${unit})`
            if (name.toLowerCase().endsWith(suffix.toLowerCase())) name = name.slice(0, -suffix.length)
          } else {
            const match = name.match(/^(.+?)\s*\(([^)]+)\)$/)
            if (match) { name = match[1].trim(); unit = match[2].trim() }
          }
          const existing = nutritionRows.find(r => r.nutrient === name)
          if (existing) {
            Object.assign(existing.values, row.values || {})
          } else {
            nutritionRows.push({ nutrient: name, stdName: stdName || name, unit, values: row.values || {} })
          }
        }
      })
    }
    const nutritionNotes = Array.isArray(p.nutrition_notes) ? p.nutrition_notes : []

    // Extract manufacturer info — support multiple entries per type
    const marketed = [], manufactured = [], packed = []
    const mfrs = p.manufacturer_information || p.manufacturer_details || []
    if (Array.isArray(mfrs)) {
      mfrs.forEach(m => {
        const type = (m.type || '').toLowerCase()
        const parts = [m.name, m.address, m.license_number ? `License: ${m.license_number}` : ''].filter(Boolean)
        const info = parts.join('\n')
        if (type.includes('market')) marketed.push(info)
        else if (type.includes('manufactur')) manufactured.push(info)
        else if (type.includes('pack')) packed.push(info)
      })
    }

    // FSSAI
    const fssaiInfo = p.fssai_information || {}
    const fssaiNumbers = Array.isArray(fssaiInfo.license_numbers) ? fssaiInfo.license_numbers : (Array.isArray(p.fssai_licenses) ? p.fssai_licenses : [])

    // Usage instructions
    const usage = p.usage_instructions || {}
    const directionsToUse = Array.isArray(usage.directions_to_use) ? usage.directions_to_use.join('\n') : ''
    const preparationMethod = Array.isArray(usage.preparation_method) ? usage.preparation_method.join('\n') : ''

    // Medical information
    const medical = p.medical_information || {}
    const warnings = Array.isArray(medical.warnings) ? medical.warnings.join('\n') : ''

    // Storage
    const storageArr = Array.isArray(p.storage_instructions) ? p.storage_instructions : (typeof p.storage_instructions === 'string' ? [p.storage_instructions] : [])

    // Batch
    const batch = p.batch_information || {}
    // Packaging
    const packaging = p.packaging_information || {}
    // Customer care
    const cc = p.customer_care || {}

    // Get first image
    const firstImage = (Array.isArray(p.images) && p.images.length > 0) ? p.images[0] : null

    return {
      id: p.id,
      firstImage,
      images: Array.isArray(p.images) ? p.images : [],
      productName: p.product_name || '',
      brand: p.parent_brand || '',
      subBrand: p.sub_brand || '',
      variant: p.variant || '',
      packSize: p.net_quantity || p.pack_size || p.net_weight || '',
      serveSize: p.serving_size || '',
      servingsPerPack: p.servings_per_pack || '',
      mrp: p.mrp != null ? `₹${p.mrp}` : '',
      uspf: p.uspf || '',
      packingFormat: p.packing_format || '',
      manufactured: p.manufacturing_date || '',
      expiry: p.expiry_date || '',
      shelfLife: p.shelf_life || '',
      category: p.category || '',
      vegNonVeg: p.veg_nonveg || '',
      claims: Array.isArray(p.claims) ? p.claims : [],
      // Nutrition
      nutritionRows,
      nutritionNotes,
      // Composition
      ingredients: ingredientsArr,
      allergens: allergensArr,
      // Storage & Usage
      storageCondition: storageArr.join('\n'),
      directionsToUse,
      preparationMethod,
      // Medical
      warnings,
      // Company
      brandOwner: p.brand_owner || '',
      marketedBy: marketed.join('\n\n'),
      manufacturedBy: manufactured.join('\n\n'),
      packedBy: packed.join('\n\n'),
      // Batch
      lotNumber: batch.lot_number || '',
      machineCode: batch.machine_code || '',
      otherCodes: Array.isArray(batch.other_codes) ? batch.other_codes.join('\n') : '',
      // Packaging
      packagingManufacturer: packaging.packaging_material_manufacturer || '',
      packagingCodes: Array.isArray(packaging.packaging_codes) ? packaging.packaging_codes.join('\n') : '',
      // Regulatory
      fssaiNumbers,
      barcodes: Array.isArray(p.barcodes) ? p.barcodes : (p.barcode ? [p.barcode] : []),
      certifications: Array.isArray(p.certifications) ? p.certifications : [],
      // Customer Care
      customerCarePhone: Array.isArray(cc.phone) ? cc.phone.join(', ') : (cc.phone || ''),
      customerCareEmail: cc.email || '',
      customerCareWebsite: cc.website || '',
      customerCareAddress: cc.address || '',
      // Additional Notes
      regulatoryText: Array.isArray(p.regulatory_text) ? p.regulatory_text.join('\n') : '',
      otherImportantText: Array.isArray(p.other_important_text) ? p.other_important_text.join('\n') : '',
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
      { label: 'Servings Per Pack', key: 'servingsPerPack' },
      { label: 'MRP', key: 'mrp' },
      { label: 'USPF', key: 'uspf' },
      { label: 'Packing Format', key: 'packingFormat' },
      { label: 'Manufacturing Date', key: 'manufactured' },
      { label: 'Expiry Date', key: 'expiry' },
      { label: 'Shelf Life', key: 'shelfLife' },
      { label: 'Category', key: 'category' },
      { label: 'Veg/Non-Veg', key: 'vegNonVeg' },
      { label: 'Claims on Pack', key: 'claims', isArray: true },
      { label: 'Ingredients', key: 'ingredients', section: 'Composition', isArray: true },
      { label: 'Allergens', key: 'allergens', isArray: true },
      { label: 'Storage Condition', key: 'storageCondition', section: 'Storage & Usage' },
      { label: 'Directions to Use', key: 'directionsToUse' },
      { label: 'Preparation Method', key: 'preparationMethod' },
      { label: 'Warnings', key: 'warnings', section: 'Medical Information' },
      { label: 'Brand Owner', key: 'brandOwner', section: 'Company Information' },
      { label: 'Marketed By', key: 'marketedBy' },
      { label: 'Manufactured By', key: 'manufacturedBy' },
      { label: 'Packed By', key: 'packedBy' },
      { label: 'Lot / Batch Number', key: 'lotNumber', section: 'Batch Information' },
      { label: 'Machine Code', key: 'machineCode' },
      { label: 'Other Codes', key: 'otherCodes' },
      { label: 'Packaging Manufacturer', key: 'packagingManufacturer', section: 'Packaging Information' },
      { label: 'Packaging Codes', key: 'packagingCodes' },
      { label: 'FSSAI License No.', key: 'fssaiNumbers', section: 'Regulatory Information', isArray: true },
      { label: 'Barcodes / EAN', key: 'barcodes', isArray: true },
      { label: 'Certifications', key: 'certifications', isArray: true },
      { label: 'Phone', key: 'customerCarePhone', section: 'Customer Care' },
      { label: 'Email', key: 'customerCareEmail' },
      { label: 'Website', key: 'customerCareWebsite' },
      { label: 'Address', key: 'customerCareAddress' },
      { label: 'Regulatory Text', key: 'regulatoryText', section: 'Additional Notes' },
      { label: 'Other Important Text', key: 'otherImportantText' },
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

    // Embed images into the image row — use the currently visible image (from carousel)
    if (imageRowNumber) {
      for (let colIndex = 0; colIndex < selectedProducts.length; colIndex++) {
        const product = selectedProducts[colIndex]
        const imgs = product.images || []
        const visibleIdx = imageIndices[product.id] || 0
        const imgUrl = imgs[visibleIdx] || product.firstImage
        if (!imgUrl) continue
        try {
          let base64Data, ext
          const dataUrlMatch = imgUrl.match(/^data:image\/(png|jpeg|jpg|gif);base64,(.+)$/)
          if (dataUrlMatch) {
            ext = dataUrlMatch[1] === 'jpg' ? 'jpeg' : dataUrlMatch[1]
            base64Data = dataUrlMatch[2]
          } else if (/^https?:\/\//i.test(imgUrl) && (imgUrl.startsWith(window.location.origin) || imgUrl.startsWith('https://'))) {
            const resp = await fetch(imgUrl)
            const blob = await resp.blob()
            if (!blob.type.startsWith('image/')) continue
            const arrayBuf = await blob.arrayBuffer()
            const bytes = new Uint8Array(arrayBuf)
            let binary = ''
            bytes.forEach(b => binary += String.fromCharCode(b))
            base64Data = btoa(binary)
            ext = blob.type.includes('png') ? 'png' : 'jpeg'
          } else {
            continue
          }
          const imageId = wb.addImage({ base64: base64Data, extension: ext })
          ws1.addImage(imageId, {
            tl: { col: colIndex + 1, row: imageRowNumber - 1 },
            ext: { width: 140, height: 110 },
          })
        } catch (e) {
          console.warn('Could not embed image for', product.productName, e)
        }
      }
    }

    // ---- Sheet 2: Nutrition ----
    const ws2 = wb.addWorksheet('Nutrition')

    const exportNutrients = [...new Set(
      selectedProducts.flatMap(p =>
        (p.nutritionRows || []).map(r => r.nutrient)
      )
    )]

    ws2.getColumn(1).width = 28
    selectedProducts.forEach((_, i) => {
      ws2.getColumn(i + 2).width = 36
    })

    // Nutrition Notes section
    const notesHeaderRow = ws2.addRow(['Nutrition Notes', ...selectedProducts.map(p => p.productName)])
    notesHeaderRow.font = { bold: true, size: 11 }
    notesHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }
    notesHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    const notesRow = ws2.addRow(['Notes', ...selectedProducts.map(p => p.nutritionNotes?.length > 0 ? p.nutritionNotes.join('\n') : 'Not specified')])
    notesRow.getCell(1).font = { bold: true }
    notesRow.alignment = { vertical: 'middle', wrapText: true }

    // Blank separator
    ws2.addRow([])

    // Header
    const nutHeaderRow = ws2.addRow(['Nutrient', ...selectedProducts.map(p => p.productName)])
    nutHeaderRow.font = { bold: true, size: 11 }
    nutHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }
    nutHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

    exportNutrients.forEach(nutrient => {
      const row = [nutrient]
      selectedProducts.forEach(p => {
        const r = (p.nutritionRows || []).find(r2 => r2.nutrient === nutrient)
        if (!r) { row.push('—'); return }
        const unit = r.unit || ''
        const vals = r.values || {}
        const lines = []
        if (unit) lines.push(`[${unit}]`)
        Object.entries(vals).forEach(([colName, val]) => {
          if (val && val !== '-' && val !== 'not specified') {
            lines.push(`${colName}: ${val}`)
          }
        })
        row.push(lines.length > 0 ? lines.join('\n') : '—')
      })
      const dataRow = ws2.addRow(row)
      dataRow.getCell(1).font = { bold: true }
      dataRow.alignment = { vertical: 'top', wrapText: true }
      // Auto-height: count max lines across all product cells for this nutrient
      const maxLines = Math.max(...row.slice(1).map(cell => (cell || '').split('\n').length), 1)
      dataRow.height = Math.max(30, maxLines * 16)
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

    return ''
  }

  // Helper: parse a nutrition value string to a number, stripping <, >, ~ prefixes and non-numeric chars
  const parseNutritionNum = (val) => {
    if (!val || val === '-' || val === 'NA' || val === 'not specified') return NaN
    // Strip leading < > ~ ≈ and any spaces, then parse
    const cleaned = val.toString().replace(/^[<>~≈\s]+/, '').replace(/[^0-9.-]/g, '')
    return parseFloat(cleaned)
  }

  // Helper: find first numeric value from a product's nutrition rows matching any of the given nutrient names
  // Matches against both stdName (standardized from DB) and nutrient (original display name)
  // For charts: treats all "per 100g" / "Approx. per 100 g" / "Per 100 g" keys as equivalent
  const findNutrientValue = (product, names) => {
    for (const name of names) {
      const lc = name.toLowerCase()
      const row = (product.nutritionRows || []).find(r =>
        r.stdName?.toLowerCase() === lc || r.nutrient?.toLowerCase() === lc
      )
      if (row) {
        const vals = row.values || {}
        // Find any key containing "100" (per 100g in any format)
        const per100Key = Object.keys(vals).find(k => k.toLowerCase().replace(/\s/g, '').includes('100'))
        const key = per100Key || Object.keys(vals)[0]
        if (key && vals[key]) {
          const num = parseNutritionNum(vals[key])
          if (!isNaN(num)) return num
        }
      }
    }
    return 0
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
      dataPoint[product.productName] = findNutrientValue(product, keys)
    })
    return dataPoint
  })


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
                {/* Radar — Nutrition Profile */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                    Nutrition Profile Comparison
                  </h3>
                  <ResponsiveContainer width="100%" height={isMobile ? 300 : 400}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="nutrient" tick={{ fontSize: isMobile ? 10 : 12 }} />
                      {selectedProducts.map((product, index) => (
                        <Radar
                          key={product.id}
                          name={product.productName}
                          dataKey={product.productName}
                          stroke={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][index % 8]}
                          fill={['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'][index % 8]}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                  {/* Energy (kcal) Comparison */}
                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      Energy (kcal per 100g)
                    </h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <BarChart data={selectedProducts.map(p => ({
                          name: p.productName.substring(0, isMobile ? 10 : 15),
                          Energy: findNutrientValue(p, ['Energy', 'Energy (kcal)', 'Calories'])
                        }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <Tooltip />
                        <Bar dataKey="Energy" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* MRP Comparison */}
                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      MRP Comparison (₹)
                    </h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <BarChart data={selectedProducts.map(p => ({
                          name: p.productName.substring(0, isMobile ? 10 : 15),
                          MRP: parseFloat(p.mrp?.replace(/[^0-9.-]/g, '')) || 0
                        }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <Tooltip formatter={(value) => [`₹${value}`, 'MRP']} />
                        <Bar dataKey="MRP" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Sugar vs Protein */}
                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      Sugar vs Protein (g per 100g)
                    </h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <BarChart data={selectedProducts.map(p => ({
                          name: p.productName.substring(0, isMobile ? 10 : 15),
                          Protein: findNutrientValue(p, ['Protein', 'Protein (g)']),
                          Sugar: findNutrientValue(p, ['Total Sugars', 'Sugar (g)', 'Added Sugars']),
                          'Added Sugar': findNutrientValue(p, ['Added Sugars', 'Added Sugar (g)'])
                        }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                        <Bar dataKey="Protein" fill="#2563eb" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Sugar" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Added Sugar" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Sodium & Cholesterol */}
                  <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                    <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 md:mb-6">
                      Sodium & Cholesterol (per 100g)
                    </h3>
                    <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
                      <BarChart data={selectedProducts.map(p => ({
                          name: p.productName.substring(0, isMobile ? 10 : 15),
                          'Sodium (mg)': findNutrientValue(p, ['Sodium', 'Sodium (mg)']),
                          'Cholesterol (mg)': findNutrientValue(p, ['Cholesterol', 'Cholesterol (mg)'])
                        }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12 }} />
                        <Bar dataKey="Sodium (mg)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Cholesterol (mg)" fill="#ec4899" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              /* Table View */
              <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden">
                {/* ═══ Product Image Carousel Row ═══ */}
                <div className="overflow-x-auto -mx-4 md:mx-0 border-b border-[#e1e7ef]">
                  <div className="inline-block min-w-full align-middle px-4 md:px-0">
                    <table className="min-w-full">
                      <tbody>
                        <tr>
                          <td className="px-2 md:px-4 py-3 min-w-[120px] md:min-w-[200px] align-middle sticky left-0 bg-white z-10">
                            <span className="text-xs md:text-sm font-ibm-plex font-medium text-[#65758b] uppercase">Product Images</span>
                          </td>
                          {selectedProducts.map((product, index) => {
                            const imgs = product.images || []
                            const idx = imageIndices[product.id] || 0
                            return (
                              <td key={product.id} className={`px-2 md:px-4 py-3 min-w-[150px] md:min-w-[200px] max-w-[200px] md:max-w-[240px] text-center overflow-hidden ${getProductColumnColor(index)}`}>
                                {imgs.length > 0 ? (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <div className="flex items-center justify-center gap-1">
                                      {imgs.length > 1 && (
                                        <button
                                          onClick={() => setImageIndices(prev => ({ ...prev, [product.id]: idx === 0 ? imgs.length - 1 : idx - 1 }))}
                                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                                        >
                                          <ChevronLeft className="w-4 h-4 text-[#65758b]" />
                                        </button>
                                      )}
                                      <div className="relative group">
                                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border border-[#e1e7ef] bg-gray-50 flex items-center justify-center">
                                          <img src={imgs[idx]} alt={product.productName} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <button
                                          onClick={() => setPreviewProduct({ productName: product.productName, images: imgs })}
                                          className="absolute bottom-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-white/90 border border-[#e1e7ef] shadow-sm hover:bg-[#b455a0] hover:text-white hover:border-[#b455a0] transition-all opacity-0 group-hover:opacity-100"
                                          title="Zoom / View full size"
                                        >
                                          <ZoomIn className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      {imgs.length > 1 && (
                                        <button
                                          onClick={() => setImageIndices(prev => ({ ...prev, [product.id]: idx === imgs.length - 1 ? 0 : idx + 1 }))}
                                          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
                                        >
                                          <ChevronRight className="w-4 h-4 text-[#65758b]" />
                                        </button>
                                      )}
                                    </div>
                                    {imgs.length > 1 && (
                                      <span className="text-[10px] text-[#65758b] font-ibm-plex">{idx + 1} / {imgs.length}</span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 mx-auto bg-gray-50 rounded-lg border border-[#e1e7ef]">
                                    <ImageOff className="w-6 h-6 text-gray-300" />
                                    <span className="text-[10px] text-gray-400 mt-1">No image</span>
                                  </div>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

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
                        {/* ═══ Basic Info Tab ═══ */}
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
                              { label: 'Servings Per Pack', key: 'servingsPerPack' },
                              { label: 'MRP (₹)', key: 'mrp' },
                              { label: 'USPF', key: 'uspf' },
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
                                      <div>{value}</div>
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
                                  <div>{product.claims?.length > 0 ? product.claims.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                          </>
                        )}

                        {/* ═══ Nutrition Tab ═══ */}
                        {activeTab === 'nutrition' && (() => {
                          // Collect union of all nutrient names
                          const allNutrients = [...new Set(
                            selectedProducts.flatMap(p =>
                              (p.nutritionRows || []).map(r => r.nutrient)
                            )
                          )]
                          return (
                            <>
                              {/* Nutrition Notes on top */}
                              <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Nutrition Notes</span></td></tr>
                              <tr>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  Notes
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="whitespace-pre-line">{product.nutritionNotes?.length > 0 ? product.nutritionNotes.join('\n') : 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                              {/* Dynamic nutrition table */}
                              <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Nutrient Table</span></td></tr>
                              {allNutrients.map((nutrient) => {
                                return (
                                  <tr key={nutrient}>
                                    <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10 align-top">
                                      {nutrient}
                                    </td>
                                    {selectedProducts.map((product, index) => {
                                      const row = (product.nutritionRows || []).find(r => r.nutrient === nutrient)
                                      if (!row) {
                                        return (
                                          <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-gray-400 ${getProductColumnColor(index)} align-top`}>
                                            —
                                          </td>
                                        )
                                      }
                                      const unit = row.unit || ''
                                      const vals = row.values || {}
                                      const entries = Object.entries(vals).filter(([, v]) => v && v !== '-' && v !== 'not specified')
                                      // First numeric value for highlighting
                                      const firstNum = entries.length > 0 ? entries[0][1] : null
                                      const allFirstNums = selectedProducts.map(p => {
                                        const r = (p.nutritionRows || []).find(r2 => r2.nutrient === nutrient)
                                        if (!r) return null
                                        const e = Object.entries(r.values || {}).find(([, v]) => v && v !== '-' && v !== 'not specified')
                                        return e ? e[1] : null
                                      })
                                      return (
                                        <td
                                          key={product.id}
                                          className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)} ${getHighlightClass(firstNum, allFirstNums, 'nutrition')} align-top`}
                                        >
                                          <div>
                                            {unit && (
                                              <span className="inline-block bg-gray-100 text-gray-600 text-[10px] font-medium px-1.5 py-0.5 rounded mb-1">
                                                {unit}
                                              </span>
                                            )}
                                            {entries.length > 0 ? (
                                              <div className="space-y-0.5">
                                                {entries.map(([colName, val]) => (
                                                  <div key={colName} className="flex justify-between gap-2">
                                                    <span className="text-[#65758b] text-[11px] truncate">{colName}:</span>
                                                    <span className="font-medium text-right whitespace-nowrap">{val}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <span className="text-gray-400">—</span>
                                            )}
                                          </div>
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </>
                          )
                        })()}

                        {/* ═══ Composition Tab ═══ */}
                        {activeTab === 'composition' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Ingredients</span></td></tr>
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Ingredients
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div>{product.ingredients?.length > 0 ? product.ingredients.join(', ') : 'Not specified'}</div>
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
                                  <div>{product.allergens?.length > 0 ? product.allergens.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Storage & Usage</span></td></tr>
                            {[
                              { label: 'Storage Condition', key: 'storageCondition' },
                              { label: 'Directions to Use', key: 'directionsToUse' },
                              { label: 'Preparation Method', key: 'preparationMethod' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="whitespace-pre-line">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Medical Information</span></td></tr>
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Warnings
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="whitespace-pre-line">{product.warnings || 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                          </>
                        )}

                        {/* ═══ Company Tab ═══ */}
                        {activeTab === 'company' && (
                          <>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Company Information</span></td></tr>
                            {[
                              { label: 'Brand Owner', key: 'brandOwner' },
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
                                    <div className="whitespace-pre-line">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Batch Information</span></td></tr>
                            {[
                              { label: 'Lot / Batch Number', key: 'lotNumber' },
                              { label: 'Machine Code', key: 'machineCode' },
                              { label: 'Other Codes', key: 'otherCodes' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="whitespace-pre-line">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Packaging Information</span></td></tr>
                            {[
                              { label: 'Packaging Manufacturer', key: 'packagingManufacturer' },
                              { label: 'Packaging Codes', key: 'packagingCodes' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="whitespace-pre-line">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Regulatory Information</span></td></tr>
                            {/* FSSAI Numbers */}
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                FSSAI License No.
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="whitespace-pre-line">{product.fssaiNumbers?.length > 0 ? product.fssaiNumbers.join('\n') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            {/* Barcodes */}
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Barcodes / EAN
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div className="whitespace-pre-line">{product.barcodes?.length > 0 ? product.barcodes.join('\n') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            {/* Certifications */}
                            <tr>
                              <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                Certifications
                              </td>
                              {selectedProducts.map((product, index) => (
                                <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                  <div>{product.certifications?.length > 0 ? product.certifications.join(', ') : 'Not specified'}</div>
                                </td>
                              ))}
                            </tr>
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Customer Care</span></td></tr>
                            {[
                              { label: 'Phone', key: 'customerCarePhone' },
                              { label: 'Email', key: 'customerCareEmail' },
                              { label: 'Website', key: 'customerCareWebsite' },
                              { label: 'Address', key: 'customerCareAddress' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div>{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            <tr><td colSpan={selectedProducts.length + 1} className="px-2 md:px-4 py-2 bg-gray-50 sticky left-0"><span className="text-xs font-ibm-plex font-semibold text-[#65758b] uppercase">Additional Notes & Regulatory</span></td></tr>
                            {[
                              { label: 'Regulatory Text', key: 'regulatoryText' },
                              { label: 'Other Important Text', key: 'otherImportantText' }
                            ].map((field) => (
                              <tr key={field.key}>
                                <td className="px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex text-[#0f1729] font-medium sticky left-0 bg-white z-10">
                                  {field.label}
                                </td>
                                {selectedProducts.map((product, index) => (
                                  <td key={product.id} className={`px-2 md:px-4 py-2 md:py-3 text-xs md:text-sm font-ibm-plex ${getProductColumnColor(index)}`}>
                                    <div className="whitespace-pre-line">{product[field.key] || 'Not specified'}</div>
                                  </td>
                                ))}
                              </tr>
                            ))}
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
                <div className="absolute top-10 left-0 w-full bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto scrollbar-hide">
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
                <div className="absolute top-10 left-0 w-full bg-white border border-[#e1e7ef] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto scrollbar-hide">
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

          </div>
        )}
      </div>
      )}
      <ProductPreviewModal
        product={previewProduct}
        isOpen={!!previewProduct}
        onClose={() => setPreviewProduct(null)}
      />
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
      return ''
    }
  }

  return ''
}

export default Compare


