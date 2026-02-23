import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'

const EditMappingModal = ({ isOpen, onClose, onSave, mapping }) => {
  const [standardName, setStandardName] = useState('')
  const [rawName, setRawName] = useState('')
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (mapping?.mapping) {
      setStandardName(mapping.mapping.standardName)
      setRawName(mapping.mapping.rawName)
    }
  }, [mapping])

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!rawName.trim()) {
      setShowError(true)
      return
    }

    // Standardized name stays the same, only raw name changes
    onSave(rawName.trim(), standardName.trim())
    setShowError(false)
    alert('Synonym updated successfully!')
  }

  const handleCancel = () => {
    setShowError(false)
    onClose()
  }

  if (!isOpen || !mapping) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-50" onClick={handleCancel} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-[#e1e7ef] rounded-lg shadow-xl z-50 w-full max-w-xl">
        <div className="p-6 border-b border-[#e1e7ef]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
              Edit Synonym
            </h2>
            <button onClick={handleCancel} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors opacity-70">
              <X className="w-4 h-4 text-[#0f1729]" />
            </button>
          </div>
          <p className="text-sm font-ibm-plex text-[#65758b]">
            Update the raw/source name. The standardized name is fixed for all synonyms in this group.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Standardized Name (Fixed)
            </label>
            <input
              type="text"
              value={standardName}
              disabled
              className="w-full h-10 px-3 bg-gray-100 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#65758b] cursor-not-allowed"
            />
            <p className="text-xs font-ibm-plex text-[#65758b] mt-1">
              This applies to all synonyms. Use "Edit Group" to change it.
            </p>
          </div>

          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Raw / Source Name
            </label>
            <input
              type="text"
              value={rawName}
              onChange={(e) => {
                setRawName(e.target.value)
                setShowError(false)
              }}
              className={`w-full h-10 px-3 bg-[#f9fafb] border rounded-md text-sm font-ibm-plex text-[#0f1729] focus:outline-none focus:ring-2 ${
                showError ? 'border-[#ef4343] focus:ring-[#ef4343]' : 'border-[#e1e7ef] focus:ring-[#009da5]'
              }`}
              placeholder="e.g., dietary fiber"
            />
            {showError && <p className="text-xs font-ibm-plex text-[#ef4343] mt-1">Raw/source name is required.</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleCancel} className="flex-1 h-10 px-4 border border-[#e1e7ef] bg-[#f9fafb] rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-1 h-10 px-4 bg-[#b455a0] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#a04890] transition-colors flex items-center justify-center gap-2">
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default EditMappingModal








