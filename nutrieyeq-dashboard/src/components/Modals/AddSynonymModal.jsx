import { useState } from 'react'
import { X, Plus } from 'lucide-react'

const AddSynonymModal = ({ isOpen, onClose, onSave, groupName, existingStandardName }) => {
  const [standardName, setStandardName] = useState('')
  const [rawNames, setRawNames] = useState([{ id: 1, value: '', error: false }])
  const [standardError, setStandardError] = useState(false)

  // Use existing standard name if available
  const hasExistingStandard = existingStandardName && existingStandardName.trim() !== ''
  const finalStandardName = hasExistingStandard ? existingStandardName : standardName

  const handleAddRawName = () => {
    setRawNames([
      ...rawNames,
      { id: rawNames.length + 1, value: '', error: false }
    ])
  }

  const handleRawNameChange = (id, value) => {
    setRawNames(rawNames.map(raw =>
      raw.id === id ? { ...raw, value, error: false } : raw
    ))
  }

  const handleSubmit = (e) => {
    e.preventDefault()

    // Validate standardized name (only if not already existing)
    if (!hasExistingStandard && !standardName.trim()) {
      setStandardError(true)
      return
    }

    // Validate all raw names
    let hasErrors = false
    const updatedRawNames = rawNames.map(raw => {
      if (!raw.value.trim()) {
        hasErrors = true
        return { ...raw, error: true }
      }
      return { ...raw, error: false }
    })

    setRawNames(updatedRawNames)

    if (hasErrors) {
      return
    }

    // Save all raw names with the standardized name
    const validRawNames = rawNames.filter(raw => raw.value.trim()).map(raw => raw.value.trim())
    onSave(validRawNames, finalStandardName.trim())

    // Reset and close
    setStandardName('')
    setRawNames([{ id: 1, value: '', error: false }])
    setStandardError(false)
    onClose()
    alert(`Successfully added ${validRawNames.length} synonym(s) to ${groupName}`)
  }

  const handleCancel = () => {
    setStandardName('')
    setRawNames([{ id: 1, value: '', error: false }])
    setStandardError(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/80 z-50"
        onClick={handleCancel}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-[#e1e7ef] rounded-lg shadow-xl z-50 w-full max-w-xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#e1e7ef] bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729] tracking-tight">
              Add Nutrient
            </h2>
            <button
              onClick={handleCancel}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors opacity-70"
            >
              <X className="w-4 h-4 text-[#0f1729]" />
            </button>
          </div>
          <p className="text-sm font-ibm-plex text-[#65758b]">
            Add a raw term and map it to a standardized nutrient name for this group.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white">
          {/* Standardized Name - Show ONLY if group has no existing mappings */}
          {!hasExistingStandard && (
            <>
              <div>
                <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
                  Standardized Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Protein, Total Fat, Energy"
                  value={standardName}
                  onChange={(e) => {
                    setStandardName(e.target.value)
                    setStandardError(false)
                  }}
                  className={`w-full h-10 px-3 bg-[#f9fafb] border rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 ${
                    standardError
                      ? 'border-[#ef4343] focus:ring-[#ef4343]'
                      : 'border-[#e1e7ef] focus:ring-[#b455a0]'
                  }`}
                />
                {standardError && (
                  <p className="text-xs font-ibm-plex text-[#ef4343] mt-1">
                    Standardized name is required.
                  </p>
                )}
              </div>
              {/* Divider */}
              <div className="h-px bg-[#e1e7ef]" />
            </>
          )}

          {/* Show existing standard name if available */}
          {hasExistingStandard && (
            <div className="bg-[#b455a0]/10 border border-[#b455a0]/20 rounded-lg p-4 mb-4">
              <div className="text-xs font-ibm-plex font-medium text-[#65758b] mb-1">
                Mapping to:
              </div>
              <div className="text-base font-ibm-plex font-semibold text-[#b455a0]">
                {existingStandardName}
              </div>
            </div>
          )}

          {/* Raw / Source Names - MULTIPLE FIELDS (Teal Color) */}
          <div className="space-y-4">
            {rawNames.map((raw, index) => (
              <div key={raw.id}>
                <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
                  Raw / Source Name{index > 0 ? ` - ${index + 1}` : ''}
                </label>
                <input
                  type="text"
                  placeholder="e.g., crude protein, total lipid, calories"
                  value={raw.value}
                  onChange={(e) => handleRawNameChange(raw.id, e.target.value)}
                  className={`w-full h-10 px-3 bg-[#f9fafb] border rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 ${
                    raw.error
                      ? 'border-[#ef4343] focus:ring-[#ef4343]'
                      : 'border-[#e1e7ef] focus:ring-[#009da5]'
                  }`}
                />
                {raw.error && (
                  <p className="text-xs font-ibm-plex text-[#ef4343] mt-1">
                    Raw/source name is required.
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleAddRawName}
              className="bg-[#009da5] flex items-center justify-center gap-2 h-10 px-4 rounded-md text-white font-ibm-plex font-medium text-sm hover:bg-[#008891] transition-colors"
              title="Add another raw/source name field"
            >
              <Plus className="w-4 h-4" />
              Add synonym
            </button>
            
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 h-10 px-4 border border-[#e1e7ef] bg-[#f9fafb] rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="flex-1 h-10 px-4 bg-[#b455a0] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#a04890] transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default AddSynonymModal

