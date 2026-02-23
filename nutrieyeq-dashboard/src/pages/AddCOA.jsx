import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { Upload, Plus, Trash2, Sparkles, Save, Loader2, Check, AlertCircle, FileText } from 'lucide-react'
import { coaService } from '../services/api'

const AddCOA = () => {
  const navigate = useNavigate()
  
  // Basic Information State
  const [ingredientName, setIngredientName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [storageCondition, setStorageCondition] = useState('')
  
  const [dragActive, setDragActive] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])
  
  // Extraction and saving states
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionComplete, setExtractionComplete] = useState(false)
  const [extractionError, setExtractionError] = useState(null)
  const [extractionCost, setExtractionCost] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  
  // Initial empty nutrient rows
  const [nutrients, setNutrients] = useState([])
  const [nextId, setNextId] = useState(1)

  // Add new nutrient row
  const addNutrient = () => {
    setNutrients([
      ...nutrients,
      { 
        id: nextId, 
        name: '', 
        nutrient_name_raw: '',
        actual: '', 
        min: '', 
        max: '', 
        average: '',
        unit_original: 'g',
        unit_normalized: 'g',
        category: ''
      }
    ])
    setNextId(nextId + 1)
  }

  // Remove nutrient row
  const removeNutrient = (id) => {
    if (nutrients.length > 0) {
      setNutrients(nutrients.filter(nutrient => nutrient.id !== id))
    }
  }

  // Update nutrient field
  const updateNutrient = (id, field, value) => {
    setNutrients(nutrients.map(nutrient =>
      nutrient.id === id ? { ...nutrient, [field]: value } : nutrient
    ))
  }

  // Handle file drag events
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  // Handle file drop
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // Handle file selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files)
    }
  }

  // Process selected files
  const handleFiles = (files) => {
    const fileArray = Array.from(files)
    setUploadedFiles(prev => [...prev, ...fileArray])
    // Reset extraction state when new files are added
    setExtractionComplete(false)
    setExtractionError(null)
  }

  // Extract data from COA files
  const handleExtractData = async () => {
    if (uploadedFiles.length === 0) {
      setExtractionError('Please upload at least one COA file')
      return
    }

    setIsExtracting(true)
    setExtractionError(null)
    setExtractionComplete(false)
    
    try {
      console.log('[AddCOA] Starting extraction with', uploadedFiles.length, 'files')
      
      // Call extraction API
      const result = await coaService.extractFromImages(uploadedFiles)
      console.log('[AddCOA] Extraction result:', result)
      
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
      setExtractionError(error.message || 'Failed to extract data from COA files')
    } finally {
      setIsExtracting(false)
    }
  }

  // Populate form from extracted data
  const populateFormFromExtraction = (data) => {
    console.log('[AddCOA] Populating form with extracted data:', data)
    
    // Populate ingredient info
    if (data.ingredient_info) {
      const info = data.ingredient_info
      setIngredientName(info.ingredient_name || '')
      setProductCode(info.product_code || '')
      setLotNumber(info.lot_number || '')
      setManufacturingDate(info.manufacturing_date || '')
      setExpiryDate(info.expiry_date || '')
      setSupplierName(info.supplier_name || '')
      setSupplierAddress(info.supplier_address || '')
      setStorageCondition(info.storage_condition || '')
    }
    
    // Populate nutritional data
    if (data.nutritional_data && Array.isArray(data.nutritional_data)) {
      const nutrientRows = data.nutritional_data.map((item, index) => ({
        id: index + 1,
        name: item.nutrient_name || '',
        nutrient_name_raw: item.nutrient_name_raw || item.nutrient_name || '',
        actual: item.actual_value !== null && item.actual_value !== undefined ? String(item.actual_value) : '',
        min: item.min_value !== null && item.min_value !== undefined ? String(item.min_value) : '',
        max: item.max_value !== null && item.max_value !== undefined ? String(item.max_value) : '',
        average: item.average_value !== null && item.average_value !== undefined ? String(item.average_value) : '',
        unit_original: item.unit_raw || item.unit || 'g',
        unit_normalized: item.unit || 'g',
        category: item.category || ''
      }))
      
      setNutrients(nutrientRows)
      setNextId(nutrientRows.length + 1)
    }
  }

  // Save COA data
  const handleSaveCOA = async () => {
    if (!ingredientName.trim()) {
      alert('Please enter Ingredient Name')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)
    
    try {
      // Convert uploaded files to base64 for storage
      const fileBase64Promises = uploadedFiles.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => resolve(null)
          reader.readAsDataURL(file)
        })
      })
      const documentImages = (await Promise.all(fileBase64Promises)).filter(Boolean)

      // Build nutritional_data array for API
      const nutritionalData = nutrients
        .filter(n => n.name.trim())
        .map(n => ({
          nutrient_name: n.name,
          nutrient_name_raw: n.nutrient_name_raw || n.name,
          actual_value: n.actual ? parseFloat(n.actual) : null,
          min_value: n.min ? parseFloat(n.min) : null,
          max_value: n.max ? parseFloat(n.max) : null,
          average_value: n.average ? parseFloat(n.average) : null,
          unit_raw: n.unit_original,
          unit: n.unit_normalized,
          category: n.category || null,
          basis: 'per 100g'
        }))
      
      const coaData = {
        ingredient_name: ingredientName,
        product_code: productCode || null,
        lot_number: lotNumber || null,
        manufacturing_date: manufacturingDate || null,
        expiry_date: expiryDate || null,
        supplier_name: supplierName || null,
        supplier_address: supplierAddress || null,
        storage_condition: storageCondition || null,
        nutritional_data: nutritionalData,
        other_parameters: [],
        certifications: [],
        analysis_method: null,
        additional_notes: [],
        document_images: documentImages,
        status: 'active'
      }
      
      console.log('[AddCOA] Saving COA data:', coaData)
      
      const result = await coaService.createCOA(coaData)
      
      if (result.success) {
        setSaveSuccess(true)
        // Clear form after 2 seconds
        setTimeout(() => {
          clearForm()
          setSaveSuccess(false)
        }, 2000)
      } else {
        alert(`Failed to save COA: ${result.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('Failed to save COA data')
    } finally {
      setIsSaving(false)
    }
  }

  // Clear form
  const clearForm = () => {
    setIngredientName('')
    setProductCode('')
    setLotNumber('')
    setManufacturingDate('')
    setExpiryDate('')
    setSupplierName('')
    setSupplierAddress('')
    setStorageCondition('')
    setNutrients([])
    setNextId(1)
    setUploadedFiles([])
    setExtractionComplete(false)
    setExtractionError(null)
    setExtractionCost(null)
  }


  return (
    <Layout>
      <div className="p-4 md:p-6 h-full flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
              COA Extraction Tool
            </h1>
            <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
              Upload and extract nutritional data from supplier COA documents
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button
              onClick={handleExtractData}
              disabled={isExtracting || uploadedFiles.length === 0}
              className="bg-[#009da5] border border-[#5bc4bf] flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
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
            <button
              onClick={handleSaveCOA}
              disabled={isSaving || !ingredientName.trim()}
              className="bg-[#b455a0] flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save COA</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {extractionComplete && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-ibm-plex font-medium text-green-800">
                Extraction Complete!
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                Data has been extracted from COA files. Review and edit as needed before saving.
                {extractionCost && ` (Cost: $${extractionCost.total_cost?.toFixed(4)})`}
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

        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-start gap-3">
            <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-ibm-plex font-medium text-green-800">
                COA Saved Successfully!
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                The COA data has been saved to the database.
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
                  Extracting COA data...
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  This may take 10-30 seconds depending on file size and quality
                </p>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Area */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm p-6 mb-6">
          <div
            className={`border-2 border-dashed rounded-xl p-12 transition-colors ${
              dragActive ? 'border-[#2463eb] bg-[#2463eb]/10' : 'border-[#e1e7ef] bg-white'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#2463eb]/10 flex items-center justify-center mb-4">
                <Upload className="w-8 h-8 text-[#2463eb]" />
              </div>
              <div className="mb-4">
                <p className="text-lg font-ibm-plex font-medium text-[#0f1729] mb-1">
                  Drag & Drop COA files here or click to browse
                </p>
                <p className="text-sm font-ibm-plex text-[#65758b]">
                  Supports PDF, JPG, PNG • Max 10MB per file
                </p>
              </div>
              <label className="mt-2">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <span className="inline-block px-4 py-2 bg-[#f9fafb] border border-[#e1e7ef] text-[#0f1729] text-sm font-ibm-plex font-medium rounded-md cursor-pointer hover:bg-gray-100 transition-colors">
                  Browse Files
                </span>
              </label>
            </div>
          </div>
          
          {/* Display uploaded files */}
          {uploadedFiles.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                Uploaded Files ({uploadedFiles.length})
              </p>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#65758b]" />
                      <span className="text-sm font-ibm-plex text-[#0f1729]">{file.name}</span>
                      <span className="text-xs text-[#65758b]">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg p-6 mb-6">
          <div className="border-b border-[#e1e7ef] pb-2 mb-4">
            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
              Basic Information
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Ingredient Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={ingredientName}
                onChange={(e) => setIngredientName(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter ingredient name"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Product Code
              </label>
              <input
                type="text"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter product code"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Lot Number
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter lot number"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Supplier Name
              </label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter supplier name"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Manufacturing Date
              </label>
              <input
                type="text"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="DD/MM/YYYY"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Expiry Date
              </label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="DD/MM/YYYY"
              />
            </div>
            <div>
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Storage Condition
              </label>
              <input
                type="text"
                value={storageCondition}
                onChange={(e) => setStorageCondition(e.target.value)}
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Store in cool dry place"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-3">
                Supplier Address
              </label>
              <textarea
                value={supplierAddress}
                onChange={(e) => setSupplierAddress(e.target.value)}
                rows="3"
                className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="Enter supplier address"
              />
            </div>
          </div>
        </div>

        {/* Nutritional Data Table */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm mb-6">
          <div className="p-4 border-b border-[#e1e7ef] flex items-center justify-between">
            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
              Nutritional Data {nutrients.length > 0 && `(${nutrients.length} nutrients)`}
            </h2>
          </div>
          
          {nutrients.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-[#e1e7ef] mx-auto mb-3" />
              <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                No nutritional data yet. Upload a COA and click "Extract Data" or add nutrients manually.
              </p>
              <button
                onClick={addNutrient}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-ibm-plex font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Nutrient Manually
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                      <th className="px-3 py-3 text-left min-w-[140px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Nutrient
                        </span>
                      </th>
                      <th className="px-3 py-3 text-left min-w-[120px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Raw Name
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right min-w-[90px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Actual
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right min-w-[90px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Min
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right min-w-[90px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Max
                        </span>
                      </th>
                      <th className="px-3 py-3 text-right min-w-[90px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Average
                        </span>
                      </th>
                      <th className="px-3 py-3 text-center min-w-[70px]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Unit
                        </span>
                      </th>
                      <th className="px-3 py-3 text-center w-16 sticky right-0 bg-[#f1f5f9]">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                          Action
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutrients.map((nutrient, index) => (
                      <tr key={nutrient.id} className={index !== nutrients.length - 1 ? 'border-b border-[#e1e7ef]' : ''}>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.name}
                            onChange={(e) => updateNutrient(nutrient.id, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex font-medium text-[#0f1729] bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="Nutrient name"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.nutrient_name_raw}
                            onChange={(e) => updateNutrient(nutrient.id, 'nutrient_name_raw', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#65758b] bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="Raw name"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.actual}
                            onChange={(e) => updateNutrient(nutrient.id, 'actual', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#0f1729] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.min}
                            onChange={(e) => updateNutrient(nutrient.id, 'min', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.max}
                            onChange={(e) => updateNutrient(nutrient.id, 'max', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.average}
                            onChange={(e) => updateNutrient(nutrient.id, 'average', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="text"
                            value={nutrient.unit_normalized}
                            onChange={(e) => updateNutrient(nutrient.id, 'unit_normalized', e.target.value)}
                            className="w-full px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-center bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            placeholder="g"
                          />
                        </td>
                        <td className="px-3 py-3 text-center sticky right-0 bg-white">
                          <button
                            onClick={() => removeNutrient(nutrient.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Add Row Button */}
              <div className="border-t border-[#e1e7ef] p-4">
                <button
                  onClick={addNutrient}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-ibm-plex font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Nutrient Row
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default AddCOA
