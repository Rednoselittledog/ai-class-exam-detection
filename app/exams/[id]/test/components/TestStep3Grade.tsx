'use client'

import { useState } from 'react'
import Link from 'next/link'
import { DrawnField, AnswerKeyValue } from '@/lib/types'

interface TestStep3GradeProps {
  examId: string
  examName: string
  resizedImageDataUrl: string
  fields: DrawnField[]
  answerKey: Record<string, AnswerKeyValue>
  onSave: (detectedAnswers: Record<string, AnswerKeyValue>, score: number, total: number, imageUrl: string) => Promise<void>
  initialAnswers?: Record<string, AnswerKeyValue>
  isEditMode?: boolean
}

export default function TestStep3Grade({
  examId,
  examName,
  resizedImageDataUrl,
  fields,
  answerKey,
  onSave,
  initialAnswers = {},
  isEditMode = false
}: TestStep3GradeProps) {
  const [isDetecting, setIsDetecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [detectedAnswers, setDetectedAnswers] = useState<Record<string, AnswerKeyValue>>(initialAnswers)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [annotatedImages, setAnnotatedImages] = useState<Record<string, string>>({})
  const [detectionInfo, setDetectionInfo] = useState<Record<string, any>>({})
  const [selectedField, setSelectedField] = useState<string | null>(null)

  // Auto-detect answers
  const handleAutoDetect = async () => {
    setIsDetecting(true)
    setErrorMessage('')

    try {
      console.log('Starting auto-detect with resizedImageDataUrl:', resizedImageDataUrl ? 'exists' : 'null')

      if (!resizedImageDataUrl) {
        throw new Error('ไม่พบรูปภาพสำหรับการตรวจจับ')
      }

      const newDetectedAnswers: Record<string, AnswerKeyValue> = { ...detectedAnswers }
      const newAnnotatedImages: Record<string, string> = {}
      const newDetectionInfo: Record<string, any> = {}

      // Process ALL fields (including has_answer=0 for data fields like student name)
      for (const field of fields) {
        console.log(`Processing field: ${field.name} (type: ${field.type}, has_answer: ${field.has_answer})`)

        // Crop field from resized image
        const croppedFieldImage = await cropFieldFromImage(resizedImageDataUrl, field)
        console.log(`Cropped field image for ${field.name}:`, croppedFieldImage ? 'success' : 'failed')

        if (field.type === 'ฝน') {
          // Use OMR detection
          console.log(`Sending OMR detection request for ${field.name}`)
          const response = await fetch('/api/detect-omr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: croppedFieldImage })
          })
          const result = await response.json()
          console.log(`OMR detection result for ${field.name}:`, result)

          if (result.success && result.answers) {
            newDetectedAnswers[field.id] = result.answers // Array

            // Store annotated image and detection info
            if (result.annotated_image) {
              newAnnotatedImages[field.id] = result.annotated_image
            }
            newDetectionInfo[field.id] = {
              detections: result.detections || [],
              total_detected: result.total_detected || 0
            }
          } else {
            console.error(`OMR detection failed for ${field.name}:`, result.error || 'Unknown error')
          }
        } else if (field.type === 'ข้อเขียน') {
          // Use OCR detection for data fields (including has_answer=0)
          console.log(`Sending OCR detection request for ${field.name} (has_answer: ${field.has_answer})`)
          const response = await fetch('/api/detect-ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: croppedFieldImage })
          })
          const result = await response.json()
          console.log(`📝 OCR detection result for ${field.name}:`, result)
          console.log(`📝 Detected text: "${result.text || 'N/A'}"`)

          if (result.success && result.text) {
            newDetectedAnswers[field.id] = result.text.trim() // String - store for ALL fields
            console.log(`✅ Stored OCR result for ${field.name}: "${result.text.trim()}"`)
          } else {
            console.error(`❌ OCR detection failed for ${field.name}:`, result.error || 'Unknown error')
          }
        }
      }

      setDetectedAnswers(newDetectedAnswers)
      setAnnotatedImages(newAnnotatedImages)
      setDetectionInfo(newDetectionInfo)
    } catch (error) {
      console.error('Auto-detect error:', error)
      setErrorMessage(`เกิดข้อผิดพลาดในการตรวจจับคำตอบ: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDetecting(false)
    }
  }

  // Helper: Crop field area from image
  const cropFieldFromImage = async (
    imageBase64: string,
    field: DrawnField
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const [x1, y1, x2, y2] = field.location
        const width = x2 - x1
        const height = y2 - y1

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!

        // Draw cropped region
        ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height)

        resolve(canvas.toDataURL('image/png'))
      }
      img.src = imageBase64
    })
  }

  // Handle manual answer edit
  const handleAnswerEdit = (fieldId: string, value: string) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    if (field.type === 'ฝน') {
      // Parse comma-separated values for OMR
      const answers = value.split(',').map(a => a.trim()).filter(Boolean)
      setDetectedAnswers({ ...detectedAnswers, [fieldId]: answers })
    } else {
      setDetectedAnswers({ ...detectedAnswers, [fieldId]: value })
    }
  }

  // Calculate score
  const calculateScore = () => {
    let correct = 0
    let total = 0

    fields.forEach(field => {
      if (field.has_answer !== 1 || field.type !== 'ฝน') return

      const correctAnswer = answerKey[field.id]
      const studentAnswer = detectedAnswers[field.id]

      if (!Array.isArray(correctAnswer) || !Array.isArray(studentAnswer)) return

      // Count questions in this field
      const questionCount = correctAnswer.length
      total += questionCount

      // Compare answers
      for (let i = 0; i < questionCount; i++) {
        if (correctAnswer[i] === studentAnswer[i]) {
          correct++
        }
      }
    })

    return { score: correct, total }
  }

  const { score, total } = calculateScore()

  // Handle save submission
  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      // Convert resized image data URL to File
      const base64Data = resizedImageDataUrl.split(',')[1]
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/png' })
      const file = new File([blob], `submission-${Date.now()}.png`, { type: 'image/png' })

      // Upload image
      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', file.name)

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload image')
      }

      const { publicUrl } = await uploadResponse.json()

      // Save submission
      await onSave(detectedAnswers, score, total, publicUrl)
      setSaveStatus('success')
    } catch (error) {
      console.error('Save error:', error)
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  const fieldsWithAnswer = fields.filter(f => f.has_answer === 1)
  const dataFields = fields.filter(f => f.has_answer === 0)  // ช่องข้อมูล

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white text-center">
        ขั้นตอนที่ 3: ตรวจจับคำตอบและให้คะแนน
      </h2>

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="mb-6 bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-4">
          <p className="text-yellow-300 text-sm font-semibold">
            ✏️ <strong>โหมดแก้ไข:</strong> คุณกำลังแก้ไขผลการตรวจที่บันทึกไว้แล้ว
          </p>
        </div>
      )}

      {/* Image Preview */}
      {resizedImageDataUrl && (
        <div className="mb-6 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-white">รูปภาพกระดาษคำตอบ</h3>
          <img
            src={resizedImageDataUrl}
            alt="Student answer sheet"
            className="w-full max-w-2xl mx-auto rounded-lg border border-gray-600"
          />
        </div>
      )}

      {/* Hint Banner */}
      {Object.keys(annotatedImages).length === 0 && (
        <div className="mb-6 bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            💡 <strong>วิธีดู Bounding Box:</strong>
          </p>
          <ol className="text-blue-300 text-sm mt-2 ml-4 space-y-1 list-decimal">
            <li>กดปุ่ม "🤖 ตรวจจับคำตอบด้วย AI" ด้านล่าง</li>
            <li>หลังจากตรวจจับเสร็จ ให้กดปุ่ม "ดูรายละเอียด" ที่แต่ละฟิลด์</li>
            <li>จะเห็นรูปภาพพร้อม Bounding Box สีต่างๆ (น้ำเงิน=a, เขียว=b, เหลือง=c, แดง=d, ม่วง=double, เทา=null)</li>
          </ol>
        </div>
      )}

      {Object.keys(annotatedImages).length > 0 && (
        <div className="mb-6 bg-green-600/20 border border-green-600/50 rounded-lg p-4">
          <p className="text-green-300 text-sm">
            ✅ <strong>ตรวจจับสำเร็จ!</strong> กด "ดูรายละเอียด" ที่แต่ละฟิลด์เพื่อดู Bounding Box
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Detection */}
        <div className="space-y-6">
          {/* Auto-detect button */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-white">
              ตรวจจับอัตโนมัติ ({fields.length} ฟิลด์ทั้งหมด)
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              • คำตอบ (มีเฉลย): {fieldsWithAnswer.length} ฟิลด์<br/>
              • ช่องข้อมูล: {dataFields.length} ฟิลด์
            </p>
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {isDetecting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  กำลังตรวจจับ...
                </span>
              ) : (
                '🤖 ตรวจจับคำตอบด้วย AI'
              )}
            </button>
          </div>

          {/* Data Fields (no answer key) */}
          {dataFields.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4 text-white">ช่องข้อมูล (ไม่มีเฉลย)</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dataFields.map((field) => {
                  const detectedData = detectedAnswers[field.id]
                  const displayData = Array.isArray(detectedData) ? detectedData.join(', ') : detectedData || ''

                  return (
                    <div key={field.id} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-medium text-sm">{field.name}</p>
                          <p className="text-gray-400 text-xs">{field.type}</p>
                        </div>
                        <button
                          onClick={() => setEditingField(editingField === field.id ? null : field.id)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          {editingField === field.id ? 'ยกเลิก' : 'แก้ไข'}
                        </button>
                      </div>

                      {editingField === field.id ? (
                        <div>
                          <input
                            type="text"
                            value={displayData}
                            onChange={(e) => handleAnswerEdit(field.id, e.target.value)}
                            placeholder="ข้อมูลที่ตรวจจับได้"
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      ) : (
                        <div className="bg-gray-800 px-3 py-2 rounded border border-gray-700">
                          <p className="text-cyan-400 font-mono text-sm">
                            {displayData || <span className="text-gray-500">ยังไม่ได้ตรวจจับ</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Detected Answers */}
          {fieldsWithAnswer.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4 text-white">คำตอบที่ตรวจจับได้</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fieldsWithAnswer.map((field) => {
                  const studentAnswer = detectedAnswers[field.id]
                  const correctAnswer = answerKey[field.id]
                  const displayStudentAnswer = Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || ''
                  const displayCorrectAnswer = Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer || ''

                  return (
                    <div key={field.id} className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-white font-medium text-sm">{field.name}</p>
                          <p className="text-gray-400 text-xs">{field.type}</p>
                        </div>
                        <div className="flex gap-2">
                          {annotatedImages[field.id] && (
                            <button
                              onClick={() => setSelectedField(selectedField === field.id ? null : field.id)}
                              className="text-purple-400 hover:text-purple-300 text-xs"
                            >
                              {selectedField === field.id ? 'ซ่อน' : 'ดูรายละเอียด'}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingField(editingField === field.id ? null : field.id)}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            {editingField === field.id ? 'ยกเลิก' : 'แก้ไข'}
                          </button>
                        </div>
                      </div>

                      {editingField === field.id ? (
                        <div>
                          <input
                            type="text"
                            value={displayStudentAnswer}
                            onChange={(e) => handleAnswerEdit(field.id, e.target.value)}
                            placeholder={field.type === 'ฝน' ? 'a, b, c, d' : 'ข้อความคำตอบ'}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {field.type === 'ฝน' && (
                            <p className="text-xs text-gray-500 mt-1">* แยกคำตอบด้วยเครื่องหมายคอมมา (a, b, c)</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="bg-gray-800 px-3 py-2 rounded border border-gray-700 mb-2">
                            <p className="text-xs text-gray-400 mb-1">คำตอบนักเรียน:</p>
                            <p className="text-blue-400 font-mono text-sm">
                              {displayStudentAnswer || <span className="text-gray-500">ยังไม่ได้ตรวจจับ</span>}
                            </p>
                          </div>
                          <div className="bg-gray-800 px-3 py-2 rounded border border-gray-700">
                            <p className="text-xs text-gray-400 mb-1">เฉลย:</p>
                            <p className="text-green-400 font-mono text-sm">
                              {displayCorrectAnswer || <span className="text-gray-500">ไม่มีเฉลย</span>}
                            </p>
                          </div>

                          {/* Show annotated image and detections if selected */}
                          {selectedField === field.id && annotatedImages[field.id] && (
                            <div className="mt-3 border-t border-gray-700 pt-3">
                              <div className="bg-gray-900 rounded-lg p-3 mb-2">
                                <p className="text-xs text-gray-400 mb-2">รูปภาพที่ตรวจจับแล้ว:</p>
                                <img
                                  src={annotatedImages[field.id]}
                                  alt={`Detected ${field.name}`}
                                  className="w-full rounded border border-gray-600"
                                />
                              </div>

                              {detectionInfo[field.id] && detectionInfo[field.id].detections && (
                                <div className="bg-gray-900 rounded-lg p-3">
                                  <p className="text-xs text-gray-400 mb-2">
                                    ตรวจพบ {detectionInfo[field.id].total_detected} จุด:
                                  </p>
                                  <div className="space-y-1 max-h-40 overflow-y-auto">
                                    {detectionInfo[field.id].detections.map((det: any, idx: number) => (
                                      <div key={idx} className="text-xs flex justify-between items-center bg-gray-800 px-2 py-1 rounded">
                                        <span className="text-white font-mono">{det.class}</span>
                                        <span className="text-gray-400">
                                          ({det.conf.toFixed(2)})
                                          <span className="ml-2 text-gray-500">
                                            [{det.bbox.map((v: number) => v.toFixed(0)).join(', ')}]
                                          </span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Score and Save */}
        <div className="space-y-6">
          {/* Score Card */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-white">คะแนน</h3>
            <div className="text-center">
              <div className="text-6xl font-bold text-white mb-2">
                {score}<span className="text-3xl text-gray-400">/{total}</span>
              </div>
              <div className="text-xl text-gray-400">
                {total > 0 ? ((score / total) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-400">
                ข้อสอบ: <span className="text-white font-medium">{examName}</span>
              </p>
              <p className="text-sm text-gray-400 mt-1">
                ตรวจอัตโนมัติจาก OMR เท่านั้น
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <button
              onClick={handleSave}
              disabled={isSaving || saveStatus === 'success'}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-lg"
            >
              {isSaving ? 'กำลังบันทึก...' : saveStatus === 'success' ? 'บันทึกแล้ว ✓' : 'บันทึกผลการตรวจ'}
            </button>

            {saveStatus === 'success' && (
              <div className="mt-4 bg-green-600/20 border border-green-600 text-green-400 px-4 py-3 rounded-lg">
                <p className="font-semibold mb-2">✓ บันทึกสำเร็จ!</p>
                <Link
                  href={`/exams/${examId}`}
                  className="block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-center text-sm font-medium"
                >
                  ดูรายละเอียดข้อสอบ
                </Link>
              </div>
            )}

            {errorMessage && (
              <div className="mt-4 bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
