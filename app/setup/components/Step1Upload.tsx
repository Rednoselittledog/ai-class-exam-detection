'use client'

import { useCallback, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'

interface Step1UploadProps {
  onImageLoad: (image: HTMLImageElement, file: File, croppedDataUrl?: string) => void
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export default function Step1Upload({ onImageLoad }: Step1UploadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [autoCropEnabled, setAutoCropEnabled] = useState(true)
  const [hasImage, setHasImage] = useState(false)

  const cropImage = useCallback(async (imageDataUrl: string): Promise<string> => {
    try {
      setIsProcessing(true)
      const response = await fetch('/api/crop-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageDataUrl }),
      })

      const result = await response.json()

      if (!result.success) {
        // Log error but return original image instead of throwing
        console.log('Crop failed:', result.error || 'Failed to crop image')
        return imageDataUrl
      }

      // Python script returns cropped image directly
      return result.croppedImage || imageDataUrl
    } catch (error) {
      // Silent fail - return original image
      console.log('Auto-crop error:', error)
      return imageDataUrl
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null)

    // Check for rejected files
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 10MB)')
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('ประเภทไฟล์ไม่ถูกต้อง (รองรับเฉพาะ JPG และ PNG)')
      } else {
        setError('ไม่สามารถอัปโหลดไฟล์ได้')
      }
      return
    }

    const file = acceptedFiles[0]
    if (!file) return

    // Additional file size check
    if (file.size > MAX_FILE_SIZE) {
      setError(`ไฟล์มีขนาดใหญ่เกินไป (${(file.size / 1024 / 1024).toFixed(2)}MB / สูงสุด 10MB)`)
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const originalDataUrl = e.target?.result as string
      let imageDataUrl = originalDataUrl
      let croppedDataUrl: string | undefined = undefined

      // Auto-crop if enabled
      if (autoCropEnabled) {
        setIsProcessing(true)
        imageDataUrl = await cropImage(originalDataUrl)
        croppedDataUrl = imageDataUrl  // Save cropped version
      }

      const img = new Image()
      img.onload = () => {
        console.log('Image loaded successfully:', { width: img.width, height: img.height })
        const canvas = canvasRef.current
        if (!canvas) {
          console.error('Canvas ref is null!')
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        console.log('Canvas size set:', { width: canvas.width, height: canvas.height })

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0)
          console.log('Image drawn to canvas')
        }

        setHasImage(true)
        setIsProcessing(false)
        console.log('Calling onImageLoad...')
        onImageLoad(img, file, croppedDataUrl)
      }
      img.onerror = () => {
        setIsProcessing(false)
        setError('ไม่สามารถโหลดรูปภาพได้ กรุณาลองใหม่')
      }
      img.src = imageDataUrl
    }
    reader.onerror = () => {
      setError('เกิดข้อผิดพลาดในการอ่านไฟล์')
    }
    reader.readAsDataURL(file)
  }, [onImageLoad, autoCropEnabled, cropImage])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    multiple: false,
    maxSize: MAX_FILE_SIZE
  })

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">ขั้นตอนที่ 1: อัปโหลดรูปภาพข้อสอบ</h2>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCropEnabled}
            onChange={(e) => setAutoCropEnabled(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-sm text-gray-300">ครอบและจัดหน้าอัตโนมัติ</span>
        </label>
      </div>

      {isProcessing && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-blue-400 font-medium">กำลังประมวลผลรูปภาพ...</p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-red-400 font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 bg-gray-800 hover:border-gray-500'
        }`}
      >
        <input {...getInputProps()} />
        <div className="text-gray-300">
          {isDragActive ? (
            <p className="text-xl">วางไฟล์ที่นี่...</p>
          ) : (
            <>
              <p className="text-xl mb-2">ลากและวางไฟล์รูปภาพที่นี่</p>
              <p className="text-sm text-gray-400">หรือคลิกเพื่อเลือกไฟล์</p>
              <p className="text-xs text-gray-500 mt-2">รองรับไฟล์: JPG, PNG (ขนาดสูงสุด 10MB)</p>
            </>
          )}
        </div>
      </div>

      <div className="mt-6" style={{ display: hasImage ? 'block' : 'none' }}>
        <canvas
          ref={canvasRef}
          className="border border-gray-700 rounded-lg max-w-full h-auto bg-gray-900"
        />
      </div>
    </div>
  )
}
