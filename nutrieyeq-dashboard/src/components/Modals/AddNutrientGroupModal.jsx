import { useState } from 'react'
import { X, Plus } from 'lucide-react'

const AddNutrientGroupModal = ({ isOpen, onClose, onSave }) => {
  const [groupName, setGroupName] = useState('')
  const [showError, setShowError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()

    if (!groupName.trim()) {
      setShowError(true)
      return
    }

    onSave(groupName.trim())
    setGroupName('')
    setShowError(false)
    onClose()
    alert('Nutrient group created successfully!')
  }

  const handleCancel = () => {
    setGroupName('')
    setShowError(false)
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
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-[#e1e7ef] rounded-lg shadow-xl z-50 w-full max-w-xl">
        {/* Header */}
        <div className="p-6 border-b border-[#e1e7ef]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-ibm-plex font-semibold text-[#0f1729] tracking-tight">
              Add Nutrient Group
            </h2>
            <button
              onClick={handleCancel}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 transition-colors opacity-70"
            >
              <X className="w-4 h-4 text-[#0f1729]" />
            </button>
          </div>
          <p className="text-sm font-ibm-plex text-[#65758b]">
            Create a new nutrient group to organize your standardized mappings.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Group Name */}
          <div>
            <label className="text-sm font-ibm-plex font-medium text-[#0f1729] mb-2 block">
              Nutrient Group Name
            </label>
            <input
              type="text"
              placeholder="e.g., Proteins, Fats, Carbohydrates"
              value={groupName}
              onChange={(e) => {
                setGroupName(e.target.value)
                setShowError(false)
              }}
              className={`w-full h-10 px-3 bg-[#f9fafb] border rounded-md text-sm font-ibm-plex text-[#0f1729] placeholder:text-[#65758b] focus:outline-none focus:ring-2 ${
                showError
                  ? 'border-[#ef4343] focus:ring-[#ef4343]'
                  : 'border-[#e1e7ef] focus:ring-[#b455a0]'
              }`}
            />
            {showError && (
              <p className="text-xs font-ibm-plex text-[#ef4343] mt-1">
                Nutrient group name is required.
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 h-10 px-4 border border-[#e1e7ef] bg-[#f9fafb] rounded-md text-sm font-ibm-plex font-medium text-[#0f1729] hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            
            <button
              type="submit"
              className="flex-1 h-10 px-4 bg-[#b455a0] rounded-md text-sm font-ibm-plex font-medium text-white hover:bg-[#a04890] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Group
            </button>
          </div>
        </form>
      </div>
    </>
  )
}

export default AddNutrientGroupModal








