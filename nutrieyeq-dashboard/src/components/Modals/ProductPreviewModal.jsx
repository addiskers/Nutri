import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

const ProductPreviewModal = ({ product, isOpen, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Reset image index when modal opens or product changes
  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0)
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  // Get images from product.rawData if available, otherwise use mock images
  const mockImages = [
    'https://via.placeholder.com/400x400/f59e0b/ffffff?text=No+Image+Available'
  ]

  // Try to get images from rawData first, then from product.images, then use mock
  const productImages = product.rawData?.images || product.images || []
  const images = productImages.length > 0 ? productImages : mockImages

  // Debug logging
  console.log('ProductPreviewModal - Product:', product.productName)
  console.log('ProductPreviewModal - Raw product object:', product)
  console.log('ProductPreviewModal - rawData:', product.rawData)
  console.log('ProductPreviewModal - Images from rawData:', product.rawData?.images)
  console.log('ProductPreviewModal - Images array length:', product.rawData?.images?.length || 0)
  console.log('ProductPreviewModal - Total images to display:', images.length)
  console.log('ProductPreviewModal - Images array:', images)

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  const handleThumbnailClick = (index) => {
    setCurrentImageIndex(index)
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/80 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e1e7ef]">
          <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
            Product Preview
          </h3>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors opacity-70"
          >
            <X className="w-5 h-5 text-[#0f1729]" />
          </button>
        </div>

        {/* Main Image with Navigation */}
        <div className="flex items-center justify-center gap-6 mb-4">
          <button
            onClick={handlePrevious}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            disabled={images.length <= 1}
          >
            <ChevronLeft className="w-6 h-6 text-[#65758b]" />
          </button>

          <div className="w-80 h-80 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
            <img
              src={images[currentImageIndex]}
              alt={`Product image ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          <button
            onClick={handleNext}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
            disabled={images.length <= 1}
          >
            <ChevronRight className="w-6 h-6 text-[#65758b]" />
          </button>
        </div>

        {/* Thumbnails - Scrollable for more than 8 images */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex items-center justify-center gap-2 min-w-full px-4">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => handleThumbnailClick(index)}
                className={`w-16 h-16 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                  currentImageIndex === index
                    ? 'border-primary opacity-100 ring-2 ring-primary/20'
                    : 'border-[#e1e7ef] opacity-60 hover:opacity-100 hover:border-primary/50'
                }`}
              >
                <img
                  src={image}
                  alt={`Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>

        {/* Image Counter */}
        <div className="text-center mt-2">
          <span className="text-sm font-ibm-plex text-[#65758b]">
            {currentImageIndex + 1} / {images.length}
          </span>
        </div>
      </div>
    </>
  )
}

export default ProductPreviewModal


