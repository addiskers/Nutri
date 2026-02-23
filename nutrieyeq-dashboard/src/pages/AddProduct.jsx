import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import ImageUploadWithCrop from '../components/Forms/ImageUploadWithCrop'
import NoPermissionContent from '../components/NoPermissionContent'
import { ArrowLeft, Plus, Save, X, Loader2, Sparkles, Check, AlertCircle, Copy } from 'lucide-react'
import { mockCategories } from '../utils/mockData'
import authService, { productService } from '../services/api'

const AddProduct = () => {
  const navigate = useNavigate()
  const hasPermission = authService.hasPermission('add_products')
  const [activeTab, setActiveTab] = useState('basic')
  
  // Image states
  const [images, setImages] = useState([
    { id: 1, label: 'Front', file: null, dataUrl: null },
    { id: 2, label: 'Back', file: null, dataUrl: null },
    { id: 3, label: 'Side 1', file: null, dataUrl: null },
    { id: 4, label: 'Side 2', file: null, dataUrl: null },
    { id: 5, label: 'Add Image', file: null, dataUrl: null }
  ])
  
  // Extraction states
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [extractionError, setExtractionError] = useState(null)
  const [extractionCost, setExtractionCost] = useState(null)
  
  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  
  // Form states
  const [claims, setClaims] = useState([])
  const [newClaim, setNewClaim] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [newIngredient, setNewIngredient] = useState('')
  const [allergens, setAllergens] = useState([])
  const [newAllergen, setNewAllergen] = useState('')
  const [storageData, setStorageData] = useState({
    shelfLife: '',
    storageCondition: '',
    instructionsToUse: '',
    packagingDetails: ''
  })
  const [companyData, setCompanyData] = useState({
    brandOwner: '',
    marketedBy: '',
    manufacturedBy: '',
    packedBy: '',
    otherNotes: '',
    fssai: '',
    barcode: ''
  })
  const [nutritionRows, setNutritionRows] = useState([])
  const [formData, setFormData] = useState({
    productName: '',
    brand: '',
    subBrand: '',
    variant: '',
    packSize: '',
    mrp: '',
    manufactured: '',
    expiry: '',
    serveSize: '',
    category: '',
    vegNonVeg: '',
    categoryInfo: '',
    variantDetails: '',
    packingFormat: ''
  })

  const [copiedField, setCopiedField] = useState(null)

  const copyToClipboard = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(String(text))
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 1500)
  }

  const CopyBtn = ({ value, field }) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); copyToClipboard(value, field) }}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-[#65758b]" />
      )}
    </button>
  )

  const CopyBtnStandalone = ({ value, field }) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); copyToClipboard(value, field) }}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors flex-shrink-0"
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-[#65758b]" />
      )}
    </button>
  )

  const predefinedTags = [
    'Kids Nutrition', 'Dairy Mix', 'Protein Drink', 'Sugar Free', 'Gluten Free',
    'Organic', 'High Protein', 'Low Fat', 'Fortified', 'Natural',
    'Premium', 'Value Pack', 'Personal Care', 'Hygiene', 'Sanitizer', 'IMA Recommended'
  ]
  const [selectedTags, setSelectedTags] = useState([])

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'composition', label: 'Composition' },
    { id: 'company', label: 'Company' }
  ]

  const handleAddMoreImages = () => {
    if (images.length < 10) {
      setImages([...images, { 
        id: images.length + 1, 
        label: `Image ${images.length + 1}`, 
        file: null,
        dataUrl: null
      }])
    }
  }

  const handleImageCropped = (index, imageData, cropData) => {
    const newImages = [...images]
    newImages[index].file = { imageData, cropData }
    newImages[index].dataUrl = imageData
    setImages(newImages)
  }

  const handleSubmitImages = async () => {
    console.log('[ADD_PRODUCT] Extract button clicked')
    // Prevent double extraction
    if (isExtracting) {
      console.log('[ADD_PRODUCT] Extraction already in progress, ignoring')
      return
    }
    // Filter out images that have files
    const uploadedImages = images.filter(img => img.dataUrl !== null)
    console.log('[ADD_PRODUCT] Uploaded images count:', uploadedImages.length)
    
    if (uploadedImages.length === 0) {
      console.log('[ADD_PRODUCT] No images to extract')
      setExtractionError('Please upload at least one image')
      return
    }

    console.log('[ADD_PRODUCT] Starting extraction...')
    setIsExtracting(true)
    setExtractionError(null)
    setExtractionComplete(false)
    
    try {
      // Get all image data URLs
      const imageDataUrls = uploadedImages.map(img => img.dataUrl)
      console.log('[ADD_PRODUCT] Calling extraction service...')
      
      // Call extraction API
      const result = await productService.extractFromImages(imageDataUrls)
      console.log('[ADD_PRODUCT] Extraction result:', result)
      
      if (result.success && result.data) {
        // Populate form with extracted data
        populateFormFromExtraction(result.data)
        setExtractionComplete(true)
        setExtractionCost(result.cost)
      } else {
        setExtractionError(result.error || 'Extraction failed')
      }
    } catch (error) {
      console.error('Extraction error:', error)
      setExtractionError(error.message || 'Failed to extract data from images')
    } finally {
      setIsExtracting(false)
    }
  }

  const populateFormFromExtraction = (data) => {
    // Populate basic info
    if (data.basic) {
      setFormData(prev => ({
        ...prev,
        productName: data.basic.productName || prev.productName,
        brand: data.basic.brand || prev.brand,
        subBrand: data.basic.subBrand || prev.subBrand,
        variant: data.basic.variant || prev.variant,
        packSize: data.basic.packSize || prev.packSize,
        serveSize: data.basic.serveSize || prev.serveSize,
        mrp: data.basic.mrp || prev.mrp,
        packingFormat: data.basic.packingFormat || prev.packingFormat,
        vegNonVeg: data.basic.vegNonVeg === 'Vegetarian' ? 'veg' : 
                   data.basic.vegNonVeg === 'Non-Vegetarian' ? 'non-veg' : 
                   data.basic.vegNonVeg?.toLowerCase() || prev.vegNonVeg,
      }))
    }
    
    // Populate dates
    if (data.dates) {
      setFormData(prev => ({
        ...prev,
        manufactured: data.dates.manufacturing_date || prev.manufactured,
        expiry: data.dates.expiry_date || prev.expiry
      }))
    }
    
    // Populate nutrition table
    if (data.nutrition && Array.isArray(data.nutrition) && data.nutrition.length > 0) {
      const nutritionData = data.nutrition.map((item, index) => {
        const values = item.values || {}
        // Find per 100g value
        const per100gKey = Object.keys(values).find(k => k.toLowerCase().includes('100'))
        const perServeKey = Object.keys(values).find(k => k.toLowerCase().includes('serve'))
        const rdaKey = Object.keys(values).find(k => k.toLowerCase().includes('rda'))
        
        return {
          id: index + 1,
          nutrient: item.nutrient_name || '',
          per100g: per100gKey ? values[per100gKey]?.replace(/[^\d.]/g, '') || '' : '',
          perServe: perServeKey ? values[perServeKey] || '' : '',
          rda: rdaKey ? values[rdaKey] || '' : ''
        }
      })
      setNutritionRows(nutritionData)
    }
    
    // Populate composition
    if (data.composition) {
      // Ingredients - can be string or comma separated
      if (data.composition.ingredients) {
        const ingredientStr = data.composition.ingredients
        if (typeof ingredientStr === 'string' && ingredientStr.length > 0) {
          // Split by comma and clean up
          const ingredientList = ingredientStr.split(',').map(i => i.trim()).filter(i => i)
          setIngredients(ingredientList)
        }
      }
      
      // Allergens
      if (data.composition.allergenInfo && data.composition.allergenInfo !== 'not specified') {
        const allergenStr = data.composition.allergenInfo
        if (typeof allergenStr === 'string') {
          const allergenList = allergenStr.split(',').map(a => a.trim()).filter(a => a)
          setAllergens(allergenList)
        }
      }
      
      // Claims
      if (data.composition.claims && Array.isArray(data.composition.claims)) {
        setClaims(data.composition.claims.filter(c => c && c !== 'not specified'))
      }
      
      // Storage
      if (data.composition.storageInstructions && data.composition.storageInstructions !== 'not specified') {
        setStorageData(prev => ({
          ...prev,
          storageCondition: data.composition.storageInstructions
        }))
      }
      if (data.composition.instructionsToUse && data.composition.instructionsToUse !== 'not specified') {
        setStorageData(prev => ({
          ...prev,
          instructionsToUse: data.composition.instructionsToUse
        }))
      }
      if (data.composition.shelfLife && data.composition.shelfLife !== 'not specified') {
        setStorageData(prev => ({
          ...prev,
          shelfLife: data.composition.shelfLife
        }))
      }
    }
    
    // Populate company info
    if (data.company) {
      // Manufacturer details
      if (data.company.manufacturerDetails && Array.isArray(data.company.manufacturerDetails)) {
        const manufacturers = data.company.manufacturerDetails
        
        for (const mfg of manufacturers) {
          const type = mfg.type?.toLowerCase() || ''
          const fullAddress = [mfg.name, mfg.address].filter(Boolean).join(', ')
          
          if (type.includes('manufactured')) {
            setCompanyData(prev => ({ ...prev, manufacturedBy: fullAddress }))
          } else if (type.includes('packed')) {
            setCompanyData(prev => ({ ...prev, packedBy: fullAddress }))
          } else if (type.includes('marketed')) {
            setCompanyData(prev => ({ ...prev, marketedBy: fullAddress }))
          }
          
          // Get FSSAI from first manufacturer
          if (mfg.fssai && mfg.fssai !== 'not specified') {
            setCompanyData(prev => ({ ...prev, fssai: prev.fssai || mfg.fssai }))
          }
        }
      }
      
      // Barcode
      if (data.company.barcode && data.company.barcode !== 'not specified') {
        setCompanyData(prev => ({ ...prev, barcode: data.company.barcode }))
      }
      
      // Customer care
      if (data.company.customerCare) {
        const cc = data.company.customerCare
        let notes = []
        if (cc.phone && Array.isArray(cc.phone) && cc.phone.length > 0) {
          notes.push(`Phone: ${cc.phone.join(', ')}`)
        }
        if (cc.email && cc.email !== 'not specified') {
          notes.push(`Email: ${cc.email}`)
        }
        if (cc.website && cc.website !== 'not specified') {
          notes.push(`Website: ${cc.website}`)
        }
        if (notes.length > 0) {
          setCompanyData(prev => ({ ...prev, otherNotes: notes.join('\n') }))
        }
      }
    }
  }

  const handleAddClaim = () => {
    if (newClaim.trim()) {
      setClaims([...claims, newClaim.trim()])
      setNewClaim('')
    }
  }

  const handleRemoveClaim = (index) => {
    setClaims(claims.filter((_, i) => i !== index))
  }

  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setIngredients([...ingredients, newIngredient.trim()])
      setNewIngredient('')
    }
  }

  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index))
  }

  const handleAddAllergen = () => {
    if (newAllergen.trim()) {
      setAllergens([...allergens, newAllergen.trim()])
      setNewAllergen('')
    }
  }

  const handleRemoveAllergen = (index) => {
    setAllergens(allergens.filter((_, i) => i !== index))
  }

  const handleAddNutritionRow = () => {
    setNutritionRows([
      ...nutritionRows,
      {
        id: nutritionRows.length + 1,
        nutrient: '',
        per100g: '',
        perServe: '',
        rda: ''
      }
    ])
  }

  const handleNutritionChange = (id, field, value) => {
    setNutritionRows(nutritionRows.map(row =>
      row.id === id ? { ...row, [field]: value } : row
    ))
  }

  const handleRemoveNutritionRow = (id) => {
    setNutritionRows(nutritionRows.filter(row => row.id !== id))
  }

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleSaveProduct = async () => {
    // Validate required fields
    if (!formData.productName || !formData.brand) {
      alert('Please fill in all required fields (*)')
      return
    }

    setIsSaving(true)
    
    try {
      // Prepare product data for API
      const productData = {
        product_name: formData.productName,
        parent_brand: formData.brand,
        sub_brand: formData.subBrand || null,
        variant: formData.variant || null,
        net_weight: formData.packSize || null,
        serving_size: formData.serveSize || null,
        mrp: formData.mrp ? parseFloat(formData.mrp) : null,
        packing_format: formData.packingFormat || null,
        veg_nonveg: formData.vegNonVeg || null,
        category: formData.category || null,
        
        // Nutrition
        nutrition_table: nutritionRows.map(row => ({
          nutrient_name: row.nutrient,
          values: {
            'Per 100g': row.per100g,
            'Per Serve': row.perServe,
            '% RDA': row.rda
          }
        })),
        
        // Composition
        ingredients: ingredients.join(', '),
        allergen_info: allergens.join(', '),
        claims: claims,
        storage_instructions: storageData.storageCondition,
        shelf_life: storageData.shelfLife,
        
        // Company
        manufacturer_details: [
          companyData.manufacturedBy && { type: 'Manufactured by', name: companyData.manufacturedBy },
          companyData.packedBy && { type: 'Packed by', name: companyData.packedBy },
          companyData.marketedBy && { type: 'Marketed by', name: companyData.marketedBy }
        ].filter(Boolean),
        brand_owner: companyData.brandOwner || null,
        barcode: companyData.barcode || null,
        fssai_licenses: companyData.fssai ? [companyData.fssai] : [],
        
        // Dates
        manufacturing_date: formData.manufactured || null,
        expiry_date: formData.expiry || null,
        
        // Tags
        tags: selectedTags,
        
        // Images (store base64)
        images: images.filter(img => img.dataUrl).map(img => img.dataUrl),

        // Status - always published by default
        status: 'published'
      }
      
      const result = await productService.createProduct(productData)
      
      if (result.success) {
        alert('Product saved successfully!')
        navigate('/products')
      } else {
        alert(`Failed to save product: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save product. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout>
      {!hasPermission ? (
        <NoPermissionContent pageName="Add Product Page" />
      ) : (
        <div className="overflow-y-auto h-full">
          <div className="max-w-6xl mx-auto p-4 md:p-6">
            {/* Header */}
          <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
            <button
              onClick={() => navigate('/products')}
              className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors sm:mt-1"
            >
              <ArrowLeft className="w-4 h-4 text-[#0f1729]" />
            </button>
            
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
                Add New Product
              </h1>
              <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
                Upload images and let AI extract product data automatically
              </p>
            </div>

            <button
              onClick={handleSaveProduct}
              disabled={isSaving}
              className="bg-[#b455a0] flex items-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </div>

          {/* Product Images Section */}
          <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6 mb-4 md:mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-2 border-b border-[#e1e7ef]">
              <div>
                <h2 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                  Product Images
                </h2>
                <p className="text-xs text-[#65758b] mt-0.5">
                  Upload up to 10 images • Click to crop • Then submit for AI extraction
                </p>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={handleAddMoreImages}
                  disabled={images.length >= 10}
                  className="bg-[#f9fafb] border border-[#e1e7ef] flex items-center justify-center gap-2 h-10 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm text-[#0f1729] hover:bg-gray-100 transition-colors flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add More</span>
                </button>
                <button
                  onClick={handleSubmitImages}
                  disabled={isExtracting || images.every(img => !img.dataUrl)}
                  className="bg-[#009da5] border border-[#5bc4bf] h-10 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm text-white hover:bg-[#008891] transition-colors flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Extract Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Extraction Status */}
            {extractionComplete && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-ibm-plex font-medium text-green-800">
                    Extraction Complete!
                  </p>
                  <p className="text-xs text-green-700 mt-0.5">
                    Data has been extracted and filled in the form below. Review and edit as needed before saving.
                  </p>
                </div>
              </div>
            )}

            {extractionError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-ibm-plex font-medium text-red-800">
                    Extraction Failed
                  </p>
                  <p className="text-xs text-red-700 mt-0.5">
                    {extractionError}
                  </p>
                </div>
              </div>
            )}

            {isExtracting && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-blue-800">
                      Extracting product data...
                    </p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      This may take 10-30 seconds depending on image count and quality
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-3 md:mb-4">
              {images.map((img, index) => (
                <ImageUploadWithCrop
                  key={img.id}
                  label={img.label}
                  onImageCropped={(imageData, cropData) => handleImageCropped(index, imageData, cropData)}
                  onRemove={() => {
                    const newImages = [...images]
                    newImages[index].file = null
                    newImages[index].dataUrl = null
                    setImages(newImages)
                  }}
                />
              ))}
            </div>

            <p className="text-xs md:text-sm font-ibm-plex text-[#65758b]">
              Upload product images (front, back, nutrition table, ingredients list) for best results. Supported formats: JPG, PNG, WebP
            </p>
          </div>

          {/* Tabs */}
          <div className="bg-[#ebebeb] rounded-md p-1 mb-4 md:mb-6 overflow-x-auto">
            <div className="flex gap-1 min-w-max sm:min-w-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-3 sm:px-4 md:px-6 py-2 rounded text-xs sm:text-sm font-ibm-plex font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-[#f9fafb] text-[#0f1729] shadow-sm'
                      : 'text-[#65758b] hover:text-[#0f1729]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  Basic Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  {/* Product Name */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Product Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter product name"
                        value={formData.productName}
                        onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                      <CopyBtn value={formData.productName} field="add_productName" />
                    </div>
                  </div>

                  {/* Brand */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Brand *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Enter brand name"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                      />
                      <CopyBtn value={formData.brand} field="add_brand" />
                    </div>
                  </div>

                  {/* Sub Brand */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Sub Brand
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., Junior, Pro, Lite"
                        value={formData.subBrand}
                        onChange={(e) => setFormData({ ...formData, subBrand: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.subBrand} field="add_subBrand" />
                    </div>
                  </div>

                  {/* Variant */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Variant
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., Chocolate, Vanilla"
                        value={formData.variant}
                        onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.variant} field="add_variant" />
                    </div>
                  </div>

                  {/* Pack Size */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Net Weight / Pack Size
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 500g, 1L"
                        value={formData.packSize}
                        onChange={(e) => setFormData({ ...formData, packSize: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.packSize} field="add_packSize" />
                    </div>
                  </div>

                  {/* Serve Size */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Serve Size
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 30g, 200ml"
                        value={formData.serveSize}
                        onChange={(e) => setFormData({ ...formData, serveSize: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.serveSize} field="add_serveSize" />
                    </div>
                  </div>

                  {/* MRP */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      MRP (₹)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={formData.mrp}
                        onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.mrp} field="add_mrp" />
                    </div>
                  </div>

                  {/* Packing Format */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Packing Format
                    </label>
                    <div className="relative">
                      <select
                        value={formData.packingFormat}
                        onChange={(e) => setFormData({ ...formData, packingFormat: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select format</option>
                        <option value="sachet">Sachet</option>
                        <option value="bottle">Bottle</option>
                        <option value="pouch">Pouch</option>
                        <option value="jar">Jar</option>
                        <option value="can">Can</option>
                        <option value="tetra pack">Tetra Pack</option>
                        <option value="carton">Carton</option>
                        <option value="box">Box</option>
                        <option value="tub">Tub</option>
                        <option value="pack">Pack</option>
                      </select>
                      <CopyBtn value={formData.packingFormat} field="add_packingFormat" />
                    </div>
                  </div>

                  {/* Manufacturing Date */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Manufacturing Date
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={formData.manufactured}
                        onChange={(e) => setFormData({ ...formData, manufactured: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.manufactured} field="add_manufactured" />
                    </div>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Expiry Date
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="DD/MM/YYYY"
                        value={formData.expiry}
                        onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.expiry} field="add_expiry" />
                    </div>
                  </div>

                  {/* Category Dropdown */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Category
                    </label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select category</option>
                        {mockCategories.filter(c => c !== 'All Categories').map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                      <CopyBtn value={formData.category} field="add_category" />
                    </div>
                  </div>

                  {/* Veg/Non-Veg */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Veg/Non-Veg
                    </label>
                    <div className="relative">
                      <select
                        value={formData.vegNonVeg}
                        onChange={(e) => setFormData({ ...formData, vegNonVeg: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="">Select type</option>
                        <option value="veg">Vegetarian</option>
                        <option value="non-veg">Non-Vegetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="na">Not Applicable</option>
                      </select>
                      <CopyBtn value={formData.vegNonVeg} field="add_vegNonVeg" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Claims on Pack */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Claims on Pack
                  </h3>
                  {claims.length > 0 && (
                    <CopyBtnStandalone value={claims.join(', ')} field="add_claims" />
                  )}
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add a claim"
                    value={newClaim}
                    onChange={(e) => setNewClaim(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddClaim()}
                    className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddClaim}
                    className="bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
                  >
                    Add
                  </button>
                </div>

                {claims.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {claims.map((claim, index) => (
                      <div
                        key={index}
                        className="bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full flex items-center gap-2"
                      >
                        <span className="text-xs font-ibm-plex font-medium text-[#0f1729]">
                          {claim}
                        </span>
                        <button
                          onClick={() => handleRemoveClaim(index)}
                          className="hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3 text-[#0f1729]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Tags
                  </h3>
                  {selectedTags.length > 0 && (
                    <CopyBtnStandalone value={selectedTags.join(', ')} field="add_tags" />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {predefinedTags.map((tag, index) => (
                    <button
                      key={index}
                      onClick={() => handleTagToggle(tag)}
                      className={`border px-3 py-1 rounded-full transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-[#b455a0] border-[#b455a0] text-white'
                          : 'border-[#e1e7ef] hover:border-[#b455a0] hover:bg-primary/5'
                      }`}
                    >
                      <span className="text-xs font-ibm-plex font-semibold">
                        {tag}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Nutrition Tab */}
          {activeTab === 'nutrition' && (
            <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e1e7ef]">
                <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
                  Nutritional Information
                </h3>
                <div className="flex items-center gap-2">
                  {nutritionRows.length > 0 && (
                    <CopyBtnStandalone
                      value={`Nutrient\tPer 100g\tPer Serve\t% RDA\n${nutritionRows.map(r => `${r.nutrient}\t${r.per100g}\t${r.perServe}\t${r.rda}`).join('\n')}`}
                      field="add_nutritionTable"
                    />
                  )}
                  <button
                    onClick={handleAddNutritionRow}
                    className="bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
                  >
                    Add Row
                  </button>
                </div>
              </div>

              <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                {nutritionRows.length === 0 
                  ? 'No nutrition data extracted. Upload images and click "Extract Data" or add rows manually.'
                  : 'Review and edit the extracted nutrition data. You can add or remove rows as needed.'
                }
              </p>

              {nutritionRows.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-[#e1e7ef]">
                        <th className="px-1 py-2 text-left">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            Nutrient
                          </span>
                        </th>
                        <th className="px-1 py-2 text-right w-24">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            Per 100g
                          </span>
                        </th>
                        <th className="px-1 py-2 text-right w-24">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            Per Serve
                          </span>
                        </th>
                        <th className="px-1 py-2 text-right w-24">
                          <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                            % RDA
                          </span>
                        </th>
                        <th className="px-1 py-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {nutritionRows.map((row) => (
                        <tr key={row.id} className="border-b border-[#e1e7ef]">
                          <td className="px-1 py-2">
                            <input
                              type="text"
                              value={row.nutrient}
                              onChange={(e) => handleNutritionChange(row.id, 'nutrient', e.target.value)}
                              placeholder="e.g., Vitamin C (mg)"
                              className="w-full px-0 py-2 bg-transparent border-0 text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="text"
                              value={row.per100g}
                              onChange={(e) => handleNutritionChange(row.id, 'per100g', e.target.value)}
                              className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="text"
                              value={row.perServe}
                              onChange={(e) => handleNutritionChange(row.id, 'perServe', e.target.value)}
                              className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="text"
                              value={row.rda}
                              onChange={(e) => handleNutritionChange(row.id, 'rda', e.target.value)}
                              className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              onClick={() => handleRemoveNutritionRow(row.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Composition Tab */}
          {activeTab === 'composition' && (
            <div className="space-y-6">
              {/* Ingredients */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Ingredients
                  </h3>
                  {ingredients.length > 0 && (
                    <CopyBtnStandalone value={ingredients.join(', ')} field="add_ingredients" />
                  )}
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add an ingredient"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
                    className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddIngredient}
                    className="bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
                  >
                    Add
                  </button>
                </div>

                {ingredients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 border border-[#e1e7ef] px-3 py-1.5 rounded-full flex items-center gap-2"
                      >
                        <span className="text-sm font-ibm-plex text-[#0f1729]">
                          {ingredient}
                        </span>
                        <button
                          onClick={() => handleRemoveIngredient(index)}
                          className="hover:bg-gray-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3 text-[#0f1729]" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Allergens */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Allergens
                  </h3>
                  {allergens.length > 0 && (
                    <CopyBtnStandalone value={allergens.join(', ')} field="add_allergens" />
                  )}
                </div>
                
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add an allergen"
                    value={newAllergen}
                    onChange={(e) => setNewAllergen(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddAllergen()}
                    className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={handleAddAllergen}
                    className="bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
                  >
                    Add
                  </button>
                </div>

                {allergens.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allergens.map((allergen, index) => (
                      <div
                        key={index}
                        className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-full flex items-center gap-2"
                      >
                        <span className="text-sm font-ibm-plex text-red-900">
                          {allergen}
                        </span>
                        <button
                          onClick={() => handleRemoveAllergen(index)}
                          className="hover:bg-red-100 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3 text-red-900" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Storage & Usage */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  Storage & Usage
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Shelf Life
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 18 months from manufacture"
                        value={storageData.shelfLife}
                        onChange={(e) => setStorageData({ ...storageData, shelfLife: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={storageData.shelfLife} field="add_shelfLife" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Storage Condition
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., Store in cool, dry place"
                        value={storageData.storageCondition}
                        onChange={(e) => setStorageData({ ...storageData, storageCondition: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={storageData.storageCondition} field="add_storageCondition" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] block">
                      Instructions to Use
                    </label>
                    <CopyBtnStandalone value={storageData.instructionsToUse} field="add_instructionsToUse" />
                  </div>
                  <textarea
                    placeholder="How to use the product"
                    value={storageData.instructionsToUse}
                    onChange={(e) => setStorageData({ ...storageData, instructionsToUse: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Packaging */}
              {/* Packaging section removed as per requirements */}
            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-4 md:space-y-6">
              {/* Company Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  Company Information
                </h3>
                
                <div className="mb-3 md:mb-4">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] block">
                      Marketed By
                    </label>
                    <CopyBtnStandalone value={companyData.marketedBy} field="add_marketedBy" />
                  </div>
                  <textarea
                    placeholder="Marketing company name and address"
                    value={companyData.marketedBy}
                    onChange={(e) => setCompanyData({ ...companyData, marketedBy: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="mb-3 md:mb-4">
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] block">
                      Manufactured By
                    </label>
                    <CopyBtnStandalone value={companyData.manufacturedBy} field="add_manufacturedBy" />
                  </div>
                  <textarea
                    placeholder="Manufacturing unit name and address"
                    value={companyData.manufacturedBy}
                    onChange={(e) => setCompanyData({ ...companyData, manufacturedBy: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] block">
                      Packed By
                    </label>
                    <CopyBtnStandalone value={companyData.packedBy} field="add_packedBy" />
                  </div>
                  <textarea
                    placeholder="Packing unit name and address"
                    value={companyData.packedBy}
                    onChange={(e) => setCompanyData({ ...companyData, packedBy: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>

              {/* Regulatory Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  Regulatory Information
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      FSSAI License No.
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="14-digit FSSAI number"
                        value={companyData.fssai}
                        onChange={(e) => setCompanyData({ ...companyData, fssai: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={companyData.fssai} field="add_fssai" />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Barcode
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Product barcode"
                        value={companyData.barcode}
                        onChange={(e) => setCompanyData({ ...companyData, barcode: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={companyData.barcode} field="add_barcode" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Additional Notes
                  </h3>
                  <CopyBtnStandalone value={companyData.otherNotes} field="add_otherNotes" />
                </div>
                
                <div>
                  <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                    Other Notes
                  </label>
                  <textarea
                    placeholder="Any additional information (customer care, certifications, etc.)"
                    value={companyData.otherNotes}
                    onChange={(e) => setCompanyData({ ...companyData, otherNotes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </Layout>
  )
}

export default AddProduct
