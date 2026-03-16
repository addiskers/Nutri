import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ImageOff } from 'lucide-react'

const ProductPreviewModal = ({ product, isOpen, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0)
      setImgError(false)
    }
  }, [isOpen, product])

  if (!isOpen || !product) return null

  const productImages = product.rawData?.images || product.images || []
  const hasImages = productImages.length > 0

  const handlePrevious = () => {
    setImgError(false)
    setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setImgError(false)
    setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))
  }

  const handleDownload = async () => {
    if (!hasImages || imgError) return
    const url = productImages[currentImageIndex]
    const filename = `${product.productName || 'product'}-image-${currentImageIndex + 1}.jpg`
      .replace(/[/\\?%*:|"<>]/g, '-')

    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = url
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)

      canvas.toBlob((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = blobUrl
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(blobUrl)
      }, 'image/jpeg', 0.92)
    } catch {
      // Fallback: direct download if CORS blocks canvas
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/80 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 z-50 w-full max-w-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e1e7ef]">
          <div>
            <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
              Product Preview
            </h3>
            {product.productName && (
              <p className="text-sm font-ibm-plex text-[#65758b] mt-0.5 truncate max-w-sm">
                {product.productName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasImages && !imgError && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 h-8 bg-[#f1f5f9] hover:bg-[#e1e7ef] text-[#0f1729] rounded-md text-sm font-ibm-plex transition-colors"
                title="Download current image"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-[#0f1729]" />
            </button>
          </div>
        </div>

        {/* Image Viewer */}
        {!hasImages ? (
          /* No images state */
          <div className="flex flex-col items-center justify-center h-64 gap-3 bg-gray-50 rounded-lg">
            <ImageOff className="w-12 h-12 text-[#b455a0] opacity-30" />
            <p className="text-sm font-ibm-plex text-[#65758b]">No images available for this product</p>
          </div>
        ) : (
          <>
            {/* Main image with navigation */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <button
                onClick={handlePrevious}
                disabled={productImages.length <= 1}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="w-6 h-6 text-[#65758b]" />
              </button>

              <div className="w-80 h-80 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                {imgError ? (
                  <div className="flex flex-col items-center gap-2">
                    <ImageOff className="w-10 h-10 text-[#b455a0] opacity-30" />
                    <p className="text-xs font-ibm-plex text-[#65758b]">Image could not be loaded</p>
                  </div>
                ) : (
                  <img
                    key={productImages[currentImageIndex]}
                    src={productImages[currentImageIndex]}
                    alt={`Product image ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                    onError={() => setImgError(true)}
                  />
                )}
              </div>

              <button
                onClick={handleNext}
                disabled={productImages.length <= 1}
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors disabled:opacity-30"
              >
                <ChevronRight className="w-6 h-6 text-[#65758b]" />
              </button>
            </div>

            {/* Thumbnails */}
            {productImages.length > 1 && (
              <div className="overflow-x-auto scrollbar-hide mb-3">
                <div className="flex items-center justify-center gap-2 px-4">
                  {productImages.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => { setImgError(false); setCurrentImageIndex(index) }}
                      className={`w-14 h-14 rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                        currentImageIndex === index
                          ? 'border-[#b455a0] opacity-100 ring-2 ring-[#b455a0]/20'
                          : 'border-[#e1e7ef] opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img src={image} alt={`Thumbnail ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Counter + download hint */}
            <div className="flex items-center justify-center gap-4">
              <span className="text-sm font-ibm-plex text-[#65758b]">
                {currentImageIndex + 1} / {productImages.length}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default ProductPreviewModal
