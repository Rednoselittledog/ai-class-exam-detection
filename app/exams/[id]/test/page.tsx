'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Exam, AnswerKeyValue } from '@/lib/types'
import TestStep1Upload from './components/TestStep1Upload'
import TestStep2Review from './components/TestStep2Review'
import TestStep3Grade from './components/TestStep3Grade'

export default function TestPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [currentStep, setCurrentStep] = useState(1)
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Step 1 state
  const [uploadedImage, setUploadedImage] = useState<HTMLImageElement | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [croppedImageDataUrl, setCroppedImageDataUrl] = useState<string | null>(null)

  // Step 2 state
  const [resizedImageDataUrl, setResizedImageDataUrl] = useState<string | null>(null)

  // Edit mode state
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null)
  const [editingSubmission, setEditingSubmission] = useState<any>(null)

  useEffect(() => {
    fetchExam()

    // Check for edit query parameter
    const urlParams = new URLSearchParams(window.location.search)
    const editId = urlParams.get('edit')
    if (editId) {
      setEditingSubmissionId(editId)
      fetchSubmissionForEdit(editId)
    }
  }, [examId])

  const fetchExam = async () => {
    try {
      const response = await fetch(`/api/exams/${examId}`)
      if (!response.ok) throw new Error('Failed to fetch exam')
      const { data } = await response.json()
      setExam(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchSubmissionForEdit = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions?exam_id=${examId}`)
      if (!response.ok) throw new Error('Failed to fetch submissions')
      const { data } = await response.json()
      const submission = data.find((s: any) => s.id === submissionId)

      if (submission) {
        setEditingSubmission(submission)

        // Load the image and skip to step 3
        const img = new Image()
        img.onload = () => {
          setUploadedImage(img)
          setResizedImageDataUrl(submission.image_url)
          setCurrentStep(3) // Go directly to grading step
        }
        img.src = submission.image_url
      }
    } catch (err) {
      console.error('Error fetching submission for edit:', err)
      setError('ไม่สามารถโหลดข้อมูลสำหรับแก้ไขได้')
    }
  }

  const handleImageLoad = (image: HTMLImageElement, file: File, croppedDataUrl?: string) => {
    setUploadedImage(image)
    setImageFile(file)
    setCroppedImageDataUrl(croppedDataUrl || null)
    setCurrentStep(2)
  }

  const handleStep2Next = (resizedDataUrl: string) => {
    setResizedImageDataUrl(resizedDataUrl)
    setCurrentStep(3)
  }

  const handleSave = async (
    detectedAnswers: Record<string, AnswerKeyValue>,
    score: number,
    total: number,
    imageUrl: string
  ) => {
    // Update mode if editing existing submission
    if (editingSubmissionId) {
      const response = await fetch(`/api/submissions/${editingSubmissionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          field_values: detectedAnswers,
          score,
          total
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update submission')
      }

      return response.json()
    }

    // Create mode (new submission)
    const response = await fetch('/api/submissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        exam_id: examId,
        image_url: imageUrl,
        field_values: detectedAnswers,
        score,
        total
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to save submission')
    }

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

  const fieldsArray = Object.entries(exam.fields).map(([id, field]) => ({
    id,
    ...field
  }))

  console.log('Fields from exam:', fieldsArray)

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Link
            href={`/exams/${examId}`}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            ← กลับ
          </Link>
          <h1 className="text-xl font-bold text-white">{exam.name}</h1>
          <div className="w-20"></div> {/* Spacer for centering */}
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
            <TestStep1Upload onImageLoad={handleImageLoad} />
          )}

          {currentStep === 2 && uploadedImage && (
            <TestStep2Review
              uploadedImage={uploadedImage}
              croppedImageDataUrl={croppedImageDataUrl}
              examCanvasSize={exam.canvas_size}
              fields={fieldsArray}
              onNext={handleStep2Next}
            />
          )}

          {currentStep === 3 && resizedImageDataUrl && (
            <TestStep3Grade
              examId={examId}
              examName={exam.name}
              resizedImageDataUrl={resizedImageDataUrl}
              fields={fieldsArray}
              answerKey={exam.answer_key}
              onSave={handleSave}
              initialAnswers={editingSubmission?.field_values}
              isEditMode={!!editingSubmissionId}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        {currentStep > 1 && currentStep < 3 && (
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              ← ย้อนกลับ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
