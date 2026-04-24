import { useState, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Download, ImageOff, ZoomIn, ZoomOut } from 'lucide-react'

const ProductPreviewModal = ({ product, isOpen, onClose }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imgError, setImgError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  // Imperative style application to avoid CSP `style-src 'unsafe-inline'`.
  const viewerRef = useRef(null)
  const imgRef = useRef(null)
  useEffect(() => {
    if (viewerRef.current) {
      viewerRef.current.style.cursor = zoom > 1 ? (isDragging.current ? 'grabbing' : 'grab') : 'zoom-in'
    }
    if (imgRef.current) {
      imgRef.current.style.transform = `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`
      imgRef.current.style.transition = isDragging.current ? 'none' : 'transform 0.15s ease'
    }
  }, [zoom, pan.x, pan.y])

  useEffect(() => {
    if (isOpen) {
      setCurrentImageIndex(0)
      setImgError(false)
      setZoom(1)
      setPan({ x: 0, y: 0 })
    }
  }, [isOpen, product])

  const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const handleWheel = (e) => {
    e.preventDefault()
    setZoom(z => Math.min(5, Math.max(1, z + (e.deltaY < 0 ? 0.3 : -0.3))))
  }

  const handleMouseDown = (e) => {
    if (zoom <= 1) return
    isDragging.current = true
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e) => {
    if (!isDragging.current) return
    setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y })
  }

  const handleMouseUp = () => { isDragging.current = false }

  if (!isOpen || !product) return null

  const productImages = product.rawData?.images || product.images || []
  const hasImages = productImages.length > 0

  const handlePrevious = () => {
    setImgError(false)
    resetZoom()
    setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setImgError(false)
    resetZoom()
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
          <div className="flex items-center gap-1.5">
            {hasImages && !imgError && (
              <>
                <button
                  onClick={() => setZoom(z => Math.min(5, z + 0.5))}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f1f5f9] hover:bg-[#e1e7ef] transition-colors"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4 text-[#0f1729]" />
                </button>
                <button
                  onClick={() => { setZoom(z => Math.max(1, z - 0.5)); if (zoom <= 1.5) setPan({ x: 0, y: 0 }) }}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f1f5f9] hover:bg-[#e1e7ef] transition-colors"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4 text-[#0f1729]" />
                </button>
                {zoom > 1 && (
                  <button
                    onClick={resetZoom}
                    className="px-2 h-8 flex items-center justify-center rounded-md bg-[#f1f5f9] hover:bg-[#e1e7ef] text-xs font-ibm-plex text-[#65758b] transition-colors"
                    title="Reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className="w-8 h-8 flex items-center justify-center rounded-md bg-[#f1f5f9] hover:bg-[#e1e7ef] transition-colors"
                  title="Download image"
                >
                  <Download className="w-4 h-4 text-[#0f1729]" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors ml-1"
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

              <div
                ref={viewerRef}
                className="w-80 h-80 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {imgError ? (
                  <div className="flex flex-col items-center gap-2">
                    <ImageOff className="w-10 h-10 text-[#b455a0] opacity-30" />
                    <p className="text-xs font-ibm-plex text-[#65758b]">Image could not be loaded</p>
                  </div>
                ) : (
                  <img
                    ref={imgRef}
                    key={productImages[currentImageIndex]}
                    src={productImages[currentImageIndex]}
                    alt={`Product image ${currentImageIndex + 1}`}
                    className="max-w-full max-h-full object-contain select-none"
                    draggable={false}
                    onClick={() => { if (zoom === 1) setZoom(2); else resetZoom() }}
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
