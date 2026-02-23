import { X, Trash2 } from 'lucide-react'

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemName = 'item' }) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/80 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 w-full max-w-md">
        <div className="flex flex-col items-end">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors opacity-70 mb-4"
          >
            <X className="w-5 h-5 text-[#0f1729]" />
          </button>

          {/* Content */}
          <div className="flex flex-col items-center justify-center w-full">
            {/* Red Trash Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
              <Trash2 className="w-8 h-8 text-[#e01c48]" />
            </div>

            {/* Text */}
            <div className="text-center mb-6">
              <h3 className="text-2xl font-ibm-plex font-bold text-[#0f1729] mb-2">
                Are you sure?
              </h3>
              <p className="text-base font-ibm-plex text-[#65758b] leading-6">
                This action cannot be undone. All values associated with this field will be lost.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 w-full">
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 bg-[#f9fafb] border border-[#e1e7ef] rounded-md font-ibm-plex font-medium text-sm text-[#0f1729] hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 h-10 px-4 py-2 bg-[#e01c48] rounded-md font-ibm-plex font-medium text-sm text-white hover:bg-[#c01840] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default DeleteConfirmModal









