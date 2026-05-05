import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { ArrowLeft, Plus, Save, X, Copy, Check } from 'lucide-react'
import authService, { apiRequest, categoryService, nomenclatureService } from '../services/api'
import { debugLog } from '../utils/debugLog'
import NutrientMappingDropdown from '../components/NutrientMappingDropdown'

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
    packagingDetails: ''
  })
  const [directionsToUse, setDirectionsToUse] = useState('')
  const [preparationMethod, setPreparationMethod] = useState('')
  const [companyData, setCompanyData] = useState({
    brandOwner: '',
    marketedBy: '',
    manufacturedBy: '',
    packedBy: '',
    otherNotes: ''
  })
  const [batchData, setBatchData] = useState({
    lotNumber: '',
    machineCode: '',
    otherCodes: ''
  })
  const [packagingData, setPackagingData] = useState({
    manufacturer: '',
    codes: ''
  })
  const [customerCareData, setCustomerCareData] = useState({
    phones: '',
    email: '',
    website: '',
    address: ''
  })
  const [fssaiNumbers, setFssaiNumbers] = useState([])
  const [newFssaiNumber, setNewFssaiNumber] = useState('')
  const [barcodes, setBarcodes] = useState([])
  const [newBarcode, setNewBarcode] = useState('')
  const [certifications, setCertifications] = useState([])
  const [newCertification, setNewCertification] = useState('')
  const [regulatoryText, setRegulatoryText] = useState('')
  const [otherImportantText, setOtherImportantText] = useState('')
  const [nutritionRows, setNutritionRows] = useState([])
  const nutritionRowsRef = useRef(nutritionRows)
  useEffect(() => { nutritionRowsRef.current = nutritionRows }, [nutritionRows])
  const [nutritionNotes, setNutritionNotes] = useState([])
  const [newNutritionNote, setNewNutritionNote] = useState('')
  const [standardizedNames, setStandardizedNames] = useState([])
  const [nomenclatureMap, setNomenclatureMap] = useState({})
  const [formData, setFormData] = useState({
    productName: '',
    brand: '',
    subBrand: '',
    variant: '',
    packSize: '',
    servingsPerPack: '',
    mrp: '',
    uspf: '',
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
  const [categories, setCategories] = useState([])

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

  // ── Shared style tokens & chip helpers (mirrors AddProduct) ────────────────
  const inputClass    = "w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
  const textareaClass = "w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
  const labelClass    = "text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block"
  const addBtnClass   = "bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"

  const makeChipAdder = (list, setList, newVal, setNew) => () => {
    if (newVal.trim()) { setList([...list, newVal.trim()]); setNew('') }
  }
  const makeChipRemover = (list, setList) => (idx) => setList(list.filter((_, i) => i !== idx))

  const handleAddFssai      = makeChipAdder(fssaiNumbers,   setFssaiNumbers,   newFssaiNumber,   setNewFssaiNumber)
  const handleRemoveFssai   = makeChipRemover(fssaiNumbers, setFssaiNumbers)
  const handleAddBarcode    = makeChipAdder(barcodes,       setBarcodes,       newBarcode,       setNewBarcode)
  const handleRemoveBarcode = makeChipRemover(barcodes,     setBarcodes)
  const handleAddCert       = makeChipAdder(certifications, setCertifications, newCertification, setNewCertification)
  const handleRemoveCert    = makeChipRemover(certifications, setCertifications)

  const ChipList = ({ items, onRemove, colorClass = 'bg-primary/10 border-primary/20 text-[#0f1729]' }) => (
    <div className="flex flex-wrap gap-2 mt-3">
      {items.map((item, idx) => (
        <div key={idx} className={`border px-3 py-1.5 rounded-full flex items-center gap-2 ${colorClass}`}>
          <span className="text-xs font-ibm-plex font-medium">{item}</span>
          <button onClick={() => onRemove(idx)} className="hover:opacity-70 rounded-full p-0.5">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )

  const ChipInput = ({ value, onChange, onAdd, placeholder, btnLabel = 'Add' }) => (
    <div className="flex gap-2">
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd())}
        placeholder={placeholder}
        className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary" />
      <button type="button" onClick={onAdd} className={addBtnClass}>{btnLabel}</button>
    </div>
  )

  const SectionHeader = ({ title, copyValue, copyField }) => (
    <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
      <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">{title}</h3>
      {copyValue && <CopyBtnStandalone value={copyValue} field={copyField} />}
    </div>
  )

  const tabs = [
    { id: 'basic', label: 'Basic Info' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'composition', label: 'Composition' },
    { id: 'company', label: 'Company' }
  ]

  useEffect(() => {
    categoryService
      .getCategories({ limit: 100 })
      .then((res) => {
        const list = (res && Array.isArray(res.categories)) ? res.categories : []
        setCategories(list.map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean))
      })
      .catch((err) => {
        debugLog('[EDIT] Failed to load categories:', err)
        setCategories([])
      })
  }, [])

  useEffect(() => {
    const loadProduct = async () => {
      try {
        debugLog('[EDIT] Loading product with ID:', id)
        const response = await apiRequest(`/products/${id}`, { method: 'GET' })

        if (!response.ok) {
          throw new Error('Failed to load product')
        }

        const product = await response.json()
        debugLog('[EDIT] Product loaded:', product)

        setFormData({
          productName: product.product_name || '',
          brand: product.parent_brand || '',
          subBrand: product.sub_brand || '',
          variant: product.variant || '',
          packSize: product.net_quantity || product.pack_size || product.net_weight || '',
          servingsPerPack: product.servings_per_pack || '',
          mrp: product.mrp || '',
          uspf: product.uspf || '',
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

        if (product.nutrition_table && Array.isArray(product.nutrition_table)) {
          const nutritionArray = product.nutrition_table.map((nutrient, index) => ({
            id: Date.now() + index,
            nutrient:     nutrient.nutrient_name || '',
            originalName: nutrient.original_name || nutrient.nutrient_name || '',
            unit:         nutrient.unit || '',
            values:       nutrient.values && typeof nutrient.values === 'object' ? nutrient.values : {},
          }))
          setNutritionRows(nutritionArray)
        }
        if (Array.isArray(product.nutrition_notes)) {
          setNutritionNotes(product.nutrition_notes.filter(Boolean))
        }

        if (product.ingredients) {
          const ingredientsArray = typeof product.ingredients === 'string' 
            ? product.ingredients.split(',').map(i => i.trim())
            : Array.isArray(product.ingredients) ? product.ingredients : []
          setIngredients(ingredientsArray)
        }

        const allergenRaw = product.allergen_information ?? product.allergen_info
        if (allergenRaw) {
          const allergensArray = typeof allergenRaw === 'string'
            ? allergenRaw.split(',').map(a => a.trim())
            : Array.isArray(allergenRaw) ? allergenRaw : []
          setAllergens(allergensArray)
        }

        if (product.claims && Array.isArray(product.claims)) {
          setClaims(product.claims)
        }

        const storageArr = Array.isArray(product.storage_instructions)
          ? product.storage_instructions
          : (typeof product.storage_instructions === 'string' && product.storage_instructions
              ? [product.storage_instructions]
              : [])
        setStorageData({
          shelfLife: product.shelf_life || '',
          storageCondition: storageArr.join('\n'),
          packagingDetails: product.packing_format || ''
        })

        const usageInfo = product.usage_instructions || {}
        if (usageInfo && typeof usageInfo === 'object') {
          const dirs = Array.isArray(usageInfo.directions_to_use) ? usageInfo.directions_to_use : []
          const prep = Array.isArray(usageInfo.preparation_method) ? usageInfo.preparation_method : []
          setDirectionsToUse(dirs.join('\n'))
          setPreparationMethod(prep.join('\n'))
        } else if (typeof product.instructions_to_use === 'string' && product.instructions_to_use) {
          // legacy fallback for older records that only have a flat string
          setDirectionsToUse(product.instructions_to_use)
        }

        // ── Manufacturer / Marketed / Packed (split into multiple blocks) ──
        const manufacturers = Array.isArray(product.manufacturer_information)
          ? product.manufacturer_information
          : (Array.isArray(product.manufacturer_details) ? product.manufacturer_details : [])

        const formatManufacturerEntry = (m) => {
          const parts = [m?.name, m?.address, m?.license_number ? `License: ${m.license_number}` : '']
            .filter(Boolean)
          return parts.join('\n')
        }
        const collectByType = (matcher) => manufacturers
          .filter(m => (m?.type || '').toLowerCase().includes(matcher))
          .map(formatManufacturerEntry)
          .filter(Boolean)
          .join('\n\n')

        setCompanyData({
          brandOwner: product.brand_owner || '',
          marketedBy: collectByType('market'),
          manufacturedBy: collectByType('manufactur'),
          packedBy: collectByType('pack'),
          otherNotes: ''
        })

        // ── Batch information ──
        const batch = product.batch_information || {}
        setBatchData({
          lotNumber:   batch.lot_number   || '',
          machineCode: batch.machine_code || '',
          otherCodes:  Array.isArray(batch.other_codes) ? batch.other_codes.join('\n') : (batch.other_codes || '')
        })

        // ── Packaging information ──
        const packaging = product.packaging_information || {}
        setPackagingData({
          manufacturer: packaging.packaging_material_manufacturer || '',
          codes:        Array.isArray(packaging.packaging_codes) ? packaging.packaging_codes.join('\n') : (packaging.packaging_codes || '')
        })

        // ── FSSAI license numbers (canonical + legacy fallback) ──
        const fssaiInfo = product.fssai_information || {}
        const fssaiList = Array.isArray(fssaiInfo.license_numbers)
          ? fssaiInfo.license_numbers
          : (Array.isArray(product.fssai_licenses) ? product.fssai_licenses : [])
        setFssaiNumbers(fssaiList.filter(Boolean))

        // ── Barcodes (canonical list + legacy scalar fallback) ──
        const barcodeList = Array.isArray(product.barcodes) && product.barcodes.length
          ? product.barcodes
          : (product.barcode ? [product.barcode] : [])
        setBarcodes(barcodeList.filter(Boolean))

        // ── Certifications ──
        if (Array.isArray(product.certifications)) {
          setCertifications(product.certifications.filter(Boolean))
        }

        // ── Customer care ──
        const cc = product.customer_care || {}
        const phones = Array.isArray(cc.phone) ? cc.phone : (cc.phone ? [cc.phone] : [])
        setCustomerCareData({
          phones:  phones.join('\n'),
          email:   cc.email   || '',
          website: cc.website || '',
          address: cc.address || ''
        })

        // ── Regulatory / Other text ──
        if (Array.isArray(product.regulatory_text)) {
          setRegulatoryText(product.regulatory_text.join('\n'))
        } else if (typeof product.regulatory_text === 'string') {
          setRegulatoryText(product.regulatory_text)
        }
        if (Array.isArray(product.other_important_text)) {
          setOtherImportantText(product.other_important_text.join('\n'))
        } else if (typeof product.other_important_text === 'string') {
          setOtherImportantText(product.other_important_text)
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

  // ── Nomenclature (mirrors AddProduct) ────────────────────────────────────
  const loadNomenclature = async () => {
    try {
      const data = await nomenclatureService.getBuildMap()
      if (data && data.map) {
        setNomenclatureMap(data.map)
        const names = [...new Set(Object.values(data.map))].sort()
        setStandardizedNames(names)
      }
    } catch (e) {
      debugLog('[EDIT] Failed to load nomenclature:', e)
    }
  }

  useEffect(() => { loadNomenclature() }, [])

  const handleCreateNutrient = async (rowId, newNutrientName) => {
    const row = nutritionRowsRef.current.find(r => r.id === rowId)
    const rawName = row?.originalName?.trim()
    const result = await nomenclatureService.createNomenclature({
      standardized_name: newNutrientName,
      raw_names: rawName ? [rawName] : []
    })
    if (result.success !== false) {
      await loadNomenclature()
      setNutritionRows(prev => prev.map(r => r.id === rowId ? { ...r, nutrient: newNutrientName } : r))
    } else {
      alert(result.error || 'Failed to create nutrient')
      throw new Error(result.error)
    }
  }

  // Compute dynamic value column headers from all nutrition rows
  const valueColumns = (() => {
    const colSet = new Set()
    nutritionRows.forEach(r => {
      Object.keys(r.values || {}).forEach(k => colSet.add(k))
    })
    return Array.from(colSet)
  })()

  const handleAddNutritionRow = () => {
    const emptyValues = {}
    valueColumns.forEach(k => { emptyValues[k] = '' })
    setNutritionRows([
      ...nutritionRows,
      { id: Date.now(), nutrient: '', originalName: '', unit: '', values: emptyValues }
    ])
  }

  const handleNutritionChange = (id, field, value) =>
    setNutritionRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))

  const handleNutritionValueChange = (id, colKey, value) =>
    setNutritionRows(prev => prev.map(r => r.id === id ? { ...r, values: { ...r.values, [colKey]: value } } : r))

  const handleRemoveNutritionRow = (id) => {
    setNutritionRows(nutritionRows.filter(row => row.id !== id))
  }

  const handleAddNutritionNote = () => {
    if (newNutritionNote.trim()) {
      setNutritionNotes([...nutritionNotes, newNutritionNote.trim()])
      setNewNutritionNote('')
    }
  }
  const handleRemoveNutritionNote = (idx) =>
    setNutritionNotes(nutritionNotes.filter((_, i) => i !== idx))

  const handleSaveProduct = async () => {
    if (!formData.productName || !formData.brand) {
      alert('Please fill in all required fields (*)')
      return
    }

    try {
      const nutritionTable = nutritionRows.map(row => ({
        nutrient_name: row.nutrient,
        original_name: row.originalName || row.nutrient,
        unit:          row.unit || '',
        values:        row.values || {},
      }))

      // Build manufacturer entries the same way Add Product does: each
      // textarea block becomes one entry under its type. The Compare page
      // joins name + address + license back together for display.
      const buildEntries = (text, type) => text
        .split(/\n\s*\n+/)
        .map(s => s.trim())
        .filter(Boolean)
        .map(block => ({ type, name: block, address: '', license_number: '' }))

      const manufacturerInformation = [
        ...buildEntries(companyData.marketedBy,     'Marketed By'),
        ...buildEntries(companyData.manufacturedBy, 'Manufactured By'),
        ...buildEntries(companyData.packedBy,       'Packed By'),
      ]

      const productData = {
        product_name: formData.productName,
        parent_brand: formData.brand,
        sub_brand: formData.subBrand || null,
        variant: formData.variant || null,
        net_quantity: formData.packSize || null,
        pack_size: formData.packSize || null,
        serving_size: formData.serveSize || null,
        servings_per_pack: formData.servingsPerPack || null,
        mrp: formData.mrp ? parseFloat(formData.mrp) : null,
        uspf: formData.uspf || null,
        packing_format: formData.packingFormat || null,
        veg_nonveg: formData.vegNonVeg || null,
        category: formData.category || null,
        nutrition_table: nutritionTable,
        nutrition_notes: nutritionNotes,
        ingredients: ingredients.join(', ') || null,
        allergen_information: allergens.join(', ') || null,
        claims: claims,
        storage_instructions: storageData.storageCondition
          ? storageData.storageCondition.split('\n').map(s => s.trim()).filter(Boolean)
          : [],
        usage_instructions: {
          directions_to_use: directionsToUse.split('\n').map(s => s.trim()).filter(Boolean),
          preparation_method: preparationMethod.split('\n').map(s => s.trim()).filter(Boolean),
        },
        shelf_life: formData.shelfLife || storageData.shelfLife || null,
        // Canonical company-tab payload (mirrors AddProduct):
        manufacturer_information: manufacturerInformation,
        brand_owner: companyData.brandOwner || null,
        batch_information: {
          lot_number:   batchData.lotNumber   || '',
          machine_code: batchData.machineCode || '',
          other_codes:  batchData.otherCodes.split('\n').map(s => s.trim()).filter(Boolean),
        },
        packaging_information: {
          packaging_material_manufacturer: packagingData.manufacturer || '',
          packaging_codes: packagingData.codes.split('\n').map(s => s.trim()).filter(Boolean),
        },
        fssai_information: { license_numbers: fssaiNumbers },
        barcodes: barcodes,
        certifications: certifications,
        customer_care: {
          phone:   customerCareData.phones.split('\n').map(s => s.trim()).filter(Boolean),
          email:   customerCareData.email   || '',
          website: customerCareData.website || '',
          address: customerCareData.address || '',
        },
        regulatory_text:      regulatoryText.split('\n').map(s => s.trim()).filter(Boolean),
        other_important_text: otherImportantText.split('\n').map(s => s.trim()).filter(Boolean),
        manufacturing_date: formData.manufactured || null,
        expiry_date: formData.expiry || null,
        status: 'published'
      }

      debugLog('[EDIT] Updating product:', productData)

      const response = await apiRequest(`/products/${id}`, {
        method: 'PUT',
        body: JSON.stringify(productData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to update product')
      }

      debugLog('[EDIT] Product updated successfully:', result)
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

                  {/* Servings Per Pack */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      Servings Per Pack
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., 10"
                        value={formData.servingsPerPack}
                        onChange={(e) => setFormData({ ...formData, servingsPerPack: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.servingsPerPack} field="servingsPerPack" />
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

                  {/* USPF */}
                  <div>
                    <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block">
                      USPF — Unit Selling Price Format
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., ₹50 per 30g sachet"
                        value={formData.uspf}
                        onChange={(e) => setFormData({ ...formData, uspf: e.target.value })}
                        className="w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <CopyBtn value={formData.uspf} field="uspf" />
                    </div>
                  </div>

                  {/* Packing Format — user choice only; not from AI */}
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
                        <option value="">None</option>
                        {['sachet','bottle','pouch','jar','can','tetra pack','carton','box','tub','pack','bag','wrapper','tube','blister pack','strip','container','drum','barrel','clamshell','standup pouch'].map(f => (
                          <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                        ))}
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
                        {categories.map((category) => (
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

            </div>
          )}

          {/* Nutrition Tab */}
          {activeTab === 'nutrition' && (
            <div className="space-y-6">
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">Nutritional Information</h3>
                  <div className="flex items-center gap-2">
                    {nutritionRows.length > 0 && (
                      <CopyBtnStandalone
                        value={`Nutrient Name\tMapped Nutrient\tUnit\t${valueColumns.join('\t')}\n${nutritionRows.map(r => `${r.originalName || ''}\t${r.nutrient}\t${r.unit}\t${valueColumns.map(c => (r.values || {})[c] || '').join('\t')}`).join('\n')}`}
                        field="edit_nutritionTable" />
                    )}
                    <button onClick={handleAddNutritionRow} className={addBtnClass}>Add Row</button>
                  </div>
                </div>

                <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                  {nutritionRows.length === 0
                    ? 'No nutrition data. Add rows manually.'
                    : 'Review and edit nutrition data.'}
                </p>

                {nutritionRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-[#e1e7ef]">
                          <th className="px-1 py-2 text-left"><span className="text-sm font-ibm-plex font-medium text-[#0f1729]">Nutrient Name</span></th>
                          <th className="px-1 py-2 text-left"><span className="text-sm font-ibm-plex font-medium text-[#0f1729]">Mapped Nutrient</span></th>
                          <th className="px-1 py-2 text-left"><span className="text-sm font-ibm-plex font-medium text-[#0f1729]">Unit</span></th>
                          {valueColumns.map(col => (
                            <th key={col} className="px-1 py-2 text-left">
                              <span className="text-sm font-ibm-plex font-medium text-[#0f1729] whitespace-nowrap">{col}</span>
                            </th>
                          ))}
                          <th className="px-1 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {nutritionRows.map(row => (
                          <tr key={row.id} className="border-b border-[#e1e7ef]">
                            <td className="px-1 py-2">
                              <input type="text" value={row.originalName || ''} placeholder="e.g., crude protein"
                                onChange={(e) => handleNutritionChange(row.id, 'originalName', e.target.value)}
                                className="w-full min-w-[120px] px-0 py-2 bg-transparent border-0 text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none" />
                            </td>
                            <td className="px-1 py-2">
                              <NutrientMappingDropdown
                                value={row.nutrient}
                                standardizedNames={standardizedNames}
                                onSelect={(name) => handleNutritionChange(row.id, 'nutrient', name)}
                                onCreateNew={(name) => handleCreateNutrient(row.id, name)}
                              />
                            </td>
                            <td className="px-1 py-2">
                              <input type="text" value={row.unit} placeholder="g"
                                onChange={(e) => handleNutritionChange(row.id, 'unit', e.target.value)}
                                className="w-16 h-10 px-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                            </td>
                            {valueColumns.map(col => (
                              <td key={col} className="px-1 py-2">
                                <input type="text" value={(row.values || {})[col] || ''}
                                  onChange={(e) => handleNutritionValueChange(row.id, col, e.target.value)}
                                  className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                              </td>
                            ))}
                            <td className="px-1 py-2 text-center">
                              <button onClick={() => handleRemoveNutritionRow(row.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors"
                                title="Remove">
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

              {/* Nutrition Notes */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <SectionHeader title="Nutrition Notes" copyValue={nutritionNotes.join(' | ')} copyField="edit_nutNotes" />
                <p className="text-xs text-[#65758b] mb-3">Footnotes, %RDA references, or disclaimers printed below the nutrition table.</p>
                <ChipInput value={newNutritionNote} onChange={setNewNutritionNote} onAdd={handleAddNutritionNote}
                  placeholder="e.g., *RDA based on 2000 kcal diet" />
                {nutritionNotes.length > 0 && (
                  <ChipList items={nutritionNotes} onRemove={handleRemoveNutritionNote}
                    colorClass="bg-yellow-50 border border-yellow-200 text-yellow-900" />
                )}
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
                      Storage Conditions
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729]">
                        Directions to Use
                      </label>
                      <CopyBtnStandalone value={directionsToUse} field="directionsToUse" />
                    </div>
                    <textarea
                      placeholder="One direction per line"
                      value={directionsToUse}
                      onChange={(e) => setDirectionsToUse(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className="text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729]">
                        Preparation Method
                      </label>
                      <CopyBtnStandalone value={preparationMethod} field="preparationMethod" />
                    </div>
                    <textarea
                      placeholder="One step per line"
                      value={preparationMethod}
                      onChange={(e) => setPreparationMethod(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-4 md:space-y-6">
              {/* Company Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Company Information</h3>
                {[
                  { key: 'marketedBy',     label: 'Marketed By',     placeholder: 'Name, address, license (one entry per block, separate with blank line)' },
                  { key: 'manufacturedBy', label: 'Manufactured By', placeholder: 'Name, address, license (one entry per block, separate with blank line)' },
                  { key: 'packedBy',       label: 'Packed By',       placeholder: 'Name, address, license (one entry per block, separate with blank line)' },
                ].map(({ key, label, placeholder }) => (
                  <div key={key} className="mb-3 md:mb-4">
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block', '')}>{label}</label>
                      <CopyBtnStandalone value={companyData[key]} field={`edit_${key}`} />
                    </div>
                    <textarea placeholder={placeholder} value={companyData[key]} rows={3}
                      onChange={(e) => setCompanyData({ ...companyData, [key]: e.target.value })}
                      className={textareaClass} />
                  </div>
                ))}
              </div>

              {/* Batch Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Batch Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div>
                    <label className={labelClass}>Lot / Batch Number</label>
                    <div className="relative">
                      <input type="text" placeholder="e.g., B1025L4" value={batchData.lotNumber}
                        onChange={(e) => setBatchData({ ...batchData, lotNumber: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={batchData.lotNumber} field="edit_lotNumber" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Machine Code</label>
                    <div className="relative">
                      <input type="text" placeholder="Alphanumeric machine code" value={batchData.machineCode}
                        onChange={(e) => setBatchData({ ...batchData, machineCode: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={batchData.machineCode} field="edit_machineCode" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className={labelClass.replace('block', '')}>Other Codes</label>
                    <CopyBtnStandalone value={batchData.otherCodes} field="edit_otherCodes" />
                  </div>
                  <textarea placeholder="One code per line" value={batchData.otherCodes}
                    onChange={(e) => setBatchData({ ...batchData, otherCodes: e.target.value })} rows={3}
                    className={textareaClass} />
                </div>
              </div>

              {/* Packaging Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Packaging Information</h3>
                <div className="mb-3 md:mb-4">
                  <label className={labelClass}>Packaging Material Manufacturer</label>
                  <div className="relative">
                    <input type="text" placeholder="Manufacturer of packaging material"
                      value={packagingData.manufacturer}
                      onChange={(e) => setPackagingData({ ...packagingData, manufacturer: e.target.value })}
                      className={inputClass} />
                    <CopyBtn value={packagingData.manufacturer} field="edit_packMfr" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className={labelClass.replace('block', '')}>Packaging Codes</label>
                    <CopyBtnStandalone value={packagingData.codes} field="edit_packCodes" />
                  </div>
                  <textarea placeholder="One code per line" value={packagingData.codes}
                    onChange={(e) => setPackagingData({ ...packagingData, codes: e.target.value })} rows={3}
                    className={textareaClass} />
                </div>
              </div>

              {/* Regulatory Information (multi FSSAI + Barcodes) */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Regulatory Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={labelClass}>FSSAI License Numbers</label>
                    <ChipInput value={newFssaiNumber} onChange={setNewFssaiNumber} onAdd={handleAddFssai}
                      placeholder="14-digit FSSAI number" />
                    {fssaiNumbers.length > 0 && (
                      <ChipList items={fssaiNumbers} onRemove={handleRemoveFssai}
                        colorClass="bg-blue-50 border border-blue-200 text-blue-900" />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Barcodes / EAN</label>
                    <ChipInput value={newBarcode} onChange={setNewBarcode} onAdd={handleAddBarcode}
                      placeholder="Enter barcode number" />
                    {barcodes.length > 0 && (
                      <ChipList items={barcodes} onRemove={handleRemoveBarcode}
                        colorClass="bg-gray-100 border border-[#e1e7ef] text-[#0f1729]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Certifications */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <SectionHeader title="Certifications" copyValue={certifications.join(', ')} copyField="edit_certs" />
                <ChipInput value={newCertification} onChange={setNewCertification} onAdd={handleAddCert}
                  placeholder="e.g., FSSAI, ISO 22000, HACCP" />
                {certifications.length > 0 && (
                  <ChipList items={certifications} onRemove={handleRemoveCert}
                    colorClass="bg-green-50 border border-green-200 text-green-900" />
                )}
              </div>

              {/* Customer Care */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Customer Care</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                  <div>
                    <label className={labelClass}>Email</label>
                    <div className="relative">
                      <input type="text" placeholder="support@example.com" value={customerCareData.email}
                        onChange={(e) => setCustomerCareData({ ...customerCareData, email: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={customerCareData.email} field="edit_ccEmail" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <div className="relative">
                      <input type="text" placeholder="www.example.com" value={customerCareData.website}
                        onChange={(e) => setCustomerCareData({ ...customerCareData, website: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={customerCareData.website} field="edit_ccWebsite" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block', '')}>Phone Numbers</label>
                      <CopyBtnStandalone value={customerCareData.phones} field="edit_ccPhones" />
                    </div>
                    <textarea placeholder="One phone number per line" value={customerCareData.phones}
                      onChange={(e) => setCustomerCareData({ ...customerCareData, phones: e.target.value })} rows={3}
                      className={textareaClass} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block', '')}>Address</label>
                      <CopyBtnStandalone value={customerCareData.address} field="edit_ccAddress" />
                    </div>
                    <textarea placeholder="Customer care address" value={customerCareData.address}
                      onChange={(e) => setCustomerCareData({ ...customerCareData, address: e.target.value })} rows={3}
                      className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Additional Notes & Regulatory Text */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Additional Notes & Regulatory</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block', '')}>Regulatory Text</label>
                      <CopyBtnStandalone value={regulatoryText} field="edit_regulatoryText" />
                    </div>
                    <textarea placeholder="Legal/regulatory statements on pack (one per line)" value={regulatoryText}
                      onChange={(e) => setRegulatoryText(e.target.value)} rows={3}
                      className={textareaClass} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block', '')}>Other Important Text</label>
                      <CopyBtnStandalone value={otherImportantText} field="edit_otherImportantText" />
                    </div>
                    <textarea placeholder="Slogans, taglines, marketing text, disclaimers (one per line)" value={otherImportantText}
                      onChange={(e) => setOtherImportantText(e.target.value)} rows={3}
                      className={textareaClass} />
                  </div>
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



