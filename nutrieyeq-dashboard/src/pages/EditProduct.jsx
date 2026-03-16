import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { ArrowLeft, Save, X, Copy, Check } from 'lucide-react'
import { mockCategories } from '../utils/mockData'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const EditProduct = () => {
  const navigate = useNavigate()
  const { id }   = useParams()
  const [activeTab, setActiveTab] = useState('basic')

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
  const [ingredients, setIngredients] = useState('')
  const [allergens, setAllergens]     = useState('')

  const [storageData, setStorageData] = useState({ shelfLife: '', storageCondition: '' })
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
  const [certifications, setCertifications]     = useState([])
  const [newCertification, setNewCertification] = useState('')
  const [packagingData, setPackagingData]   = useState({ manufacturer: '', codes: '' })
  const [batchData, setBatchData]           = useState({ lotNumber: '', machineCode: '', otherCodes: '' })
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

  const inputClass    = "w-full h-10 px-3 pr-9 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary"
  const textareaClass = "w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
  const addBtnClass   = "bg-[#b455a0] h-10 px-4 py-2 rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
  const labelClass    = "text-xs md:text-sm font-ibm-plex font-medium text-[#0f1729] mb-1.5 md:mb-2 block"

  const tabs = [
    { id: 'basic',       label: 'Basic Info'  },
    { id: 'nutrition',   label: 'Nutrition'   },
    { id: 'composition', label: 'Composition' },
    { id: 'company',     label: 'Company'     }
  ]

  // ── Chip-list helpers ──────────────────────────────────────────────────────
  const makeChipAdder   = (list, setList, newVal, setNew) => () => {
    if (newVal.trim()) { setList([...list, newVal.trim()]); setNew('') }
  }
  const makeChipRemover = (list, setList) => (idx) => setList(list.filter((_, i) => i !== idx))

  const handleAddClaim  = makeChipAdder(claims,        setClaims,       newClaim,       setNewClaim)
  const handleAddNote   = makeChipAdder(nutritionNotes, setNutritionNotes, newNutritionNote, setNewNutritionNote)
  const handleAddFssai  = makeChipAdder(fssaiNumbers,  setFssaiNumbers, newFssaiNumber, setNewFssaiNumber)
  const handleAddBarcode= makeChipAdder(barcodes,      setBarcodes,     newBarcode,     setNewBarcode)
  const handleAddCert   = makeChipAdder(certifications, setCertifications, newCertification, setNewCertification)

  const handleRemoveClaim  = makeChipRemover(claims,        setClaims)
  const handleRemoveNote   = makeChipRemover(nutritionNotes, setNutritionNotes)
  const handleRemoveFssai  = makeChipRemover(fssaiNumbers,  setFssaiNumbers)
  const handleRemoveBarcode= makeChipRemover(barcodes,      setBarcodes)
  const handleRemoveCert   = makeChipRemover(certifications, setCertifications)

  const handleTagToggle = (tag) =>
    setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag])

  // ── Nutrition helpers ──────────────────────────────────────────────────────
  const handleAddNutritionRow = () =>
    setNutritionRows([...nutritionRows, { id: Date.now(), nutrient: '', unit: '', per100g: '', perServe: '', rda: '' }])
  const handleNutritionChange = (id, field, value) =>
    setNutritionRows(nutritionRows.map(r => r.id === id ? { ...r, [field]: value } : r))
  const handleRemoveNutritionRow = (id) =>
    setNutritionRows(nutritionRows.filter(r => r.id !== id))

  // ── Load product ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    const loadProduct = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/products/${id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
          }
        })
        if (!resp.ok) throw new Error('Failed to load product')
        const p = await resp.json()

        // Basic
        setFormData({
          productName:     p.product_name    || '',
          brand:           p.parent_brand    || '',
          subBrand:        p.sub_brand       || '',
          variant:         p.variant         || '',
          packSize:        p.net_quantity    || p.pack_size || p.net_weight || '',
          servingsPerPack: p.servings_per_pack || '',
          mrp:             p.mrp             || '',
          uspf:            p.uspf            || '',
          manufactured:    p.manufacturing_date || '',
          expiry:          p.expiry_date     || '',
          bestBefore:      p.best_before     || '',
          shelfLife:       p.shelf_life      || '',
          serveSize:       p.serving_size    || '',
          category:        p.category        || '',
          vegNonVeg:       p.veg_nonveg      || '',
          packingFormat:   p.packing_format  || ''
        })

        // Nutrition
        if (Array.isArray(p.nutrition_table)) {
          setNutritionRows(p.nutrition_table.map((n, i) => {
            const v = n.values || {}
            return {
              id:       i + 1,
              nutrient: n.nutrient_name || '',
              unit:     n.unit          || '',
              per100g:  v['Per 100g']   || v['per100g']  || '',
              perServe: v['Per Serve']  || v['perServe'] || '',
              rda:      v['% RDA']      || v['rda']      || '',
            }
          }))
        }
        if (Array.isArray(p.nutrition_notes)) setNutritionNotes(p.nutrition_notes)

        // Composition
        setIngredients(typeof p.ingredients === 'string' ? p.ingredients : '')
        setAllergens(p.allergen_information || p.allergen_info || '')

        // Storage & Usage
        const si = p.storage_instructions
        const storageStr = Array.isArray(si) ? si.join('\n') : (si || '')
        setStorageData({ shelfLife: p.shelf_life || '', storageCondition: storageStr })

        if (p.usage_instructions && typeof p.usage_instructions === 'object') {
          setDirectionsToUse((p.usage_instructions.directions_to_use || []).join('\n'))
          setPreparationMethod((p.usage_instructions.preparation_method || []).join('\n'))
        } else if (p.instructions_to_use) {
          setDirectionsToUse(p.instructions_to_use)
        }

        // Medical
        if (p.medical_information && typeof p.medical_information === 'object') {
          const mi = p.medical_information
          setMedicalInfo({
            intendedUse:      (mi.intended_use      || []).join('\n'),
            warnings:         (mi.warnings          || []).join('\n'),
            contraindications:(mi.contraindications || []).join('\n'),
          })
        }

        // Claims
        if (Array.isArray(p.claims)) setClaims(p.claims)

        // Company
        const mfrs = p.manufacturer_information || p.manufacturer_details || []
        if (Array.isArray(mfrs)) {
          setCompanyData({
            brandOwner:    p.brand_owner || '',
            marketedBy:    mfrs.find(m => (m.type||'').includes('Market'))?.name   || '',
            manufacturedBy: mfrs.find(m => (m.type||'').includes('Manufactur'))?.address ||
                            mfrs.find(m => (m.type||'').includes('Manufactur'))?.name    || '',
            packedBy:      mfrs.find(m => (m.type||'').includes('Pack'))?.address  ||
                           mfrs.find(m => (m.type||'').includes('Pack'))?.name     || '',
            otherNotes: ''
          })
        }

        // FSSAI
        if (p.fssai_information?.license_numbers?.length) setFssaiNumbers(p.fssai_information.license_numbers)
        else if (Array.isArray(p.fssai_licenses) && p.fssai_licenses.length) setFssaiNumbers(p.fssai_licenses)

        // Barcodes
        if (Array.isArray(p.barcodes) && p.barcodes.length)  setBarcodes(p.barcodes)
        else if (p.barcode) setBarcodes([p.barcode])

        // Certifications
        if (Array.isArray(p.certifications)) setCertifications(p.certifications)

        // Packaging
        if (p.packaging_information) {
          setPackagingData({
            manufacturer: p.packaging_information.packaging_material_manufacturer || '',
            codes: (p.packaging_information.packaging_codes || []).join('\n'),
          })
        }

        // Batch
        if (p.batch_information) {
          setBatchData({
            lotNumber:   p.batch_information.lot_number   || '',
            machineCode: p.batch_information.machine_code || '',
            otherCodes:  (p.batch_information.other_codes || []).join('\n'),
          })
        }

        // Customer care
        if (p.customer_care) {
          const cc = p.customer_care
          setCustomerCareData({
            phones:  (cc.phone || []).join('\n'),
            email:   cc.email   || '',
            website: cc.website || '',
            address: cc.address || '',
          })
        }

        // Regulatory / other
        if (Array.isArray(p.regulatory_text))      setRegulatoryText(p.regulatory_text.join('\n'))
        if (Array.isArray(p.footnotes))             setFootnotes(p.footnotes.join('\n'))
        if (Array.isArray(p.other_important_text))  setOtherImportantText(p.other_important_text.join('\n'))

        // Tags
        if (Array.isArray(p.tags)) setSelectedTags(p.tags)

      } catch (err) {
        console.error('[EDIT] Error loading product:', err)
        alert('Failed to load product: ' + err.message)
        navigate('/products')
      }
    }
    loadProduct()
  }, [id, navigate])

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSaveProduct = async () => {
    if (!formData.productName || !formData.brand) { alert('Please fill in all required fields (*)'); return }

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

        ingredients:           ingredients || null,
        allergen_information:  allergens   || null,
        allergen_info:         allergens   || null,
        claims:                claims,

        medical_information: {
          intended_use:      medicalInfo.intendedUse.split('\n').filter(Boolean),
          warnings:          medicalInfo.warnings.split('\n').filter(Boolean),
          contraindications: medicalInfo.contraindications.split('\n').filter(Boolean),
        },
        usage_instructions: {
          directions_to_use:  directionsToUse.split('\n').filter(Boolean),
          preparation_method: preparationMethod.split('\n').filter(Boolean),
        },
        storage_instructions: storageData.storageCondition.split('\n').filter(Boolean),
        shelf_life: formData.shelfLife || storageData.shelfLife || null,

        manufacturer_information: [
          companyData.manufacturedBy && { type: 'Manufactured By', name: companyData.manufacturedBy, address: '', license_number: '' },
          companyData.packedBy       && { type: 'Manufactured By', name: companyData.packedBy,       address: '', license_number: '' },
          companyData.marketedBy     && { type: 'Marketed By',     name: companyData.marketedBy,     address: '', license_number: '' },
        ].filter(Boolean),
        manufacturer_details: [
          companyData.manufacturedBy && { type: 'Manufactured by', name: companyData.manufacturedBy },
          companyData.marketedBy     && { type: 'Marketed by',     name: companyData.marketedBy },
        ].filter(Boolean),
        brand_owner: companyData.brandOwner || null,

        fssai_information: { license_numbers: fssaiNumbers },
        fssai_licenses:    fssaiNumbers,

        barcodes:       barcodes,
        barcode:        barcodes[0] || null,
        certifications: certifications,

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
        status: 'published',
      }

      const resp = await fetch(`${API_BASE_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        },
        body: JSON.stringify(productData)
      })
      const result = await resp.json()
      if (!resp.ok) throw new Error(result.detail || 'Failed to update product')
      alert('Product updated successfully!')
      navigate('/products')
    } catch (err) {
      console.error('[EDIT] Error updating product:', err)
      alert('Failed to update product: ' + err.message)
    }
  }

  // ── Chip UI helpers ────────────────────────────────────────────────────────
  const ChipList = ({ items, onRemove, colorClass = 'bg-primary/10 border border-primary/20 text-[#0f1729]' }) => (
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
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && onAdd()} placeholder={placeholder}
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
      <div className="overflow-y-auto h-full">
        <div className="max-w-6xl mx-auto p-4 md:p-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
            <button onClick={() => navigate('/products')}
              className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors sm:mt-1">
              <ArrowLeft className="w-4 h-4 text-[#0f1729]" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">Edit Product</h1>
              <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">Update product details</p>
            </div>
            <button onClick={handleSaveProduct}
              className="bg-[#b455a0] flex items-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap w-full sm:w-auto justify-center">
              <Save className="w-4 h-4" />Save Changes
            </button>
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
                    { label:'Net Quantity / Pack Size', key:'packSize', placeholder:'e.g., 500g, 1L' },
                    { label:'Serve Size',      key:'serveSize',   placeholder:'e.g., 30g, 200ml' },
                    { label:'Servings Per Pack',key:'servingsPerPack', placeholder:'e.g., 10' },
                  ].map(({ label, key, placeholder, req }) => (
                    <div key={key}>
                      <label className={labelClass}>{label}</label>
                      <div className="relative">
                        <input type="text" placeholder={placeholder} value={formData[key]} required={req}
                          onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                          className={inputClass} />
                        <CopyBtn value={formData[key]} field={key} />
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
                      <CopyBtn value={formData.mrp} field="mrp" />
                    </div>
                  </div>

                  {/* USPF */}
                  <div>
                    <label className={labelClass}>USPF — Unit Selling Price Format</label>
                    <div className="relative">
                      <input type="text" placeholder="e.g., ₹120.00/Unit, ₹0.14/g" value={formData.uspf}
                        onChange={e => setFormData({ ...formData, uspf: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={formData.uspf} field="uspf" />
                    </div>
                  </div>

                  {/* Packing Format */}
                  <div>
                    <label className={labelClass}>Packing Format</label>
                    <div className="relative">
                      <select value={formData.packingFormat}
                        onChange={e => setFormData({ ...formData, packingFormat: e.target.value })}
                        className={inputClass}>
                        <option value="">Select format</option>
                        {['sachet','bottle','pouch','jar','can','tetra pack','carton','box','tub','pack'].map(f => (
                          <option key={f} value={f}>{f.charAt(0).toUpperCase()+f.slice(1)}</option>
                        ))}
                      </select>
                      <CopyBtn value={formData.packingFormat} field="packingFormat" />
                    </div>
                  </div>

                  {/* Manufacturing Date */}
                  <div>
                    <label className={labelClass}>Manufacturing Date</label>
                    <div className="relative">
                      <input type="text" placeholder="DD/MM/YYYY" value={formData.manufactured}
                        onChange={e => setFormData({ ...formData, manufactured: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={formData.manufactured} field="manufactured" />
                    </div>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className={labelClass}>Expiry Date</label>
                    <div className="relative">
                      <input type="text" placeholder="DD/MM/YYYY" value={formData.expiry}
                        onChange={e => setFormData({ ...formData, expiry: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={formData.expiry} field="expiry" />
                    </div>
                  </div>

                  {/* Best Before */}
                  <div>
                    <label className={labelClass}>Best Before</label>
                    <div className="relative">
                      <input type="text" placeholder="e.g., 15 months from manufacture" value={formData.bestBefore}
                        onChange={e => setFormData({ ...formData, bestBefore: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={formData.bestBefore} field="bestBefore" />
                    </div>
                  </div>

                  {/* Shelf Life */}
                  <div>
                    <label className={labelClass}>Shelf Life</label>
                    <div className="relative">
                      <input type="text" placeholder="e.g., 12 months" value={formData.shelfLife}
                        onChange={e => setFormData({ ...formData, shelfLife: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={formData.shelfLife} field="shelfLife" />
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
                      <CopyBtn value={formData.category} field="category" />
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
                      <CopyBtn value={formData.vegNonVeg} field="vegNonVeg" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Claims */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <SectionHeader title="Claims on Pack" copyValue={claims.join(', ')} copyField="claims" />
                <ChipInput value={newClaim} onChange={setNewClaim} onAdd={handleAddClaim} placeholder="Add a claim" />
                {claims.length > 0 && <ChipList items={claims} onRemove={handleRemoveClaim} colorClass="bg-primary/10 border border-primary/20 text-[#0f1729]" />}
              </div>

              {/* Tags */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <SectionHeader title="Tags" copyValue={selectedTags.join(', ')} copyField="tags" />
                <div className="flex flex-wrap gap-2">
                  {predefinedTags.map((tag, idx) => (
                    <button key={idx} onClick={() => handleTagToggle(tag)}
                      className={`px-3 py-1 rounded-full transition-colors ${selectedTags.includes(tag) ? 'bg-primary/10 border-2 border-primary' : 'border border-[#e1e7ef] hover:border-primary/50'}`}>
                      <span className={`text-xs font-ibm-plex font-semibold ${selectedTags.includes(tag) ? 'text-primary' : 'text-[#0f1729]'}`}>{tag}</span>
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
                        field="nutritionTable" />
                    )}
                    <button onClick={handleAddNutritionRow} className={addBtnClass}>Add Row</button>
                  </div>
                </div>

                <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                  Enter values per 100g/100ml. All columns are editable.
                </p>

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
                            {nutritionRows.length > 1 && (
                              <button onClick={() => handleRemoveNutritionRow(row.id)}
                                className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-red-50 transition-colors">
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

              {/* Nutrition Notes */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <SectionHeader title="Nutrition Notes" copyValue={nutritionNotes.join(' | ')} copyField="nutNotes" />
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
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">Ingredients</h3>
                  {ingredients && <CopyBtnStandalone value={ingredients} field="ingredients" />}
                </div>
                <textarea placeholder="Enter ingredients as continuous text"
                  value={ingredients} onChange={e => setIngredients(e.target.value)} rows={4}
                  className={`${textareaClass} resize-y`} />
              </div>

              {/* Allergens */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <div className="flex items-center justify-between mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">
                  <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729]">Allergen Information</h3>
                  {allergens && <CopyBtnStandalone value={allergens} field="allergens" />}
                </div>
                <textarea placeholder="e.g., Contains Wheat (Gluten), May contain traces of nuts"
                  value={allergens} onChange={e => setAllergens(e.target.value)} rows={2}
                  className={`${textareaClass} resize-y`} />
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
                      <CopyBtn value={storageData.shelfLife} field="shelfLifeComp" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Storage Conditions</label>
                    <div className="relative">
                      <input type="text" placeholder="e.g., Store in cool, dry place"
                        value={storageData.storageCondition}
                        onChange={e => setStorageData({ ...storageData, storageCondition: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={storageData.storageCondition} field="storageCondition" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Directions to Use</label>
                      <CopyBtnStandalone value={directionsToUse} field="directions" />
                    </div>
                    <textarea placeholder="One direction per line" value={directionsToUse}
                      onChange={e => setDirectionsToUse(e.target.value)} rows={4} className={textareaClass} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Preparation Method</label>
                      <CopyBtnStandalone value={preparationMethod} field="preparation" />
                    </div>
                    <textarea placeholder="One step per line" value={preparationMethod}
                      onChange={e => setPreparationMethod(e.target.value)} rows={4} className={textareaClass} />
                  </div>
                </div>
              </div>

              {/* Medical Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-4 md:p-6">
                <h3 className="text-base md:text-lg font-ibm-plex font-semibold text-[#0f1729] mb-3 md:mb-4 pb-2 border-b border-[#e1e7ef]">Medical Information</h3>
                <p className="text-xs text-[#65758b] mb-4">Applicable for pharmaceutical or health products. One item per line.</p>
                <div className="space-y-4">
                  {[
                    { key:'intendedUse',      label:'Intended Use',      placeholder:'e.g., For adults 18+' },
                    { key:'warnings',          label:'Warnings',          placeholder:'e.g., Do not exceed recommended dose' },
                    { key:'contraindications', label:'Contraindications', placeholder:'e.g., Not suitable during pregnancy' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>{label}</label>
                        <CopyBtnStandalone value={medicalInfo[key]} field={`med_${key}`} />
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
                      <CopyBtnStandalone value={companyData[key]} field={key} />
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
                      <CopyBtn value={batchData.lotNumber} field="lotNumber" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Machine Code</label>
                    <div className="relative">
                      <input type="text" placeholder="Alphanumeric machine code" value={batchData.machineCode}
                        onChange={e => setBatchData({ ...batchData, machineCode: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={batchData.machineCode} field="machineCode" />
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className={labelClass.replace('block','')}>Other Codes</label>
                    <CopyBtnStandalone value={batchData.otherCodes} field="otherCodes" />
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
                    <CopyBtn value={packagingData.manufacturer} field="packMfr" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5 md:mb-2">
                    <label className={labelClass.replace('block','')}>Packaging Codes</label>
                    <CopyBtnStandalone value={packagingData.codes} field="packCodes" />
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
                <SectionHeader title="Certifications" copyValue={certifications.join(', ')} copyField="certs" />
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
                      <CopyBtn value={customerCareData.email} field="ccEmail" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Website</label>
                    <div className="relative">
                      <input type="text" placeholder="www.example.com" value={customerCareData.website}
                        onChange={e => setCustomerCareData({ ...customerCareData, website: e.target.value })}
                        className={inputClass} />
                      <CopyBtn value={customerCareData.website} field="ccWebsite" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Phone Numbers</label>
                      <CopyBtnStandalone value={customerCareData.phones} field="ccPhones" />
                    </div>
                    <textarea placeholder="One phone number per line" value={customerCareData.phones}
                      onChange={e => setCustomerCareData({ ...customerCareData, phones: e.target.value })} rows={3}
                      className={textareaClass} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <label className={labelClass.replace('block','')}>Address</label>
                      <CopyBtnStandalone value={customerCareData.address} field="ccAddress" />
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
                    { key:'regulatoryText',   label:'Regulatory Text',     setter:setRegulatoryText,     val:regulatoryText,    placeholder:'Legal/regulatory statements (one per line)' },
                    { key:'footnotes',         label:'Footnotes',            setter:setFootnotes,          val:footnotes,         placeholder:'Footnotes printed on pack (one per line)' },
                    { key:'otherImportantText',label:'Other Important Text', setter:setOtherImportantText, val:otherImportantText,placeholder:'Slogans, taglines, disclaimers (one per line)' },
                    { key:'otherNotes',        label:'Other Notes',          val:companyData.otherNotes,
                      setter:v=>setCompanyData({...companyData,otherNotes:v}), placeholder:'Additional notes' },
                  ].map(({ key, label, setter, val, placeholder }) => (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-1.5 md:mb-2">
                        <label className={labelClass.replace('block','')}>{label}</label>
                        <CopyBtnStandalone value={val} field={key} />
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
    </Layout>
  )
}

export default EditProduct