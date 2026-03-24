'use client'

import { useState, useRef } from 'react'

interface TestStep1UploadProps {
  onImageLoad: (image: HTMLImageElement, file: File, croppedDataUrl?: string) => void
}

export default function TestStep1Upload({ onImageLoad }: TestStep1UploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoCropEnabled, setAutoCropEnabled] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const cropImage = async (imageDataUrl: string): Promise<string> => {
    try {
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

      return result.croppedImage || imageDataUrl
    } catch (error) {
      // Silent fail - return original image
      console.log('Auto-crop error:', error)
      return imageDataUrl
    }
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    setError(null)
    setIsProcessing(true)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const originalDataUrl = e.target?.result as string
      let croppedDataUrl: string | undefined = undefined

      if (autoCropEnabled) {
        croppedDataUrl = await cropImage(originalDataUrl)
      }

      const img = new Image()
      img.onload = () => {
        setIsProcessing(false)
        onImageLoad(img, file, croppedDataUrl)
      }
      img.onerror = () => {
        setIsProcessing(false)
        setError('ไม่สามารถโหลดรูปภาพได้')
      }
      // Always use original image for Image object, cropped version is passed separately
      img.src = originalDataUrl
    }
    reader.onerror = () => {
      setIsProcessing(false)
      setError('เกิดข้อผิดพลาดในการอ่านไฟล์')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">
          ขั้นตอนที่ 1: อัปโหลดกระดาษคำตอบ
        </h2>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoCropEnabled}
            onChange={(e) => setAutoCropEnabled(e.target.checked)}
            className="w-4 h-4"
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
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 bg-gray-800 hover:border-gray-500 hover:bg-gray-800/80'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-4">
          <svg
            className="w-16 h-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <div>
            <p className="text-lg font-medium text-white mb-2">
              คลิกหรือลากไฟล์มาวางที่นี่
            </p>
            <p className="text-sm text-gray-400">
              รองรับไฟล์: JPG, PNG, JPEG
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
