'use client'

import { useState, useEffect, useRef } from 'react'
import { DrawnField } from '@/lib/types'

interface TestStep2ReviewProps {
  uploadedImage: HTMLImageElement
  croppedImageDataUrl: string | null
  examCanvasSize: [number, number]
  fields: DrawnField[]
  onNext: (resizedImageDataUrl: string) => void
}

export default function TestStep2Review({
  uploadedImage,
  croppedImageDataUrl,
  examCanvasSize,
  fields,
  onNext
}: TestStep2ReviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [showOverlay, setShowOverlay] = useState(true)
  const [resizedImage, setResizedImage] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Use cropped image if available, otherwise use uploaded image
    const imageToUse = croppedImageDataUrl || uploadedImage

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const [targetWidth, targetHeight] = examCanvasSize

    // Set canvas size to exam size
    canvas.width = targetWidth
    canvas.height = targetHeight

    // Clear canvas
    ctx.clearRect(0, 0, targetWidth, targetHeight)

    // Load and draw the image
    const loadAndDrawImage = () => {
      const img = new Image()
      img.onload = () => {
        // Draw resized image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

        // Draw field overlays
        if (showOverlay) {
          drawFieldOverlays(ctx, fields)
        }

        // Save resized image as data URL
        setResizedImage(canvas.toDataURL('image/png'))
      }

      if (typeof imageToUse === 'string') {
        img.src = imageToUse
      } else {
        img.src = imageToUse.src
      }
    }

    loadAndDrawImage()
  }, [uploadedImage, croppedImageDataUrl, examCanvasSize, fields, showOverlay])

  const drawFieldOverlays = (ctx: CanvasRenderingContext2D, fields: DrawnField[]) => {
    fields.forEach((field) => {
      const [x1, y1, x2, y2] = field.location

      // Draw rectangle
      ctx.strokeStyle = field.has_answer === 1 ? '#22c55e' : '#3b82f6'
      ctx.lineWidth = 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Draw label background
      ctx.fillStyle = field.has_answer === 1 ? '#22c55e' : '#3b82f6'
      const labelText = field.name
      ctx.font = '14px sans-serif'
      const textWidth = ctx.measureText(labelText).width
      ctx.fillRect(x1, y1 - 22, textWidth + 12, 22)

      // Draw label text
      ctx.fillStyle = '#ffffff'
      ctx.fillText(labelText, x1 + 6, y1 - 6)
    })
  }

  const handleNext = () => {
    if (resizedImage) {
      onNext(resizedImage)
    }
  }

  const fieldsArray = Object.values(fields)

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white text-center">
        ขั้นตอนที่ 2: ตรวจสอบภาพและฟิลด์
      </h2>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Canvas Preview */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">ภาพที่ปรับขนาดแล้ว</h3>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(e) => setShowOverlay(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-300">แสดงฟิลด์</span>
            </label>
          </div>

          <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
            <canvas
              ref={canvasRef}
              className="max-w-full h-auto border border-gray-700"
            />
          </div>

          <div className="mt-4 text-sm text-gray-400">
            <p>ขนาดต้นฉบับ: {uploadedImage.width} × {uploadedImage.height} px</p>
            <p>ขนาดที่ปรับ: {examCanvasSize[0]} × {examCanvasSize[1]} px</p>
          </div>
        </div>

        {/* Fields Summary */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">
            ฟิลด์ทั้งหมด ({fieldsArray.length})
          </h3>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {fieldsArray.map((field, index) => (
              <div
                key={field.id}
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
              >
                <p className="text-white font-medium text-sm">
                  {index + 1}. {field.name}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {field.type} • {field.has_answer ? 'มีเฉลย' : 'ไม่มีเฉลย'}
                </p>
              </div>
            ))}
          </div>

          <button
            onClick={handleNext}
            className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
          >
            ดำเนินการต่อ →
          </button>
        </div>
      </div>

      <div className="mt-6 bg-blue-600/20 border border-blue-600 text-blue-300 px-4 py-3 rounded-lg">
        <p className="text-sm">
          💡 ภาพได้ถูกปรับขนาดให้ตรงกับเฉลยโดยอัตโนมัติ หากฟิลด์ไม่ตรงกัน กรุณาถ่ายภาพใหม่ให้ตรงกับเฉลย
        </p>
      </div>
    </div>
  )
}
