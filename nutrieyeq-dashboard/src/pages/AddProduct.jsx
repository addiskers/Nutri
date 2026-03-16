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

  // ── Image states ───────────────────────────────────────────────────────────
  const [images, setImages] = useState([
    { id: 1, label: 'Front',   file: null, dataUrl: null },
    { id: 2, label: 'Back',    file: null, dataUrl: null },
    { id: 3, label: 'Side 1',  file: null, dataUrl: null },
    { id: 4, label: 'Side 2',  file: null, dataUrl: null },
    { id: 5, label: 'Add Image', file: null, dataUrl: null }
  ])

  // ── Extraction states ──────────────────────────────────────────────────────
  const [isExtracting, setIsExtracting]         = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [extractionError, setExtractionError]   = useState(null)
  const [extractionCost, setExtractionCost]     = useState(null)
  const [isSaving, setIsSaving]                 = useState(false)

  // ── Basic form data ────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    productName: '', brand: '', subBrand: '', variant: '',
    packSize: '', servingsPerPack: '', mrp: '', uspf: '',
    manufactured: '', expiry: '', bestBefore: '', shelfLife: '',
    serveSize: '', category: '', vegNonVeg: '', packingFormat: ''
  })

  // ── Claims / Tags ──────────────────────────────────────────────────────────
  const [claims, setClaims]             = useState([])
  const [newClaim, setNewClaim]         = useState('')
  const predefinedTags = [
    'Kids Nutrition','Dairy Mix','Protein Drink','Sugar Free','Gluten Free',
    'Organic','High Protein','Low Fat','Fortified','Natural',
    'Premium','Value Pack','Personal Care','Hygiene','Sanitizer','IMA Recommended'
  ]
  const [selectedTags, setSelectedTags] = useState([])

  // ── Nutrition ──────────────────────────────────────────────────────────────
  const [nutritionRows, setNutritionRows]       = useState([])
  const [nutritionNotes, setNutritionNotes]     = useState([])
  const [newNutritionNote, setNewNutritionNote] = useState('')

  // ── Composition ───────────────────────────────────────────────────────────
  const [ingredients, setIngredients]   = useState([])
  const [newIngredient, setNewIngredient] = useState('')
  const [allergens, setAllergens]       = useState([])
  const [newAllergen, setNewAllergen]   = useState('')

  const [storageData, setStorageData] = useState({
    shelfLife: '', storageCondition: ''
  })
  const [directionsToUse, setDirectionsToUse]     = useState('')
  const [preparationMethod, setPreparationMethod] = useState('')
  const [medicalInfo, setMedicalInfo] = useState({
    intendedUse: '', warnings: '', contraindications: ''
  })

  // ── Company ───────────────────────────────────────────────────────────────
  const [companyData, setCompanyData] = useState({
    brandOwner: '', marketedBy: '', manufacturedBy: '', packedBy: '', otherNotes: ''
  })
  const [fssaiNumbers, setFssaiNumbers]     = useState([])
  const [newFssaiNumber, setNewFssaiNumber] = useState('')
  const [barcodes, setBarcodes]             = useState([])
  const [newBarcode, setNewBarcode]         = useState('')
  const [certifications, setCertifications]       = useState([])
  const [newCertification, setNewCertification]   = useState('')
  const [packagingData, setPackagingData] = useState({ manufacturer: '', codes: '' })
  const [batchData, setBatchData]         = useState({ lotNumber: '', machineCode: '', otherCodes: '' })
  const [customerCareData, setCustomerCareData] = useState({ phones: '', email: '', website: '', address: '' })
  const [regulatoryText, setRegulatoryText]     = useState('')
  const [footnotes, setFootnotes]               = useState('')
  const [otherImportantText, setOtherImportantText] = useState('')

  // ── Copy helper ───────────────────────────────────────────────────────────
  const [copiedField, setCopiedField] = useState(null)
  const copyToClipboard = (text, fieldName) => {
    if (!text) return
    navigator.clipboard.writeText(String(text))
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 1500)
  }
  const CopyBtn = ({ value, field }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); copyToClipboard(value, field) }}
      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
      title={copiedField === field ? 'Copied!' : 'Copy'}>
      {copiedField === field ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#65758b]" />}
    </button>
  )
  const CopyBtnStandalone = ({ value, field }) => (
    <button type="button" onClick={(e) => { e.preventDefault(); copyToClipboard(value, field) }}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 transition-colors flex-shrink-0"
      title={copiedField === field ? 'Copied!' : 'Copy'}>
      {copiedField === field ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-[#65758b]" />}
    </button>
  )

  // ── Reusable chip-list helpers ─────────────────────────────────────────────
  const inputClass = "w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
  const textareaClass = "w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
  const addBtnClass  = "bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
  const labelClass   = "text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block"

  const tabs = [
    { id: 'basic',       label: 'Basic Info'   },
    { id: 'nutrition',   label: 'Nutrition'    },
    { id: 'composition', label: 'Composition'  },
    { id: 'company',     label: 'Company'      }
  ]

  // ── Image handlers ─────────────────────────────────────────────────────────
  const handleAddMoreImages = () => {
    if (images.length < 10)
      setImages([...images, { id: images.length + 1, label: `Image ${images.length + 1}`, file: null, dataUrl: null }])
  }
  const handleImageCropped = (index, imageData, cropData) => {
    const updated = [...images]
    updated[index].file   = { imageData, cropData }
    updated[index].dataUrl = imageData
    setImages(updated)
  }

  // ── Extraction ─────────────────────────────────────────────────────────────
  const handleSubmitImages = async () => {
    if (isExtracting) return
    const uploaded = images.filter(img => img.dataUrl !== null)
    if (uploaded.length === 0) { setExtractionError('Please upload at least one image'); return }
    setIsExtracting(true); setExtractionError(null); setExtractionComplete(false)
    try {
      const result = await productService.extractFromImages(uploaded.map(img => img.dataUrl))
      if (result.success && result.data) {
        populateFormFromExtraction(result.data)
        setExtractionComplete(true)
        setExtractionCost(result.cost)
      } else {
        setExtractionError(result.error || 'Extraction failed')
      }
    } catch (err) {
      setExtractionError(err.message || 'Failed to extract data from images')
    } finally {
      setIsExtracting(false)
    }
  }

  const populateFormFromExtraction = (data) => {
    // Basic info
    if (data.basic) {
      setFormData(prev => ({
        ...prev,
        productName:     data.basic.productName     || prev.productName,
        brand:           data.basic.brand           || prev.brand,
        subBrand:        data.basic.subBrand        || prev.subBrand,
        variant:         data.basic.variant         || prev.variant,
        packSize:        data.basic.packSize        || prev.packSize,
        servingsPerPack: data.basic.servingsPerPack || prev.servingsPerPack,
        serveSize:       data.basic.serveSize       || prev.serveSize,
        mrp:             data.basic.mrp             || prev.mrp,
        uspf:            data.basic.uspf            || prev.uspf,
        packingFormat:   data.basic.packingFormat   || prev.packingFormat,
        manufactured:    data.basic.manufactured    || prev.manufactured,
        expiry:          data.basic.expiry          || prev.expiry,
        bestBefore:      data.basic.bestBefore      || prev.bestBefore,
        shelfLife:       data.basic.shelfLife       || prev.shelfLife,
        category:        data.basic.category        || prev.category,
        vegNonVeg:
          data.basic.vegNonVeg === 'Vegetarian'     ? 'veg' :
          data.basic.vegNonVeg === 'Non-Vegetarian' ? 'non-veg' :
          data.basic.vegNonVeg?.toLowerCase()       || prev.vegNonVeg,
      }))
    }

    // Dates fallback
    if (data.dates) {
      setFormData(prev => ({
        ...prev,
        manufactured: data.dates.manufacturing_date || prev.manufactured,
        expiry:       data.dates.expiry_date        || prev.expiry,
        bestBefore:   data.dates.best_before        || prev.bestBefore,
        shelfLife:    data.dates.shelf_life         || prev.shelfLife,
      }))
    }

    // Nutrition — new format: data.nutrition = { table: [], notes: [] }
    const nutritionSrc = data.nutrition || {}
    const tableArr = Array.isArray(nutritionSrc) ? nutritionSrc
                   : Array.isArray(nutritionSrc.table) ? nutritionSrc.table : []
    if (tableArr.length > 0) {
      const rows = tableArr.map((item, idx) => {
        const vals   = item.values || {}
        const p100k  = Object.keys(vals).find(k => k.toLowerCase().includes('100'))
        const pServeK = Object.keys(vals).find(k => k.toLowerCase().includes('serve'))
        const rdaK   = Object.keys(vals).find(k => k.toLowerCase().includes('rda') || k.includes('%'))
        return {
          id:       idx + 1,
          nutrient: item.nutrient_name || '',
          unit:     item.unit          || '',
          per100g:  p100k   ? (vals[p100k]  || '') : '',
          perServe: pServeK ? (vals[pServeK] || '') : '',
          rda:      rdaK    ? (vals[rdaK]    || '') : '',
        }
      })
      setNutritionRows(rows)
    }
    if (Array.isArray(nutritionSrc.notes) && nutritionSrc.notes.length > 0) {
      setNutritionNotes(nutritionSrc.notes.filter(Boolean))
    }

    // Composition
    if (data.composition) {
      const comp = data.composition
      if (comp.ingredients) {
        const str = comp.ingredients
        if (typeof str === 'string' && str.length > 0) {
          const list = []
          let cur = '', depth = 0
          for (const ch of str) {
            if (ch === '(') depth++
            if (ch === ')') depth--
            if (ch === ',' && depth === 0) { list.push(cur.trim()); cur = '' }
            else cur += ch
          }
          if (cur.trim()) list.push(cur.trim())
          setIngredients(list)
        }
      }
      if (comp.allergenInfo && comp.allergenInfo !== 'not specified') {
        setAllergens(comp.allergenInfo.split(',').map(a => a.trim()).filter(Boolean))
      }
      if (Array.isArray(comp.claims)) {
        setClaims(comp.claims.filter(c => c && c !== 'not specified'))
      }
      // Storage instructions (array or string)
      if (comp.storageInstructions) {
        const si = comp.storageInstructions
        setStorageData(prev => ({
          ...prev,
          storageCondition: Array.isArray(si) ? si.join('\n') : (si !== 'not specified' ? si : '')
        }))
      }
      // Usage instructions
      if (comp.usageInstructions) {
        const ui = comp.usageInstructions
        if (typeof ui === 'object') {
          setDirectionsToUse((ui.directions_to_use || []).join('\n'))
          setPreparationMethod((ui.preparation_method || []).join('\n'))
        } else if (typeof ui === 'string' && ui !== 'not specified') {
          setDirectionsToUse(ui)
        }
      }
      // Medical information
      if (comp.medicalInformation) {
        const mi = comp.medicalInformation
        setMedicalInfo({
          intendedUse:      (mi.intended_use     || []).join('\n'),
          warnings:         (mi.warnings         || []).join('\n'),
          contraindications:(mi.contraindications|| []).join('\n'),
        })
      }
    }

    // Company
    if (data.company) {
      const co = data.company
      if (Array.isArray(co.manufacturerDetails)) {
        for (const mfg of co.manufacturerDetails) {
          const type = (mfg.type || '').toLowerCase()
          const full = [mfg.name, mfg.address].filter(Boolean).join(', ')
          if (type.includes('manufactur')) setCompanyData(prev => ({ ...prev, manufacturedBy: full }))
          else if (type.includes('pack'))   setCompanyData(prev => ({ ...prev, packedBy: full }))
          else if (type.includes('market')) setCompanyData(prev => ({ ...prev, marketedBy: full }))
          if ((mfg.license_number || mfg.fssai) && mfg.license_number !== 'not specified')
            setFssaiNumbers(prev => prev.includes(mfg.license_number || mfg.fssai) ? prev : [...prev, mfg.license_number || mfg.fssai])
        }
      }
      if (co.fssaiInformation?.license_numbers) {
        setFssaiNumbers(co.fssaiInformation.license_numbers.filter(Boolean))
      }
      if (Array.isArray(co.barcodes) && co.barcodes.length > 0) {
        setBarcodes(co.barcodes.filter(Boolean))
      }
      if (Array.isArray(co.certifications) && co.certifications.length > 0) {
        setCertifications(co.certifications.filter(Boolean))
      }
      if (co.packagingInformation) {
        setPackagingData({
          manufacturer: co.packagingInformation.packaging_material_manufacturer || '',
          codes: (co.packagingInformation.packaging_codes || []).join('\n'),
        })
      }
      if (co.customerCare) {
        const cc = co.customerCare
        setCustomerCareData({
          phones:  (cc.phone || []).join('\n'),
          email:   cc.email   || '',
          website: cc.website || '',
          address: cc.address || '',
        })
      }
    }

    // Batch
    if (data.batch) {
      setBatchData({
        lotNumber:   data.batch.lot_number   || '',
        machineCode: data.batch.machine_code || '',
        otherCodes:  (data.batch.other_codes || []).join('\n'),
      })
    }

    // Regulatory / other
    if (Array.isArray(data.regulatory) && data.regulatory.length > 0)
      setRegulatoryText(data.regulatory.join('\n'))
    if (Array.isArray(data.footnotes) && data.footnotes.length > 0)
      setFootnotes(data.footnotes.join('\n'))
    if (Array.isArray(data.other) && data.other.length > 0)
      setOtherImportantText(data.other.join('\n'))
  }

  // ── Nutrition row helpers ──────────────────────────────────────────────────
  const handleAddNutritionRow = () =>
    setNutritionRows([...nutritionRows, { id: Date.now(), nutrient: '', unit: '', per100g: '', perServe: '', rda: '' }])
  const handleNutritionChange = (id, field, value) =>
    setNutritionRows(nutritionRows.map(r => r.id === id ? { ...r, [field]: value } : r))
  const handleRemoveNutritionRow = (id) =>
    setNutritionRows(nutritionRows.filter(r => r.id !== id))

  // ── Chip-list helpers ──────────────────────────────────────────────────────
  const makeChipAdder = (list, setList, newVal, setNew) => () => {
    if (newVal.trim()) { setList([...list, newVal.trim()]); setNew('') }
  }
  const makeChipRemover = (list, setList) => (idx) => setList(list.filter((_, i) => i !== idx))

  const handleAddClaim       = makeChipAdder(claims,        setClaims,       newClaim,       setNewClaim)
  const handleAddIngredient  = makeChipAdder(ingredients,   setIngredients,  newIngredient,  setNewIngredient)
  const handleAddAllergen    = makeChipAdder(allergens,      setAllergens,    newAllergen,    setNewAllergen)
  const handleAddNote        = makeChipAdder(nutritionNotes, setNutritionNotes, newNutritionNote, setNewNutritionNote)
  const handleAddFssai       = makeChipAdder(fssaiNumbers,  setFssaiNumbers, newFssaiNumber, setNewFssaiNumber)
  const handleAddBarcode     = makeChipAdder(barcodes,      setBarcodes,     newBarcode,     setNewBarcode)
  const handleAddCert        = makeChipAdder(certifications, setCertifications, newCertification, setNewCertification)

  const handleRemoveClaim       = makeChipRemover(claims,        setClaims)
  const handleRemoveIngredient  = makeChipRemover(ingredients,   setIngredients)
  const handleRemoveAllergen    = makeChipRemover(allergens,      setAllergens)
  const handleRemoveNote        = makeChipRemover(nutritionNotes, setNutritionNotes)
  const handleRemoveFssai       = makeChipRemover(fssaiNumbers,  setFssaiNumbers)
  const handleRemoveBarcode     = makeChipRemover(barcodes,      setBarcodes)
  const handleRemoveCert        = makeChipRemover(certifications, setCertifications)

  const handleTagToggle = (tag) =>
    setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSaveProduct = async () => {
    if (!formData.productName || !formData.brand) { alert('Please fill in all required fields (*)'); return }
    setIsSaving(true)
    try {
      const productData = {
        product_name:    formData.productName,
        parent_brand:    formData.brand,
        sub_brand:       formData.subBrand       || null,
        variant:         formData.variant        || null,
        net_quantity:    formData.packSize       || null,
        net_weight:      formData.packSize       || null,
        pack_size:       formData.packSize       || null,
        serving_size:    formData.serveSize      || null,
        servings_per_pack: formData.servingsPerPack || null,
        packing_format:  formData.packingFormat  || null,
        mrp:             formData.mrp ? parseFloat(formData.mrp) : null,
        uspf:            formData.uspf           || null,
        veg_nonveg:      formData.vegNonVeg      || null,
        category:        formData.category       || null,

        nutrition_table: nutritionRows.map(row => ({
          nutrient_name: row.nutrient,
          unit:          row.unit || '',
          values: { 'Per 100g': row.per100g, 'Per Serve': row.perServe, '% RDA': row.rda }
        })),
        nutrition_notes: nutritionNotes,

        ingredients:           ingredients.join(', '),
        allergen_information:  allergens.join(', '),
        claims:                claims,

        medical_information: {
          intended_use:      medicalInfo.intendedUse.split('\n').filter(Boolean),
          warnings:          medicalInfo.warnings.split('\n').filter(Boolean),
          contraindications: medicalInfo.contraindications.split('\n').filter(Boolean),
        },
        usage_instructions: {
          directions_to_use: directionsToUse.split('\n').filter(Boolean),
          preparation_method: preparationMethod.split('\n').filter(Boolean),
        },
        storage_instructions: storageData.storageCondition.split('\n').filter(Boolean),
        shelf_life: storageData.shelfLife || null,

        manufacturer_information: [
          companyData.manufacturedBy && { type: 'Manufactured By', name: companyData.manufacturedBy, address: '', license_number: '' },
          companyData.packedBy       && { type: 'Manufactured By', name: companyData.packedBy,       address: '', license_number: '' },
          companyData.marketedBy     && { type: 'Marketed By',     name: companyData.marketedBy,     address: '', license_number: '' },
        ].filter(Boolean),
        manufacturer_details: [
          companyData.manufacturedBy && { type: 'Manufactured by', name: companyData.manufacturedBy },
          companyData.marketedBy     && { type: 'Marketed by',     name: companyData.marketedBy },
        ].filter(Boolean),
        brand_owner:       companyData.brandOwner || null,

        fssai_information: { license_numbers: fssaiNumbers },
        fssai_licenses:    fssaiNumbers,

        barcodes:          barcodes,
        barcode:           barcodes[0] || null,

        certifications:    certifications,

        packaging_information: {
          packaging_material_manufacturer: packagingData.manufacturer,
          packaging_codes: packagingData.codes.split('\n').filter(Boolean),
        },
        batch_information: {
          lot_number:   batchData.lotNumber,
          machine_code: batchData.machineCode,
          other_codes:  batchData.otherCodes.split('\n').filter(Boolean),
        },
        customer_care: {
          phone:   customerCareData.phones.split('\n').filter(Boolean),
          email:   customerCareData.email,
          website: customerCareData.website,
          address: customerCareData.address,
        },

        manufacturing_date: formData.manufactured || null,
        expiry_date:        formData.expiry       || null,
        best_before:        formData.bestBefore   || null,

        regulatory_text:      regulatoryText.split('\n').filter(Boolean),
        footnotes:            footnotes.split('\n').filter(Boolean),
        other_important_text: otherImportantText.split('\n').filter(Boolean),

        tags:   selectedTags,
        images: images.filter(img => img.dataUrl).map(img => img.dataUrl),
        status: 'published',
      }

      const result = await productService.createProduct(productData)
      if (result.success) {
        alert('Product saved successfully!')
        navigate('/products')
      } else {
        alert(`Failed to save product: ${result.error}`)
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save product. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // ── Chip list renderer ─────────────────────────────────────────────────────
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

  const ChipInput = ({ value, onChange, onAdd, onKeyPress, placeholder, btnLabel = 'Add' }) => (
    <div className="flex gap-2">
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        className="flex-1 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary" />
      <button onClick={onAdd} className={addBtnClass}>{btnLabel}</button>
    </div>
  )

  const SectionHeader = ({ title, copyValue, copyField }) => (
    <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
      <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">{title}</h3>
      {copyValue && <CopyBtnStandalone value={copyValue} field={copyField} />}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <Layout>
      {!hasPermission ? (
        <NoPermissionContent pageName="Add Product Page" />
      ) : (
        <div className="overflow-y-auto h-full">
          <div className="max-w-6xl mx-auto p-4 md:p-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
              <button onClick={() => navigate('/products')}
                className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors sm:mt-1">
                <ArrowLeft className="w-4 h-4 text-[#0f1729]" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">Add New Product</h1>
                <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">Upload images and let AI extract product data automatically</p>
              </div>
              <button onClick={handleSaveProduct} disabled={isSaving}
                className="bg-[#b455a0] flex items-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? 'Saving...' : 'Save Product'}
              </button>
            </div>

            {/* Product Images */}
            <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6 mb-4 md:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-2 border-b border-[#e1e7ef]">
                <div>
                  <h2 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">Product Images</h2>
                  <p className="text-xs text-[#65758b] mt-0.5">Upload up to 10 images • Click to crop • Then submit for AI extraction</p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <button onClick={handleAddMoreImages} disabled={images.length >= 10}
                    className="bg-[#f9fafb] border border-[#e1e7ef] flex items-center justify-center gap-2 h-10 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm text-[#0f1729] hover:bg-gray-100 transition-colors flex-1 sm:flex-none disabled:opacity-50">
                    <Plus className="w-4 h-4" /><span>Add More</span>
                  </button>
                  <button onClick={handleSubmitImages} disabled={isExtracting || images.every(img => !img.dataUrl)}
                    className="bg-[#009da5] border border-[#5bc4bf] h-10 px-3 md:px-4 py-2 rounded-md font-ibm-plex font-medium text-xs md:text-sm text-white hover:bg-[#008891] transition-colors flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center">
                    {isExtracting ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Extracting...</span></>
                                  : <><Sparkles className="w-4 h-4" /><span>Extract Data</span></>}
                  </button>
                </div>
              </div>

              {extractionComplete && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-green-800">Extraction Complete!</p>
                    <p className="text-xs text-green-700 mt-0.5">Data has been extracted and filled below. Review and edit before saving.</p>
                    {extractionCost && (
                      <p className="text-xs text-green-600 mt-1">
                        Cost — OCR: ${extractionCost.ocr?.total_cost?.toFixed(6)} | Structure: ${extractionCost.structure?.total_cost?.toFixed(6)} | Total: ${extractionCost.grand_total?.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {extractionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-red-800">Extraction Failed</p>
                    <p className="text-xs text-red-700 mt-0.5">{extractionError}</p>
                  </div>
                </div>
              )}
              {isExtracting && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center gap-3">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-blue-800">Extracting product data...</p>
                    <p className="text-xs text-blue-700 mt-0.5">This may take 15-45 seconds (two-step OCR pipeline)</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4 mb-3 md:mb-4">
                {images.map((img, index) => (
                  <ImageUploadWithCrop key={img.id} label={img.label}
                    onImageCropped={(imageData, cropData) => handleImageCropped(index, imageData, cropData)}
                    onRemove={() => { const n=[...images]; n[index].file=null; n[index].dataUrl=null; setImages(n) }} />
                ))}
              </div>
              <p className="text-xs md:text-sm font-ibm-plex text-[#65758b]">
                Upload front, back, nutrition table, and ingredients images for best results. Supported: JPG, PNG, WebP
              </p>
            </div>

            {/* Tabs */}
            <div className="bg-[#ebebeb] rounded-md p-1 mb-4 md:mb-6 overflow-x-auto">
              <div className="flex gap-1 min-w-max sm:min-w-0">
                {tabs.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-3 sm:px-4 md:px-6 py-2 rounded text-xs sm:text-sm font-ibm-plex font-medium transition-all whitespace-nowrap ${
                      activeTab === tab.id ? 'bg-[#f9fafb] text-[#0f1729] shadow-sm' : 'text-[#65758b] hover:text-[#0f1729]'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ══════════════ BASIC INFO TAB ══════════════ */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Basic Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

                    {[
                      { label:'Product Name *', key:'productName', placeholder:'Enter product name', req:true },
                      { label:'Brand *',         key:'brand',       placeholder:'Enter brand name',    req:true },
                      { label:'Sub Brand',       key:'subBrand',    placeholder:'e.g., Junior, Pro, Lite' },
                      { label:'Variant',         key:'variant',     placeholder:'e.g., Chocolate, Vanilla' },
                      { label:'Net Quantity / Pack Size', key:'packSize',  placeholder:'e.g., 500g, 1L' },
                      { label:'Serve Size',      key:'serveSize',   placeholder:'e.g., 30g, 200ml' },
                      { label:'Servings Per Pack',key:'servingsPerPack', placeholder:'e.g., 10' },
                    ].map(({ label, key, placeholder, req }) => (
                      <div key={key}>
                        <label className={labelClass}>{label}</label>
                        <div className="relative">
                          <input type="text" placeholder={placeholder} value={formData[key]} required={req}
                            onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                            className={inputClass} />
                          <CopyBtn value={formData[key]} field={`add_${key}`} />
                        </div>
                      </div>
                    ))}

                    {/* MRP */}
                    <div>
                      <label className={labelClass}>MRP (₹)</label>
                      <div className="relative">
                        <input type="number" placeholder="0.00" value={formData.mrp}
                          onChange={e => setFormData({ ...formData, mrp: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.mrp} field="add_mrp" />
                      </div>
                    </div>

                    {/* USPF */}
                    <div>
                      <label className={labelClass}>USPF — Unit Selling Price Format</label>
                      <div className="relative">
                        <input type="text" placeholder="e.g., ₹120.00/Unit, ₹0.14/g"
                          value={formData.uspf}
                          onChange={e => setFormData({ ...formData, uspf: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.uspf} field="add_uspf" />
                      </div>
                    </div>

                    {/* Packing Format */}
                    <div>
                      <label className={labelClass}>Packing Format</label>
                      <div className="relative">
                        <select value={formData.packingFormat}
                          onChange={e => setFormData({ ...formData, packingFormat: e.target.value })}
                          className={inputClass.replace('pr-9','pr-9')}>
                          <option value="">Select format</option>
                          {['sachet','bottle','pouch','jar','can','tetra pack','carton','box','tub','pack'].map(f => (
                            <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>
                          ))}
                        </select>
                        <CopyBtn value={formData.packingFormat} field="add_packingFormat" />
                      </div>
                    </div>

                    {/* Manufacturing Date */}
                    <div>
                      <label className={labelClass}>Manufacturing Date</label>
                      <div className="relative">
                        <input type="text" placeholder="DD/MM/YYYY" value={formData.manufactured}
                          onChange={e => setFormData({ ...formData, manufactured: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.manufactured} field="add_manufactured" />
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div>
                      <label className={labelClass}>Expiry Date</label>
                      <div className="relative">
                        <input type="text" placeholder="DD/MM/YYYY" value={formData.expiry}
                          onChange={e => setFormData({ ...formData, expiry: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.expiry} field="add_expiry" />
                      </div>
                    </div>

                    {/* Best Before */}
                    <div>
                      <label className={labelClass}>Best Before</label>
                      <div className="relative">
                        <input type="text" placeholder="e.g., 15 months from manufacture"
                          value={formData.bestBefore}
                          onChange={e => setFormData({ ...formData, bestBefore: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.bestBefore} field="add_bestBefore" />
                      </div>
                    </div>

                    {/* Shelf Life */}
                    <div>
                      <label className={labelClass}>Shelf Life</label>
                      <div className="relative">
                        <input type="text" placeholder="e.g., 12 months" value={formData.shelfLife}
                          onChange={e => setFormData({ ...formData, shelfLife: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData.shelfLife} field="add_shelfLife" />
                      </div>
                    </div>

                    {/* Category */}
                    <div>
                      <label className={labelClass}>Category</label>
                      <div className="relative">
                        <select value={formData.category}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className={inputClass}>
                          <option value="">Select category</option>
                          {mockCategories.filter(c => c !== 'All Categories').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <CopyBtn value={formData.category} field="add_category" />
                      </div>
                    </div>

                    {/* Veg/Non-Veg */}
                    <div>
                      <label className={labelClass}>Veg / Non-Veg</label>
                      <div className="relative">
                        <select value={formData.vegNonVeg}
                          onChange={e => setFormData({ ...formData, vegNonVeg: e.target.value })}
                          className={inputClass}>
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

                {/* Claims */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <SectionHeader title="Claims on Pack" copyValue={claims.join(', ')} copyField="add_claims" />
                  <ChipInput value={newClaim} onChange={setNewClaim} onAdd={handleAddClaim} placeholder="Add a claim" />
                  {claims.length > 0 && <ChipList items={claims} onRemove={handleRemoveClaim} colorClass="bg-primary/10 border border-primary/20 text-[#0f1729]" />}
                </div>

                {/* Tags */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <SectionHeader title="Tags" copyValue={selectedTags.join(', ')} copyField="add_tags" />
                  <div className="flex flex-wrap gap-2">
                    {predefinedTags.map((tag, idx) => (
                      <button key={idx} onClick={() => handleTagToggle(tag)}
                        className={`border px-3 py-1 rounded-full transition-colors ${selectedTags.includes(tag) ? 'bg-[#b455a0] border-[#b455a0] text-white' : 'border-[#e1e7ef] hover:border-[#b455a0] hover:bg-primary/5'}`}>
                        <span className="text-xs font-ibm-plex font-semibold">{tag}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ NUTRITION TAB ══════════════ */}
            {activeTab === 'nutrition' && (
              <div className="space-y-6">
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e1e7ef]">
                    <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">Nutritional Information</h3>
                    <div className="flex items-center gap-2">
                      {nutritionRows.length > 0 && (
                        <CopyBtnStandalone
                          value={`Nutrient\tUnit\tPer 100g\tPer Serve\t% RDA\n${nutritionRows.map(r=>`${r.nutrient}\t${r.unit}\t${r.per100g}\t${r.perServe}\t${r.rda}`).join('\n')}`}
                          field="add_nutritionTable" />
                      )}
                      <button onClick={handleAddNutritionRow} className={addBtnClass}>Add Row</button>
                    </div>
                  </div>

                  <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                    {nutritionRows.length === 0
                      ? 'No nutrition data. Upload images and click "Extract Data", or add rows manually.'
                      : 'Review and edit extracted nutrition data.'}
                  </p>

                  {nutritionRows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="border-b border-[#e1e7ef]">
                            {['Nutrient','Unit','Per 100g','Per Serve','% RDA',''].map(h => (
                              <th key={h} className="px-1 py-2 text-left">
                                <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">{h}</span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {nutritionRows.map(row => (
                            <tr key={row.id} className="border-b border-[#e1e7ef]">
                              <td className="px-1 py-2">
                                <input type="text" value={row.nutrient} placeholder="e.g., Protein"
                                  onChange={e => handleNutritionChange(row.id, 'nutrient', e.target.value)}
                                  className="w-full px-0 py-2 bg-transparent border-0 text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none" />
                              </td>
                              <td className="px-1 py-2">
                                <input type="text" value={row.unit} placeholder="g"
                                  onChange={e => handleNutritionChange(row.id, 'unit', e.target.value)}
                                  className="w-16 h-10 px-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-center focus:outline-none focus:ring-2 focus:ring-primary" />
                              </td>
                              {['per100g','perServe','rda'].map(field => (
                                <td key={field} className="px-1 py-2">
                                  <input type="text" value={row[field]}
                                    onChange={e => handleNutritionChange(row.id, field, e.target.value)}
                                    className="w-24 h-10 px-3 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                                </td>
                              ))}
                              <td className="px-1 py-2 text-center">
                                <button onClick={() => handleRemoveNutritionRow(row.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors">
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
                  <SectionHeader title="Nutrition Notes" copyValue={nutritionNotes.join(' | ')} copyField="add_nutNotes" />
                  <p className="text-xs text-[#65758b] mb-3">Footnotes, %RDA references, or disclaimers printed below the nutrition table.</p>
                  <ChipInput value={newNutritionNote} onChange={setNewNutritionNote} onAdd={handleAddNote} placeholder="e.g., *RDA based on 2000 kcal diet" />
                  {nutritionNotes.length > 0 && (
                    <ChipList items={nutritionNotes} onRemove={handleRemoveNote} colorClass="bg-yellow-50 border border-yellow-200 text-yellow-900" />
                  )}
                </div>
              </div>
            )}

            {/* ══════════════ COMPOSITION TAB ══════════════ */}
            {activeTab === 'composition' && (
              <div className="space-y-6">
                {/* Ingredients */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <SectionHeader title="Ingredients" copyValue={ingredients.join(', ')} copyField="add_ingredients" />
                  <ChipInput value={newIngredient} onChange={setNewIngredient} onAdd={handleAddIngredient} placeholder="Add an ingredient" />
                  {ingredients.length > 0 && (
                    <ChipList items={ingredients} onRemove={handleRemoveIngredient} colorClass="bg-gray-100 border border-[#e1e7ef] text-[#0f1729]" />
                  )}
                </div>

                {/* Allergens */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <SectionHeader title="Allergen Information" copyValue={allergens.join(', ')} copyField="add_allergens" />
                  <ChipInput value={newAllergen} onChange={setNewAllergen} onAdd={handleAddAllergen} placeholder="Add an allergen" />
                  {allergens.length > 0 && (
                    <ChipList items={allergens} onRemove={handleRemoveAllergen} colorClass="bg-red-50 border border-red-200 text-red-900" />
                  )}
                </div>

                {/* Storage & Usage */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Storage & Usage</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                    <div>
                      <label className={labelClass}>Shelf Life</label>
                      <div className="relative">
                        <input type="text" placeholder="e.g., 18 months from manufacture"
                          value={storageData.shelfLife}
                          onChange={e => setStorageData({ ...storageData, shelfLife: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={storageData.shelfLife} field="add_shelfLifeComp" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Storage Conditions</label>
                      <div className="relative">
                        <input type="text" placeholder="e.g., Store in cool, dry place"
                          value={storageData.storageCondition}
                          onChange={e => setStorageData({ ...storageData, storageCondition: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={storageData.storageCondition} field="add_storageCondition" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>Directions to Use</label>
                        <CopyBtnStandalone value={directionsToUse} field="add_directions" />
                      </div>
                      <textarea placeholder="One direction per line" value={directionsToUse}
                        onChange={e => setDirectionsToUse(e.target.value)} rows={4}
                        className={textareaClass} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>Preparation Method</label>
                        <CopyBtnStandalone value={preparationMethod} field="add_preparation" />
                      </div>
                      <textarea placeholder="One step per line" value={preparationMethod}
                        onChange={e => setPreparationMethod(e.target.value)} rows={4}
                        className={textareaClass} />
                    </div>
                  </div>
                </div>

                {/* Medical Information */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Medical Information</h3>
                  <p className="text-xs text-[#65758b] mb-4">Applicable for pharmaceutical or health products. One item per line.</p>

                  <div className="space-y-4">
                    {[
                      { key:'intendedUse',      label:'Intended Use',      placeholder:'e.g., For adults 18+, Suitable for diabetics' },
                      { key:'warnings',          label:'Warnings',          placeholder:'e.g., Do not exceed recommended dose' },
                      { key:'contraindications', label:'Contraindications', placeholder:'e.g., Not suitable during pregnancy' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5 md:mb-2">
                          <label className={labelClass.replace('block','')}>{label}</label>
                          <CopyBtnStandalone value={medicalInfo[key]} field={`add_med_${key}`} />
                        </div>
                        <textarea placeholder={placeholder} value={medicalInfo[key]}
                          onChange={e => setMedicalInfo({ ...medicalInfo, [key]: e.target.value })} rows={3}
                          className={textareaClass} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════ COMPANY TAB ══════════════ */}
            {activeTab === 'company' && (
              <div className="space-y-4 md:space-y-6">
                {/* Company Information */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Company Information</h3>
                  {[
                    { key:'marketedBy',    label:'Marketed By',     placeholder:'Marketing company name and address' },
                    { key:'manufacturedBy',label:'Manufactured By',  placeholder:'Manufacturing unit name and address' },
                    { key:'packedBy',      label:'Packed By',        placeholder:'Packing unit name and address' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key} className="mb-3 md:mb-4">
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>{label}</label>
                        <CopyBtnStandalone value={companyData[key]} field={`add_${key}`} />
                      </div>
                      <textarea placeholder={placeholder} value={companyData[key]} rows={3}
                        onChange={e => setCompanyData({ ...companyData, [key]: e.target.value })}
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
                          onChange={e => setBatchData({ ...batchData, lotNumber: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={batchData.lotNumber} field="add_lotNumber" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Machine Code</label>
                      <div className="relative">
                        <input type="text" placeholder="Alphanumeric machine code" value={batchData.machineCode}
                          onChange={e => setBatchData({ ...batchData, machineCode: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={batchData.machineCode} field="add_machineCode" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Other Codes</label>
                      <CopyBtnStandalone value={batchData.otherCodes} field="add_otherCodes" />
                    </div>
                    <textarea placeholder="One code per line" value={batchData.otherCodes}
                      onChange={e => setBatchData({ ...batchData, otherCodes: e.target.value })} rows={3}
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
                        onChange={e => setPackagingData({ ...packagingData, manufacturer: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={packagingData.manufacturer} field="add_packMfr" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Packaging Codes</label>
                      <CopyBtnStandalone value={packagingData.codes} field="add_packCodes" />
                    </div>
                    <textarea placeholder="One code per line" value={packagingData.codes}
                      onChange={e => setPackagingData({ ...packagingData, codes: e.target.value })} rows={3}
                      className={textareaClass} />
                  </div>
                </div>

                {/* FSSAI & Barcodes */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Regulatory Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className={labelClass}>FSSAI License Numbers</label>
                      <ChipInput value={newFssaiNumber} onChange={setNewFssaiNumber} onAdd={handleAddFssai} placeholder="14-digit FSSAI number" />
                      {fssaiNumbers.length > 0 && (
                        <ChipList items={fssaiNumbers} onRemove={handleRemoveFssai} colorClass="bg-blue-50 border border-blue-200 text-blue-900" />
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Barcodes / EAN</label>
                      <ChipInput value={newBarcode} onChange={setNewBarcode} onAdd={handleAddBarcode} placeholder="Enter barcode number" />
                      {barcodes.length > 0 && (
                        <ChipList items={barcodes} onRemove={handleRemoveBarcode} colorClass="bg-gray-100 border border-[#e1e7ef] text-[#0f1729]" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Certifications */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <SectionHeader title="Certifications" copyValue={certifications.join(', ')} copyField="add_certs" />
                  <ChipInput value={newCertification} onChange={setNewCertification} onAdd={handleAddCert} placeholder="e.g., FSSAI, ISO 22000, HACCP" />
                  {certifications.length > 0 && (
                    <ChipList items={certifications} onRemove={handleRemoveCert} colorClass="bg-green-50 border border-green-200 text-green-900" />
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
                          onChange={e => setCustomerCareData({ ...customerCareData, email: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={customerCareData.email} field="add_ccEmail" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Website</label>
                      <div className="relative">
                        <input type="text" placeholder="www.example.com" value={customerCareData.website}
                          onChange={e => setCustomerCareData({ ...customerCareData, website: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={customerCareData.website} field="add_ccWebsite" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>Phone Numbers</label>
                        <CopyBtnStandalone value={customerCareData.phones} field="add_ccPhones" />
                      </div>
                      <textarea placeholder="One phone number per line" value={customerCareData.phones}
                        onChange={e => setCustomerCareData({ ...customerCareData, phones: e.target.value })} rows={3}
                        className={textareaClass} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>Address</label>
                        <CopyBtnStandalone value={customerCareData.address} field="add_ccAddress" />
                      </div>
                      <textarea placeholder="Customer care address" value={customerCareData.address}
                        onChange={e => setCustomerCareData({ ...customerCareData, address: e.target.value })} rows={3}
                        className={textareaClass} />
                    </div>
                  </div>
                </div>

                {/* Regulatory / Other Text */}
                <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Additional Notes & Regulatory</h3>
                  <div className="space-y-4">
                    {[
                      { key:'regulatoryText',   label:'Regulatory Text',      setter:setRegulatoryText,   val:regulatoryText,   placeholder:'Legal/regulatory statements on pack (one per line)' },
                      { key:'footnotes',         label:'Footnotes',             setter:setFootnotes,        val:footnotes,        placeholder:'Footnotes printed on pack (one per line)' },
                      { key:'otherImportantText',label:'Other Important Text',  setter:setOtherImportantText, val:otherImportantText, placeholder:'Slogans, taglines, marketing text, disclaimers (one per line)' },
                      { key:'otherNotes',        label:'Other Notes',           val:companyData.otherNotes,
                        setter:v=>setCompanyData({...companyData,otherNotes:v}), placeholder:'Additional notes (customer care, etc.)' },
                    ].map(({ key, label, setter, val, placeholder }) => (
                      <div key={key}>
                        <div className="flex items-center justify-between mb-1.5 md:mb-2">
                          <label className={labelClass.replace('block','')}>{label}</label>
                          <CopyBtnStandalone value={val} field={`add_${key}`} />
                        </div>
                        <textarea placeholder={placeholder} value={val}
                          onChange={e => setter(e.target.value)} rows={3} className={textareaClass} />
                      </div>
                    ))}
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