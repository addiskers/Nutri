import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { ArrowLeft, Plus, Save, X, Copy, Check } from 'lucide-react'
import { mockCategories } from '../utils/mockData'
import authService from '../services/api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const EditProduct = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('basic')
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
    shelfLife: '',
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

  // Load product data on mount
  useEffect(() => {
    const loadProduct = async () => {
      try {
        console.log('[EDIT] Loading product with ID:', id)
        const response = await fetch(`${API_BASE_URL}/products/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load product')
        }

        const product = await response.json()
        console.log('[EDIT] Product loaded:', product)

        // Populate form with existing product data
        setFormData({
          productName: product.product_name || '',
          brand: product.parent_brand || '',
          subBrand: product.sub_brand || '',
          variant: product.variant || '',
          packSize: product.pack_size || product.net_weight || '',
          mrp: product.mrp || '',
          manufactured: product.manufacturing_date || '',
          expiry: product.expiry_date || '',
          shelfLife: product.shelf_life || '',
          serveSize: product.serving_size || '',
          category: product.category || '',
          vegNonVeg: product.veg_nonveg || '',
          categoryInfo: '',
          variantDetails: '',
          packingFormat: product.packing_format || ''
        })

        // Populate nutrition data if available
        if (product.nutrition_table && Array.isArray(product.nutrition_table)) {
          const nutritionArray = product.nutrition_table.map((nutrient, index) => {
            const values = nutrient.values || {}
            return {
              id: index + 1,
              nutrient: nutrient.nutrient_name || '',
              per100g: values['Per 100g'] || values['per100g'] || '',
              perServe: values['Per Serve'] || values['perServe'] || '',
              rda: values['% RDA'] || values['rda'] || ''
            }
          })
          setNutritionRows(nutritionArray)
        }

        // Populate ingredients
        if (product.ingredients) {
          const ingredientsArray = typeof product.ingredients === 'string' 
            ? product.ingredients.split(',').map(i => i.trim())
            : Array.isArray(product.ingredients) ? product.ingredients : []
          setIngredients(ingredientsArray)
        }

        // Populate allergens
        if (product.allergen_info) {
          const allergensArray = typeof product.allergen_info === 'string'
            ? product.allergen_info.split(',').map(a => a.trim())
            : Array.isArray(product.allergen_info) ? product.allergen_info : []
          setAllergens(allergensArray)
        }

        // Populate claims
        if (product.claims && Array.isArray(product.claims)) {
          setClaims(product.claims)
        }

        // Populate storage data
        setStorageData({
          shelfLife: product.shelf_life || '',
          storageCondition: product.storage_instructions || '',
          instructionsToUse: product.instructions_to_use || '',
          packagingDetails: product.packing_format || ''
        })

        // Populate company data
        if (product.manufacturer_details && Array.isArray(product.manufacturer_details)) {
          const manufacturers = product.manufacturer_details
          setCompanyData({
            brandOwner: product.brand_owner || '',
            marketedBy: manufacturers.find(m => m.type?.includes('Marketed'))?.name || '',
            manufacturedBy: manufacturers.find(m => m.type?.includes('Manufactured'))?.address || manufacturers.find(m => m.type?.includes('Manufactured'))?.name || '',
            packedBy: manufacturers.find(m => m.type?.includes('Packed'))?.address || manufacturers.find(m => m.type?.includes('Packed'))?.name || '',
            otherNotes: '',
            fssai: product.fssai_licenses?.[0] || '',
            barcode: product.barcode || ''
          })
        }

        // Populate tags
        if (product.tags && Array.isArray(product.tags)) {
          setSelectedTags(product.tags)
        }

      } catch (error) {
        console.error('[EDIT] Error loading product:', error)
        alert('Failed to load product: ' + error.message)
        navigate('/products')
      }
    }

    if (id) {
      loadProduct()
    }
  }, [id, navigate])

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

  const handleSaveProduct = async () => {
    // Validate required fields
    if (!formData.productName || !formData.brand) {
      alert('Please fill in all required fields (*)')
      return
    }

    try {
      // Format nutrition table
      const nutritionTable = nutritionRows.map(row => ({
        nutrient_name: row.nutrient,
        values: {
          'Per 100g': row.per100g,
          'Per Serve': row.perServe,
          '% RDA': row.rda
        }
      }))

      // Format manufacturer details
      const manufacturerDetails = []
      if (companyData.marketedBy) {
        manufacturerDetails.push({
          type: 'Marketed by',
          name: companyData.marketedBy,
          address: '',
          fssai: ''
        })
      }
      if (companyData.manufacturedBy) {
        manufacturerDetails.push({
          type: 'Manufactured by',
          name: '',
          address: companyData.manufacturedBy,
          fssai: ''
        })
      }
      if (companyData.packedBy) {
        manufacturerDetails.push({
          type: 'Packed by',
          name: '',
          address: companyData.packedBy,
          fssai: ''
        })
      }

      const productData = {
        product_name: formData.productName,
        parent_brand: formData.brand,
        sub_brand: formData.subBrand || null,
        variant: formData.variant || null,
        net_weight: formData.packSize || null,
        pack_size: formData.packSize || null,
        serving_size: formData.serveSize || null,
        mrp: formData.mrp ? parseFloat(formData.mrp) : null,
        packing_format: formData.packingFormat || null,
        veg_nonveg: formData.vegNonVeg || null,
        category: formData.category || null,
        nutrition_table: nutritionTable,
        ingredients: ingredients.join(', ') || null,
        allergen_info: allergens.join(', ') || null,
        claims: claims,
        storage_instructions: storageData.storageCondition || null,
        instructions_to_use: storageData.instructionsToUse || null,
        shelf_life: formData.shelfLife || storageData.shelfLife || null,
        manufacturer_details: manufacturerDetails,
        brand_owner: companyData.brandOwner || null,
        barcode: companyData.barcode || null,
        fssai_licenses: companyData.fssai ? [companyData.fssai] : [],
        manufacturing_date: formData.manufactured || null,
        expiry_date: formData.expiry || null,
        tags: selectedTags,
        status: 'published'
      }

      console.log('[EDIT] Updating product:', productData)

      const response = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify(productData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to update product')
      }

      console.log('[EDIT] Product updated successfully:', result)
      alert('Product updated successfully!')
      navigate('/products')

    } catch (error) {
      console.error('[EDIT] Error updating product:', error)
      alert('Failed to update product: ' + error.message)
    }
  }

  return (
    <Layout>
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
                Edit Product
              </h1>
              <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
                Update product details using the 19-field standardized template
              </p>
            </div>

            <button
              onClick={handleSaveProduct}
              className="bg-[#b455a0] flex items-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap w-full sm:w-auto justify-center"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
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
                      <CopyBtn value={formData.productName} field="productName" />
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
                      <CopyBtn value={formData.brand} field="brand" />
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
                      <CopyBtn value={formData.subBrand} field="subBrand" />
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
                      <CopyBtn value={formData.variant} field="variant" />
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
                      <CopyBtn value={formData.packSize} field="packSize" />
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
                      <CopyBtn value={formData.serveSize} field="serveSize" />
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
                      <CopyBtn value={formData.mrp} field="mrp" />
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
                      <CopyBtn value={formData.packingFormat} field="packingFormat" />
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
                      <CopyBtn value={formData.manufactured} field="manufactured" />
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
                      <CopyBtn value={formData.expiry} field="expiry" />
                    </div>
                  </div>

                  {/* Shelf Life */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Shelf Life
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 12 months, 18 months"
                        value={formData.shelfLife}
                        onChange={(e) => setFormData({ ...formData, shelfLife: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.shelfLife} field="shelfLife" />
                    </div>
                  </div>

                  {/* Category */}
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
                      <CopyBtn value={formData.category} field="category" />
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
                      <CopyBtn value={formData.vegNonVeg} field="vegNonVeg" />
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
                    <CopyBtnStandalone value={claims.join(', ')} field="claims" />
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
                    <CopyBtnStandalone value={selectedTags.join(', ')} field="tags" />
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {predefinedTags.map((tag, index) => {
                    const isSelected = selectedTags.includes(tag)
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTags(selectedTags.filter(t => t !== tag))
                          } else {
                            setSelectedTags([...selectedTags, tag])
                          }
                        }}
                        className={`px-3 py-1 rounded-full transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-2 border-primary'
                            : 'border border-[#e1e7ef] hover:border-primary/50'
                        }`}
                      >
                        <span className={`text-xs font-ibm-plex font-semibold ${
                          isSelected ? 'text-primary' : 'text-[#0f1729]'
                        }`}>
                          {tag}
                        </span>
                      </button>
                    )
                  })}
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
                      field="nutritionTable"
                    />
                  )}
                  <button
                    onClick={handleAddNutritionRow}
                    className="bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                Enter values per 100g/100ml. Per serve and %RDA will be calculated automatically.
              </p>

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
                    {nutritionRows.map((row, index) => (
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
                            type="number"
                            value={row.per100g}
                            onChange={(e) => handleNutritionChange(row.id, 'per100g', e.target.value)}
                            className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="text"
                            value={row.perServe}
                            disabled
                            className="w-24 h-10 px-3 bg-[#f1f5f9] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right opacity-50 cursor-not-allowed"
                            placeholder="Auto"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <input
                            type="text"
                            value={row.rda}
                            disabled
                            className="w-24 h-10 px-3 bg-[#f1f5f9] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right opacity-50 cursor-not-allowed"
                            placeholder="Auto"
                          />
                        </td>
                        <td className="px-1 py-2 text-center">
                          {nutritionRows.length > 1 && (
                            <button
                              onClick={() => handleRemoveNutritionRow(row.id)}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <CopyBtnStandalone value={ingredients.join(', ')} field="ingredients" />
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
                    <CopyBtnStandalone value={allergens.join(', ')} field="allergens" />
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
                      <CopyBtn value={storageData.shelfLife} field="shelfLife" />
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
                      <CopyBtn value={storageData.storageCondition} field="storageCondition" />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] block">
                      Instructions to Use
                    </label>
                    <CopyBtnStandalone value={storageData.instructionsToUse} field="instructionsToUse" />
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
                    <CopyBtnStandalone value={companyData.marketedBy} field="marketedBy" />
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
                    <CopyBtnStandalone value={companyData.manufacturedBy} field="manufacturedBy" />
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
                    <CopyBtnStandalone value={companyData.packedBy} field="packedBy" />
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
                      <CopyBtn value={companyData.fssai} field="fssai" />
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
                      <CopyBtn value={companyData.barcode} field="barcode" />
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
                  <CopyBtnStandalone value={companyData.otherNotes} field="otherNotes" />
                </div>
                
                <div>
                  <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                    Other Notes
                  </label>
                  <textarea
                    placeholder="Any additional information (customer care, certifications, etc.)"
                    value={companyData.otherNotes}
                    onChange={(e) => setCompanyData({ ...companyData, otherNotes: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default EditProduct


