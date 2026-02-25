import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout/Layout'
import { Edit, Trash2, FileText, Loader2, RefreshCw, Save, X, AlertCircle, Check, Plus, Eye, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Image } from 'lucide-react'
import { coaService } from '../services/api'

const COA = () => {
  const navigate = useNavigate()
  
  // COA list state
  const [coaList, setCOAList] = useState([])
  const [isLoadingList, setIsLoadingList] = useState(true)
  
  // Edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingCOA, setEditingCOA] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)
  
  // View modal state
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewingCOA, setViewingCOA] = useState(null)
  const [isLoadingView, setIsLoadingView] = useState(false)
  
  // File preview modal state
  const [isFilePreviewOpen, setIsFilePreviewOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [previewIngredientName, setPreviewIngredientName] = useState('')
  
  // Edit form state
  const [ingredientName, setIngredientName] = useState('')
  const [productCode, setProductCode] = useState('')
  const [lotNumber, setLotNumber] = useState('')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [shelfLife, setShelfLife] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [supplierAddress, setSupplierAddress] = useState('')
  const [storageCondition, setStorageCondition] = useState('')
  const [analysisMethod, setAnalysisMethod] = useState('')
  const [nutrients, setNutrients] = useState([])

  // Load COAs on mount
  useEffect(() => {
    loadCOAList()
  }, [])

  const loadCOAList = async () => {
    setIsLoadingList(true)
    try {
      const result = await coaService.getCOAs({ limit: 100 })
      setCOAList(result.coas || [])
    } catch (error) {
      console.error('Failed to load COA list:', error)
    } finally {
      setIsLoadingList(false)
    }
  }

  // Open file preview modal
  const handleFilePreview = async (coa) => {
    try {
      setIsLoadingPreview(true)
      setIsFilePreviewOpen(true)
      setPreviewIngredientName(coa.ingredient_name || '')
      setPreviewIndex(0)
      setPreviewZoom(1)
      const fullCOA = await coaService.getCOA(coa.id)
      if (fullCOA && fullCOA.document_images && fullCOA.document_images.length > 0) {
        setPreviewImages(fullCOA.document_images)
      } else {
        setPreviewImages([])
      }
    } catch (error) {
      console.error('Failed to load COA documents:', error)
      setPreviewImages([])
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handlePreviewDownload = () => {
    if (previewImages.length === 0) return
    const dataUrl = previewImages[previewIndex]
    const a = document.createElement('a')
    a.href = dataUrl
    // Detect extension from data URL
    const match = dataUrl.match(/^data:([^;]+)/)
    const mime = match ? match[1] : 'image/png'
    const ext = mime.includes('pdf') ? 'pdf' : mime.includes('png') ? 'png' : 'jpg'
    a.download = `COA_${previewIngredientName.replace(/\s+/g, '_')}_page${previewIndex + 1}.${ext}`
    a.click()
  }

  // Open view modal
  const handleViewCOA = async (coa) => {
    try {
      setIsLoadingView(true)
      setIsViewModalOpen(true)
      const fullCOA = await coaService.getCOA(coa.id)
      if (fullCOA) {
        setViewingCOA(fullCOA)
      }
    } catch (error) {
      console.error('Failed to load COA details:', error)
      alert('Failed to load COA details')
      setIsViewModalOpen(false)
    } finally {
      setIsLoadingView(false)
    }
  }

  // Download COA as CSV
  const handleDownloadCOA = (coa) => {
    if (!coa) return
    const lines = []
    
    // Basic info
    lines.push('=== COA Details ===')
    lines.push(`Ingredient Name,${coa.ingredient_name || ''}`)
    if (coa.product_code) lines.push(`Product Code,${coa.product_code}`)
    if (coa.lot_number) lines.push(`Lot Number,${coa.lot_number}`)
    if (coa.manufacturing_date) lines.push(`Manufacturing Date,${coa.manufacturing_date}`)
    if (coa.expiry_date) lines.push(`Expiry Date,${coa.expiry_date}`)
    if (coa.shelf_life) lines.push(`Shelf Life,${coa.shelf_life}`)
    if (coa.supplier_name) lines.push(`Supplier Name,${coa.supplier_name}`)
    if (coa.supplier_address) lines.push(`Supplier Address,"${coa.supplier_address.replace(/"/g, '""')}"`)
    if (coa.storage_condition) lines.push(`Storage Condition,"${coa.storage_condition.replace(/"/g, '""')}"`)
    if (coa.analysis_method) lines.push(`Analysis Method,${coa.analysis_method}`)
    lines.push('')
    
    // Nutritional data - dynamic columns based on what has data
    if (coa.nutritional_data && coa.nutritional_data.length > 0) {
      lines.push('=== Nutritional Data ===')
      
      // Check which columns have data
      const hasActual = coa.nutritional_data.some(n => n.actual_value !== null && n.actual_value !== undefined)
      const hasMin = coa.nutritional_data.some(n => n.min_value !== null && n.min_value !== undefined)
      const hasMax = coa.nutritional_data.some(n => n.max_value !== null && n.max_value !== undefined)
      const hasAverage = coa.nutritional_data.some(n => n.average_value !== null && n.average_value !== undefined)
      
      // Build header dynamically
      const headers = ['Nutrient']
      if (hasActual) headers.push('Actual')
      if (hasMin) headers.push('Min')
      if (hasMax) headers.push('Max')
      if (hasAverage) headers.push('Average')
      headers.push('Unit')
      lines.push(headers.join(','))
      
      // Build rows with only columns that have data
      coa.nutritional_data.forEach(n => {
        const row = [`"${n.nutrient_name || ''}"`]
        if (hasActual) row.push(n.actual_value ?? '')
        if (hasMin) row.push(n.min_value ?? '')
        if (hasMax) row.push(n.max_value ?? '')
        if (hasAverage) row.push(n.average_value ?? '')
        row.push(n.unit || '')
        lines.push(row.join(','))
      })
    }
    
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `COA_${(coa.ingredient_name || 'export').replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Open edit modal and populate form
  const handleEditCOA = async (coa) => {
    try {
      // Fetch full COA details
      const fullCOA = await coaService.getCOA(coa.id)
      
      if (fullCOA) {
        setEditingCOA(fullCOA)
        setIngredientName(fullCOA.ingredient_name || '')
        setProductCode(fullCOA.product_code || '')
        setLotNumber(fullCOA.lot_number || '')
        setManufacturingDate(fullCOA.manufacturing_date || '')
        setExpiryDate(fullCOA.expiry_date || '')
        setShelfLife(fullCOA.shelf_life || '')
        setSupplierName(fullCOA.supplier_name || '')
        setSupplierAddress(fullCOA.supplier_address || '')
        setStorageCondition(fullCOA.storage_condition || '')
        setAnalysisMethod(fullCOA.analysis_method || '')
        
        // Convert nutritional data to form format
        const nutrientRows = (fullCOA.nutritional_data || []).map((item, index) => ({
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
        setIsEditModalOpen(true)
      }
    } catch (error) {
      console.error('Failed to load COA details:', error)
      alert('Failed to load COA details')
    }
  }

  // Close edit modal
  const handleCloseModal = () => {
    setIsEditModalOpen(false)
    setEditingCOA(null)
    setSaveSuccess(false)
    setSaveError(null)
  }

  // Update nutrient field
  const updateNutrient = (id, field, value) => {
    setNutrients(nutrients.map(nutrient =>
      nutrient.id === id ? { ...nutrient, [field]: value } : nutrient
    ))
  }

  // Add nutrient row
  const addNutrient = () => {
    const newId = nutrients.length > 0 ? Math.max(...nutrients.map(n => n.id)) + 1 : 1
    setNutrients([
      ...nutrients,
      { 
        id: newId, 
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
  }

  // Remove nutrient row
  const removeNutrient = (id) => {
    if (nutrients.length > 0) {
      setNutrients(nutrients.filter(nutrient => nutrient.id !== id))
    }
  }

  // Save edited COA
  const handleSaveCOA = async () => {
    if (!ingredientName.trim()) {
      setSaveError('Please enter Ingredient Name')
      return
    }

    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError(null)
    
    try {
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
        shelf_life: shelfLife || null,
        supplier_name: supplierName || null,
        supplier_address: supplierAddress || null,
        storage_condition: storageCondition || null,
        analysis_method: analysisMethod || null,
        nutritional_data: nutritionalData,
        other_parameters: editingCOA?.other_parameters || [],
        certifications: editingCOA?.certifications || [],
        additional_notes: editingCOA?.additional_notes || [],
        document_images: editingCOA?.document_images || [],
        status: 'active'
      }
      
      const result = await coaService.updateCOA(editingCOA.id, coaData)
      
      if (result.success) {
        setSaveSuccess(true)
        // Reload list
        loadCOAList()
        // Close modal after 1.5 seconds
        setTimeout(() => {
          handleCloseModal()
        }, 1500)
      } else {
        setSaveError(result.error || 'Failed to save COA')
      }
    } catch (error) {
      console.error('Save error:', error)
      setSaveError('Failed to save COA data')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete COA
  const handleDeleteCOA = async (coaId) => {
    if (!confirm('Are you sure you want to delete this COA?')) return
    
    try {
      const result = await coaService.deleteCOA(coaId)
      if (result.success) {
        loadCOAList()
      } else {
        alert(`Failed to delete COA: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete COA')
    }
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 h-full flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-ibm-plex font-bold text-[#0f1729] mb-1">
              COA Database
            </h1>
            <p className="text-sm md:text-base font-ibm-plex text-[#65758b]">
              View and manage all Certificate of Analysis documents
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadCOAList}
              disabled={isLoadingList}
              className="flex items-center gap-2 px-4 py-2 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] border border-[#e1e7ef] hover:bg-[#f9fafb] rounded-md transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => navigate('/add-coa')}
              className="bg-[#b455a0] flex items-center gap-2 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add New COA
            </button>
          </div>
        </div>

        {/* COA Table */}
        <div className="bg-white border border-[#e1e7ef] rounded-lg shadow-sm">
          {isLoadingList ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 text-[#65758b] animate-spin mx-auto mb-2" />
              <p className="text-sm font-ibm-plex text-[#65758b]">Loading COAs...</p>
            </div>
          ) : coaList.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-[#e1e7ef] mx-auto mb-3" />
              <p className="text-sm font-ibm-plex text-[#65758b] mb-4">
                No COAs saved yet. Upload a COA document to get started.
              </p>
              <button
                onClick={() => navigate('/add-coa')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#b455a0] text-white text-sm font-ibm-plex font-medium rounded-md hover:bg-[#a04890] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First COA
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Ingredient Name
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Supplier
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Lot Number
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Mfg Date
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Expiry Date
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Nutrients
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Created
                      </span>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coaList.map((coa, index) => (
                    <tr key={coa.id} className={index !== coaList.length - 1 ? 'border-b border-[#e1e7ef]' : ''}>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex font-medium text-[#0f1729]">
                          {coa.ingredient_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex text-[#65758b]">
                          {coa.supplier_name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex text-[#65758b]">
                          {coa.lot_number || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex text-[#65758b]">
                          {coa.manufacturing_date || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex text-[#65758b]">
                          {coa.expiry_date || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 bg-[#009da5]/10 text-[#009da5] text-xs font-ibm-plex font-medium rounded-full">
                          {coa.nutrients_count || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-ibm-plex text-[#65758b]">
                          {new Date(coa.created_at).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {(coa.has_documents || coa.documents_count > 0) && (
                            <button
                              onClick={() => handleFilePreview(coa)}
                              className="text-[#2463eb] hover:text-[#1d4ed8] transition-colors"
                              title="Preview Document"
                            >
                              <Image className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleViewCOA(coa)}
                            className="text-[#65758b] hover:text-[#0f1729] transition-colors"
                            title="View COA"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditCOA(coa)}
                            className="text-[#009da5] hover:text-[#008891] transition-colors"
                            title="Edit COA"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCOA(coa.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            title="Delete COA"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
      {isFilePreviewOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#e1e7ef] flex-shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[#2463eb]" />
                <div>
                  <h2 className="text-base font-ibm-plex font-bold text-[#0f1729]">
                    Document Preview
                  </h2>
                  <p className="text-xs font-ibm-plex text-[#65758b]">
                    {previewIngredientName}{previewImages.length > 0 ? ` — Page ${previewIndex + 1} of ${previewImages.length}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Zoom Controls — only for images, PDFs have built-in zoom */}
                {previewImages.length > 0 && !previewImages[previewIndex]?.startsWith('data:application/pdf') && (
                  <div className="flex items-center gap-1 bg-[#f1f5f9] rounded-md px-2 py-1">
                    <button
                      onClick={() => setPreviewZoom(z => Math.max(0.25, z - 0.25))}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4 text-[#65758b]" />
                    </button>
                    <span className="text-xs font-ibm-plex text-[#0f1729] min-w-[40px] text-center font-medium">
                      {Math.round(previewZoom * 100)}%
                    </span>
                    <button
                      onClick={() => setPreviewZoom(z => Math.min(4, z + 0.25))}
                      className="p-1 hover:bg-gray-200 rounded transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4 text-[#65758b]" />
                    </button>
                    <button
                      onClick={() => setPreviewZoom(1)}
                      className="px-2 py-0.5 text-xs font-ibm-plex text-[#65758b] hover:bg-gray-200 rounded transition-colors"
                      title="Reset Zoom"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {/* Download */}
                <button
                  onClick={handlePreviewDownload}
                  disabled={previewImages.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#009da5] text-white font-ibm-plex font-medium text-xs hover:bg-[#008891] transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                {/* Close */}
                <button
                  onClick={() => { setIsFilePreviewOpen(false); setPreviewImages([]); setPreviewZoom(1) }}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-[#65758b]" />
                </button>
              </div>
            </div>

            {/* Document Area */}
            <div className="flex-1 overflow-auto bg-[#f1f3f5] relative flex items-center justify-center min-h-0">
              {isLoadingPreview ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-8 h-8 text-[#65758b] animate-spin mx-auto mb-2" />
                  <p className="text-sm font-ibm-plex text-[#65758b]">Loading document...</p>
                </div>
              ) : previewImages.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="w-12 h-12 text-[#e1e7ef] mx-auto mb-3" />
                  <p className="text-sm font-ibm-plex text-[#65758b]">No document images available for this COA.</p>
                </div>
              ) : previewImages[previewIndex]?.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewImages[previewIndex]}
                  title={`COA Document Page ${previewIndex + 1}`}
                  className="w-full h-full border-0"
                  style={{ minHeight: '600px' }}
                />
              ) : (
                <div className="p-4 flex items-center justify-center" style={{ minHeight: '400px' }}>
                  <img
                    src={previewImages[previewIndex]}
                    alt={`COA Document Page ${previewIndex + 1}`}
                    className="max-w-none shadow-lg rounded border border-[#e1e7ef] transition-transform duration-200"
                    style={{
                      transform: `scale(${previewZoom})`,
                      transformOrigin: 'center center',
                      cursor: previewZoom > 1 ? 'grab' : 'default',
                    }}
                    draggable={false}
                  />
                </div>
              )}
            </div>

            {/* Page Navigation */}
            {previewImages.length > 1 && (
              <div className="flex items-center justify-center gap-4 px-5 py-3 border-t border-[#e1e7ef] bg-white flex-shrink-0">
                <button
                  onClick={() => { setPreviewIndex(i => Math.max(0, i - 1)); setPreviewZoom(1) }}
                  disabled={previewIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {previewImages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setPreviewIndex(idx); setPreviewZoom(1) }}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        idx === previewIndex ? 'bg-[#2463eb]' : 'bg-[#e1e7ef] hover:bg-[#c5cdd8]'
                      }`}
                    />
                  ))}
                </div>
                <button
                  onClick={() => { setPreviewIndex(i => Math.min(previewImages.length - 1, i + 1)); setPreviewZoom(1) }}
                  disabled={previewIndex === previewImages.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm font-ibm-plex font-medium text-[#65758b] hover:text-[#0f1729] hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-[#e1e7ef] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729]">
                  COA Details
                </h2>
                <p className="text-sm font-ibm-plex text-[#65758b] mt-0.5">
                  {viewingCOA?.ingredient_name || 'Loading...'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadCOA(viewingCOA)}
                  disabled={!viewingCOA}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#009da5] text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={() => { setIsViewModalOpen(false); setViewingCOA(null) }}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-[#65758b]" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {isLoadingView ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-8 h-8 text-[#65758b] animate-spin mx-auto mb-2" />
                  <p className="text-sm font-ibm-plex text-[#65758b]">Loading COA details...</p>
                </div>
              ) : viewingCOA ? (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div className="bg-[#f9fafb] border border-[#e1e7ef] rounded-lg p-5">
                    <h3 className="text-base font-ibm-plex font-semibold text-[#0f1729] mb-4 pb-2 border-b border-[#e1e7ef]">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                      {[
                        { label: 'Ingredient Name', value: viewingCOA.ingredient_name },
                        { label: 'Product Code', value: viewingCOA.product_code },
                        { label: 'Lot Number', value: viewingCOA.lot_number },
                        { label: 'Supplier Name', value: viewingCOA.supplier_name },
                        { label: 'Manufacturing Date', value: viewingCOA.manufacturing_date },
                        { label: 'Expiry Date', value: viewingCOA.expiry_date },
                        { label: 'Shelf Life', value: viewingCOA.shelf_life },
                        { label: 'Storage Condition', value: viewingCOA.storage_condition },
                        { label: 'Analysis Method', value: viewingCOA.analysis_method },
                      ].map((item, i) => (
                        <div key={i} className="flex flex-col">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider mb-1">
                            {item.label}
                          </span>
                          <span className="text-sm font-ibm-plex text-[#0f1729]">
                            {item.value || '—'}
                          </span>
                        </div>
                      ))}
                      <div className="col-span-2 flex flex-col">
                        <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase tracking-wider mb-1">
                          Supplier Address
                        </span>
                        <span className="text-sm font-ibm-plex text-[#0f1729]">
                          {viewingCOA.supplier_address || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nutritional Data */}
                  {viewingCOA.nutritional_data && viewingCOA.nutritional_data.length > 0 && (
                    <div className="bg-white border border-[#e1e7ef] rounded-lg overflow-hidden">
                      <div className="px-5 py-3 border-b border-[#e1e7ef] bg-[#f9fafb]">
                        <h3 className="text-base font-ibm-plex font-semibold text-[#0f1729]">
                          Nutritional Data ({viewingCOA.nutritional_data.length} nutrients)
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                              <th className="px-4 py-2.5 text-left"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Nutrient</span></th>
                              <th className="px-4 py-2.5 text-right"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Actual</span></th>
                              <th className="px-4 py-2.5 text-right"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Min</span></th>
                              <th className="px-4 py-2.5 text-right"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Max</span></th>
                              <th className="px-4 py-2.5 text-right"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Average</span></th>
                              <th className="px-4 py-2.5 text-center"><span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Unit</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingCOA.nutritional_data.map((n, idx) => (
                              <tr key={idx} className={idx !== viewingCOA.nutritional_data.length - 1 ? 'border-b border-[#e1e7ef]' : ''}>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex font-medium text-[#0f1729]">{n.nutrient_name}</td>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex text-[#0f1729] text-right">{n.actual_value ?? '—'}</td>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex text-[#65758b] text-right">{n.min_value ?? '—'}</td>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex text-[#65758b] text-right">{n.max_value ?? '—'}</td>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex text-[#65758b] text-right">{n.average_value ?? '—'}</td>
                                <td className="px-4 py-2.5 text-sm font-ibm-plex text-[#65758b] text-center">{n.unit || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Other Parameters */}
                  {viewingCOA.other_parameters && viewingCOA.other_parameters.length > 0 && (
                    <div className="bg-[#f9fafb] border border-[#e1e7ef] rounded-lg p-5">
                      <h3 className="text-base font-ibm-plex font-semibold text-[#0f1729] mb-3">
                        Other Parameters
                      </h3>
                      <div className="space-y-2">
                        {viewingCOA.other_parameters.map((p, idx) => (
                          <div key={idx} className="flex items-center gap-4 text-sm font-ibm-plex">
                            <span className="font-medium text-[#0f1729]">{p.parameter_name}</span>
                            <span className="text-[#65758b]">Value: {p.value || '—'}</span>
                            {p.specification && <span className="text-[#65758b]">Spec: {p.specification}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-[#e1e7ef] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-ibm-plex font-bold text-[#0f1729]">
                  Edit COA
                </h2>
                <p className="text-sm font-ibm-plex text-[#65758b] mt-0.5">
                  {editingCOA?.ingredient_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCOA}
                  disabled={isSaving || !ingredientName.trim()}
                  className="bg-[#b455a0] flex items-center gap-2 px-4 py-2 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#a04890] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleCloseModal}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5 text-[#65758b]" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Status Messages */}
              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-green-800">
                      COA Updated Successfully!
                    </p>
                  </div>
                </div>
              )}

              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-ibm-plex font-medium text-red-800">
                      {saveError}
                    </p>
                  </div>
                </div>
              )}

              {/* Basic Information */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg p-6">
                <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729] mb-4 pb-2 border-b border-[#e1e7ef]">
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Ingredient Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={ingredientName}
                      onChange={(e) => setIngredientName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Product Code
                    </label>
                    <input
                      type="text"
                      value={productCode}
                      onChange={(e) => setProductCode(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Lot Number
                    </label>
                    <input
                      type="text"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Supplier Name
                    </label>
                    <input
                      type="text"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
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
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
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
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Shelf Life
                    </label>
                    <input
                      type="text"
                      value={shelfLife}
                      onChange={(e) => setShelfLife(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g., 12 months, 18 months"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
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
                  <div>
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Analysis Method
                    </label>
                    <input
                      type="text"
                      value={analysisMethod}
                      onChange={(e) => setAnalysisMethod(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. HPLC, AOAC, etc."
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-ibm-plex font-medium text-[#0f1729] mb-2">
                      Supplier Address
                    </label>
                    <textarea
                      value={supplierAddress}
                      onChange={(e) => setSupplierAddress(e.target.value)}
                      rows="3"
                      className="w-full px-3 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Nutritional Data Table */}
              <div className="bg-white border border-[#e1e7ef] rounded-lg">
                <div className="px-6 py-4 border-b border-[#e1e7ef] flex items-center justify-between">
                  <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
                    Nutritional Data ({nutrients.length} nutrients)
                  </h3>
                  <button
                    onClick={addNutrient}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-ibm-plex font-medium text-primary hover:bg-primary/10 rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Row
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-[#e1e7ef]">
                        <th className="px-3 py-2 text-left">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Nutrient</span>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Actual</span>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Min</span>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Max</span>
                        </th>
                        <th className="px-3 py-2 text-right">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Average</span>
                        </th>
                        <th className="px-3 py-2 text-center">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Unit</span>
                        </th>
                        <th className="px-3 py-2 text-center w-16">
                          <span className="text-xs font-ibm-plex font-medium text-[#65758b] uppercase">Action</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {nutrients.map((nutrient, index) => (
                        <tr key={nutrient.id} className={index !== nutrients.length - 1 ? 'border-b border-[#e1e7ef]' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.name}
                              onChange={(e) => updateNutrient(nutrient.id, 'name', e.target.value)}
                              className="w-full px-2 py-1 text-sm font-ibm-plex text-[#0f1729] bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                              placeholder="Nutrient name"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.actual}
                              onChange={(e) => updateNutrient(nutrient.id, 'actual', e.target.value)}
                              className="w-20 px-2 py-1 text-sm font-ibm-plex text-[#0f1729] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.min}
                              onChange={(e) => updateNutrient(nutrient.id, 'min', e.target.value)}
                              className="w-20 px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.max}
                              onChange={(e) => updateNutrient(nutrient.id, 'max', e.target.value)}
                              className="w-20 px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.average}
                              onChange={(e) => updateNutrient(nutrient.id, 'average', e.target.value)}
                              className="w-20 px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-right bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={nutrient.unit_normalized}
                              onChange={(e) => updateNutrient(nutrient.id, 'unit_normalized', e.target.value)}
                              className="w-16 px-2 py-1 text-sm font-ibm-plex text-[#65758b] text-center bg-transparent border border-transparent hover:border-[#e1e7ef] focus:border-primary focus:outline-none rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeNutrient(nutrient.id)}
                              className="text-red-500 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default COA
