import { useState, useRef } from 'react'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Upload, X, Crop } from 'lucide-react'

const ImageUploadWithCrop = ({ label, onImageCropped, onRemove }) => {
  const [imageSrc, setImageSrc] = useState(null)
  const [crop, setCrop] = useState({
    unit: '%',
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  })
  const [completedCrop, setCompletedCrop] = useState(null)
  const [croppedImage, setCroppedImage] = useState(null)
  const [showCropper, setShowCropper] = useState(false)
  const imgRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setImageSrc(reader.result)
        setShowCropper(true)
      })
      reader.readAsDataURL(file)
    }
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleCropSave = () => {
    const image = imgRef.current
    if (!image) return

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    // Use completedCrop if available, otherwise use full image
    const cropArea = completedCrop && completedCrop.width > 0 && completedCrop.height > 0
      ? completedCrop
      : { x: 0, y: 0, width: image.width, height: image.height }

    const canvas = document.createElement('canvas')
    canvas.width = cropArea.width * scaleX
    canvas.height = cropArea.height * scaleY
    const ctx = canvas.getContext('2d')

    ctx.drawImage(
      image,
      cropArea.x * scaleX,
      cropArea.y * scaleY,
      cropArea.width * scaleX,
      cropArea.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    )

    const croppedDataUrl = canvas.toDataURL('image/jpeg')
    setCroppedImage(croppedDataUrl)
    setShowCropper(false)
    
    if (onImageCropped) {
      onImageCropped(croppedDataUrl, cropArea)
    }
  }

  const handleRemoveImage = () => {
    setImageSrc(null)
    setCroppedImage(null)
    setShowCropper(false)
    setCrop({
      unit: '%',
      x: 5,
      y: 5,
      width: 90,
      height: 90,
    })
    if (onRemove) {
      onRemove()
    }
  }

  return (
    <div className="relative">
      {!croppedImage ? (
        <label className="aspect-square border-2 border-dashed border-[#e1e7ef] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          <Upload className="w-6 h-6 text-[#65758b] mb-2" />
          <span className="text-xs font-ibm-plex text-[#65758b]">{label}</span>
        </label>
      ) : (
        <div className="aspect-square border-2 border-[#e1e7ef] rounded-lg overflow-hidden relative group">
          <img 
            src={croppedImage} 
            alt={label} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              onClick={() => setShowCropper(true)}
              className="p-2 bg-white rounded-md hover:bg-gray-100"
              title="Crop Image"
            >
              <Crop className="w-4 h-4 text-[#0f1729]" />
            </button>
            <button
              onClick={handleRemoveImage}
              className="p-2 bg-white rounded-md hover:bg-gray-100"
              title="Remove Image"
            >
              <X className="w-4 h-4 text-[#0f1729]" />
            </button>
          </div>
        </div>
      )}

      {/* Cropper Modal */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full flex flex-col max-h-[92vh]">

            {/* Header – never scrolls away */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-lg font-ibm-plex font-semibold text-[#0f1729]">
                Crop Image – {label}
              </h3>
              <button
                onClick={() => { setShowCropper(false); if (!croppedImage) setImageSrc(null) }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image crop area — no scroll so mouse events reach ReactCrop uninterrupted */}
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center flex-1 min-h-0 overflow-hidden">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                className="max-w-full max-h-full"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  className="object-contain block select-none"
                  onLoad={(e) => {
                    const el = e.currentTarget
                    imgRef.current = el
                    // Imperative sizing avoids CSP style-src block and works regardless of
                    // ReactCrop wrapper's lack of a definite height.
                    el.style.maxWidth = '100%'
                    el.style.maxHeight = 'calc(92vh - 240px)'
                    const { width, height } = el
                    setCrop({ unit: '%', width: 90, height: 90, x: 5, y: 5 })
                    setCompletedCrop({
                      x: Math.round(width * 0.05),
                      y: Math.round(height * 0.05),
                      width: Math.round(width * 0.9),
                      height: Math.round(height * 0.9),
                      unit: 'px'
                    })
                  }}
                />
              </ReactCrop>
            </div>

            {/* Footer – never scrolls away */}
            <div className="flex-shrink-0 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                <p className="text-xs font-ibm-plex text-blue-800">
                  <strong>Drag corners/edges</strong> to resize · Drag inside the selection to reposition it
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setShowCropper(false); if (!croppedImage) setImageSrc(null) }}
                  className="px-4 py-2 border border-[#e1e7ef] rounded-md text-sm font-ibm-plex text-[#65758b] hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCropSave}
                  className="px-4 py-2 bg-primary text-white rounded-md text-sm font-ibm-plex hover:bg-[#a04890]"
                >
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageUploadWithCrop
