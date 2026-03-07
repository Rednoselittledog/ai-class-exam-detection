'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { DrawnField, Exam } from '@/lib/types'
import Step2Annotate from '../../components/Step2Annotate'
import Step3ReviewNew from '../../components/Step3ReviewNew'

export default function EditExamPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [currentStep, setCurrentStep] = useState(2) // Start at step 2 (annotate)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Exam data
  const [exam, setExam] = useState<Exam | null>(null)
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [croppedImageDataUrl, setCroppedImageDataUrl] = useState<string | null>(null)
  const [canvasSize, setCanvasSize] = useState<[number, number]>([0, 0])
  const [fields, setFields] = useState<DrawnField[]>([])
  const [examName, setExamName] = useState('')
  const [existingAnswerKey, setExistingAnswerKey] = useState<Record<string, any>>({})

  useEffect(() => {
    fetchExam()
  }, [examId])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/exams/${examId}`)
      if (!response.ok) throw new Error('Failed to fetch exam')

      const { data } = await response.json()
      setExam(data)
      setExamName(data.name)
      setCanvasSize(data.canvas_size)
      setCroppedImageDataUrl(data.image_url)
      setExistingAnswerKey(data.answer_key || {})

      // Convert fields object to DrawnField array
      const fieldsArray: DrawnField[] = Object.entries(data.fields).map(([id, field]: [string, any]) => ({
        id,
        type: field.type,
        name: field.name,
        rotate: field.rotate,
        location: field.location,
        has_answer: field.has_answer
      }))
      setFields(fieldsArray)

      // Load image
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        setUploadedImage(img)
        setLoading(false)
      }
      img.onerror = () => {
        setError('ไม่สามารถโหลดรูปภาพได้')
        setLoading(false)
      }
      img.src = data.image_url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        setUploadedImage(img)
        setImageFile(file)
        setCroppedImageDataUrl(null) // Will need to upload new image
        setCanvasSize([img.width, img.height])

        // Reset fields to match new image dimensions
        setFields([])
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleUpdateExam = async (answerKey: Record<string, any>) => {
    if (!exam) throw new Error('No exam data')

    let imageUrl = exam.image_url

    // If new image was uploaded, upload it first
    if (imageFile && !croppedImageDataUrl) {
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('fileName', `exam-${Date.now()}.${imageFile.name.split('.').pop()}`)

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload new image')
      }

      const uploadResult = await uploadResponse.json()
      imageUrl = uploadResult.publicUrl
    }

    // Prepare fields in the correct format
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
      answer_key: answerKey,
      image_url: imageUrl
    }

    const response = await fetch(`/api/exams/${examId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(examData)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update exam')
    }

    // Redirect to exam detail page
    router.push(`/exams/${examId}`)

    return response.json()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    )
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">เกิดข้อผิดพลาด: {error || 'ไม่พบข้อสอบ'}</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            ✏️ แก้ไขข้อสอบ
          </h1>
          <p className="text-gray-400">
            {examName || 'กำลังโหลด...'}
          </p>
        </div>

        {/* Edit Mode Banner */}
        <div className="mb-6 bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-4 max-w-4xl mx-auto">
          <p className="text-yellow-300 text-sm text-center">
            ⚠️ <strong>โหมดแก้ไข:</strong> คุณกำลังแก้ไขข้อสอบที่บันทึกไว้แล้ว การเปลี่ยนแปลงจะถูกบันทึกทับข้อมูลเดิม
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center mb-12">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-gray-700 text-gray-400">
                1
              </div>
              <div className="w-16 h-1 mx-2 bg-gray-700" />
            </div>
            {[2, 3].map((step) => (
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
          {currentStep === 2 && uploadedImage && (
            <>
              {/* Image Upload Section */}
              <div className="mb-6 bg-gray-800 rounded-lg p-6 border border-gray-700 max-w-4xl mx-auto">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">รูปภาพข้อสอบ</h3>
                    <p className="text-sm text-gray-400">อัพโหลดรูปใหม่หากต้องการเปลี่ยนแปลง</p>
                  </div>
                  <label className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors cursor-pointer font-medium">
                    📤 อัพโหลดรูปใหม่
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <Step2Annotate
                image={uploadedImage}
                fields={fields}
                onFieldsChange={setFields}
              />
            </>
          )}

          {currentStep === 3 && (
            <Step3ReviewNew
              examName={examName}
              onExamNameChange={setExamName}
              canvasSize={canvasSize}
              fields={fields}
              imageFile={imageFile}
              croppedImageDataUrl={croppedImageDataUrl}
              onSave={handleUpdateExam}
              isEditMode={true}
              initialAnswerKey={existingAnswerKey}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-center gap-4">
          {currentStep === 2 && (
            <>
              <Link
                href={`/exams/${examId}`}
                className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                ← ยกเลิก
              </Link>
              <button
                onClick={() => setCurrentStep(3)}
                disabled={fields.length === 0}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ถัดไป →
              </button>
            </>
          )}

          {currentStep === 3 && (
            <button
              onClick={() => setCurrentStep(2)}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              ← ย้อนกลับ
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
