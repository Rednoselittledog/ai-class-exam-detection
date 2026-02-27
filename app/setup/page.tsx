'use client'

import { useState } from 'react'
import { DrawnField } from '@/lib/types'
import Step1Upload from './components/Step1Upload'
import Step2Annotate from './components/Step2Annotate'
import Step3Review from './components/Step3Review'

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [canvasSize, setCanvasSize] = useState<[number, number]>([0, 0])
  const [fields, setFields] = useState<DrawnField[]>([])
  const [examName, setExamName] = useState('')

  const handleImageLoad = (image: HTMLImageElement, file: File) => {
    setUploadedImage(image)
    setImageFile(file)
    setCanvasSize([image.width, image.height])
    setCurrentStep(2)
  }

  const handleSaveToSupabase = async () => {
    if (!imageFile) {
      throw new Error('No image file selected')
    }

    // Upload image to Supabase Storage
    const fileExt = imageFile.name.split('.').pop()
    // Use timestamp only to avoid non-ASCII characters in filename
    const fileName = `exam-${Date.now()}.${fileExt}`

    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('fileName', fileName)

    const uploadResponse = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload image')
    }

    const uploadResult = await uploadResponse.json()
    console.log('Upload result:', uploadResult)
    const { publicUrl } = uploadResult

    // Save exam data with image URL
    console.log('Saving with image_url:', publicUrl)
    const fieldsJson: Record<string, any> = {}
    fields.forEach(field => {
      fieldsJson[field.id] = {
        type: field.type,
        name: field.name,
        rotate: field.rotate,
        location: field.location,
        has_answer: field.has_answer
      }
    })

    const examData = {
      name: examName,
      canvas_size: canvasSize,
      fields: fieldsJson,
      answer_key: {},
      image_url: publicUrl
    }

    console.log('Sending exam data:', examData)

    const response = await fetch('/api/exams', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(examData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save exam')
    }

    return response.json()
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            ตั้งค่าข้อสอบ OMR
          </h1>
          <p className="text-gray-400">
            อัปโหลด กำหนดฟิลด์ และบันทึกข้อมูลข้อสอบ
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                    currentStep === step
                      ? 'bg-blue-600 text-white'
                      : currentStep > step
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`w-16 h-1 mx-2 transition-colors ${
                      currentStep > step ? 'bg-green-600' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-8">
          {currentStep === 1 && (
            <Step1Upload onImageLoad={handleImageLoad} />
          )}

          {currentStep === 2 && uploadedImage && (
            <Step2Annotate
              image={uploadedImage}
              fields={fields}
              onFieldsChange={setFields}
            />
          )}

          {currentStep === 3 && (
            <Step3Review
              examName={examName}
              onExamNameChange={setExamName}
              canvasSize={canvasSize}
              fields={fields}
              onSave={handleSaveToSupabase}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              ← ย้อนกลับ
            </button>
          )}

          {currentStep === 2 && (
            <button
              onClick={() => setCurrentStep(3)}
              disabled={fields.length === 0}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium"
            >
              ถัดไป →
            </button>
          )}
        </div>

        {currentStep === 2 && fields.length === 0 && (
          <p className="text-yellow-500 text-sm text-center mt-4">
            กรุณาเพิ่มฟิลด์อย่างน้อย 1 ฟิลด์เพื่อดำเนินการต่อ
          </p>
        )}
      </div>
    </div>
  )
}
