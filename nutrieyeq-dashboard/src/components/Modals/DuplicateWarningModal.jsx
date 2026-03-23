import { AlertTriangle, X, Save } from 'lucide-react'

const DuplicateWarningModal = ({ isOpen, onClose, onSaveAnyway, matchedName }) => {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 w-full max-w-md">
        <div className="flex flex-col items-end">
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors opacity-70 mb-4"
          >
            <X className="w-5 h-5 text-[#0f1729]" />
          </button>

          <div className="flex flex-col items-center justify-center w-full">
            <div className="w-16 h-16 bg-[#b455a0]/10 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-[#b455a0]" />
            </div>

            <div className="text-center mb-6">
              <h3 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-2">
                Possible duplicate
              </h3>
              <p className="text-base font-ibm-plex text-[#65758b] leading-6">
                We already have a similar product:
              </p>
              <p className="text-sm font-ibm-plex font-semibold text-[#0f1729] mt-1 px-3 py-1.5 bg-[#f9fafb] border border-[#e1e7ef] rounded-md break-words">
                {matchedName}
              </p>
              <p className="text-base font-ibm-plex text-[#65758b] leading-6 mt-3">
                Are you sure you want to save this product?
              </p>
            </div>

            <div className="flex gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md font-ibm-plex font-medium text-sm text-[#0f1729] hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={onSaveAnyway}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 bg-[#b455a0] rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#a04890] transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Anyway
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default DuplicateWarningModal
