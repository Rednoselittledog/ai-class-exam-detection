'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { DrawnField, AnswerKeyValue } from '@/lib/types'
import { cropFieldFromImage, compareAnswers, formatAnswerForDisplay } from '@/lib/utils/field-helpers'
import OMRAnswerList from '@/app/components/OMRAnswerList'
import OMRImageWithOverlay from '@/app/components/OMRImageWithOverlay'

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
  // State: UI control
  const [isDetecting, setIsDetecting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showLabelsToggle, setShowLabelsToggle] = useState<Record<string, boolean>>({})
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<Record<string, number | null>>({})
  const [hoverAnswerIndex, setHoverAnswerIndex] = useState<Record<string, number | null>>({})

  // State: Detection results
  const [detectedAnswers, setDetectedAnswers] = useState<Record<string, AnswerKeyValue>>(initialAnswers)
  const [detectionInfo, setDetectionInfo] = useState<Record<string, any>>({})
  const [croppedImages, setCroppedImages] = useState<Record<string, string>>({})
  const [answerToDetectionMap, setAnswerToDetectionMap] = useState<Record<string, number[]>>({})
  const answerToDetectionMapRef = useRef<Record<string, number[]>>({})

  // Auto-detect on mount (only if not in edit mode or if initialAnswers is empty)
  useEffect(() => {
    if (!isEditMode || Object.keys(initialAnswers).length === 0) {
      if (resizedImageDataUrl && fields.length > 0) {
        handleAutoDetect()
      }
    }
  }, []) // Empty dependency array - only run once on mount

  // API: Detect OCR text
  const detectOCR = async (croppedImage: string) => {
    const response = await fetch('/api/detect-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: croppedImage })
    })
    return await response.json()
  }

  // Auto-detect answers for all fields
  const handleAutoDetect = async () => {
    setIsDetecting(true)
    setErrorMessage('')

    try {
      if (!resizedImageDataUrl) {
        throw new Error('ไม่พบรูปภาพสำหรับการตรวจจับ')
      }

      const newDetectedAnswers: Record<string, AnswerKeyValue> = { ...detectedAnswers }
      const newDetectionInfo: Record<string, any> = {}
      const newCroppedImages: Record<string, string> = {}

      for (const field of fields) {
        const croppedFieldImage = await cropFieldFromImage(resizedImageDataUrl, field)
        newCroppedImages[field.id] = croppedFieldImage

        if (field.type === 'ฝน') {
          const result = await detectOMR(croppedFieldImage)
          if (result.success && result.answers) {
            newDetectedAnswers[field.id] = result.answers
            newDetectionInfo[field.id] = {
              detections: result.detections || [],
              total_detected: result.total_detected || 0
            }
          }
        } else if (field.type === 'ข้อเขียน') {
          const result = await detectOCR(croppedFieldImage)
          if (result.success && result.text) {
            newDetectedAnswers[field.id] = result.text.trim()
          }
        }
      }

      // Create initial mapping: answer index -> detection index
      const newMapping: Record<string, number[]> = {}
      for (const field of fields) {
        if (field.type === 'ฝน' && newDetectedAnswers[field.id]) {
          const answers = Array.isArray(newDetectedAnswers[field.id]) ? newDetectedAnswers[field.id] as string[] : []
          newMapping[field.id] = answers.map((_, idx) => idx)
        }
      }

      setDetectedAnswers(newDetectedAnswers)
      setDetectionInfo(newDetectionInfo)
      setCroppedImages(newCroppedImages)
      setAnswerToDetectionMap(newMapping)
    } catch (error) {
      setErrorMessage(`เกิดข้อผิดพลาดในการตรวจจับคำตอบ: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDetecting(false)
    }
  }

  // Answer editing handlers
  const handleAnswerEdit = (fieldId: string, value: string) => {
    const field = fields.find(f => f.id === fieldId)
    if (!field) return

    if (field.type === 'ฝน') {
      const answers = value.split(',').map(a => a.trim()).filter(Boolean)
      setDetectedAnswers({ ...detectedAnswers, [fieldId]: answers })
    } else {
      setDetectedAnswers({ ...detectedAnswers, [fieldId]: value })
    }
  }

  const handleAnswersChange = (fieldId: string, newAnswers: string[]) => {
    setDetectedAnswers({ ...detectedAnswers, [fieldId]: newAnswers })
  }

  const handleAnswerDelete = (fieldId: string, deletedIndex: number) => {
    const oldMapping = answerToDetectionMap[fieldId] || []
    // Remove the mapping at deletedIndex
    const newMapping = oldMapping.filter((_, idx) => idx !== deletedIndex)
    setAnswerToDetectionMap({ ...answerToDetectionMap, [fieldId]: newMapping })
  }

  const handleAnswerAdd = (fieldId: string, insertedIndex: number) => {
    const oldMapping = answerToDetectionMap[fieldId] || []
    // Insert -1 at insertedIndex (no detection for new answer)
    const newMapping = [...oldMapping]
    newMapping.splice(insertedIndex, 0, -1)
    setAnswerToDetectionMap({ ...answerToDetectionMap, [fieldId]: newMapping })
  }

  // Update ref whenever answerToDetectionMap changes
  useEffect(() => {
    answerToDetectionMapRef.current = answerToDetectionMap
  }, [answerToDetectionMap])

  const handleHoverIndexChange = useCallback((fieldId: string, answerIndex: number | null) => {
    // Map answer index to detection index using ref to avoid dependency
    const mapping = answerToDetectionMapRef.current
    const detectionIndex = answerIndex !== null && mapping[fieldId]
      ? mapping[fieldId][answerIndex]
      : null

    // Only update if the detection index is valid and changed
    if (detectionIndex === undefined || detectionIndex === -1) {
      setHoverAnswerIndex(prev => ({ ...prev, [fieldId]: null }))
      return
    }

    setHoverAnswerIndex(prev => {
      // Skip if same detection index
      if (prev[fieldId] === detectionIndex) return prev
      return { ...prev, [fieldId]: detectionIndex }
    })
  }, [])

  // API: Detect OMR answers (only called once during initial detection)
  const detectOMR = async (croppedImage: string) => {
    const response = await fetch('/api/detect-omr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: croppedImage })
    })
    return await response.json()
  }

  // Calculate score based on OMR fields
  const calculateScore = () => {
    let correct = 0
    let total = 0

    fields.forEach(field => {
      if (field.has_answer !== 1 || field.type !== 'ฝน') return

      const correctAnswer = answerKey[field.id]
      const studentAnswer = detectedAnswers[field.id]

      if (!Array.isArray(correctAnswer) || !Array.isArray(studentAnswer)) return

      const questionCount = correctAnswer.length
      total += questionCount

      for (let i = 0; i < questionCount; i++) {
        if (compareAnswers(correctAnswer[i], studentAnswer[i])) {
          correct++
        }
      }
    })

    return { score: correct, total }
  }

  // Convert base64 data URL to File
  const dataUrlToFile = async (dataUrl: string, fileName: string): Promise<File> => {
    const base64Data = dataUrl.split(',')[1]
    const byteCharacters = atob(base64Data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: 'image/png' })
    return new File([blob], fileName, { type: 'image/png' })
  }

  // Save submission
  const handleSave = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      const file = await dataUrlToFile(resizedImageDataUrl, `submission-${Date.now()}.png`)

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
      const { score, total } = calculateScore()

      await onSave(detectedAnswers, score, total, publicUrl)
      setSaveStatus('success')
    } catch (error) {
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  const fieldsWithAnswer = fields.filter(f => f.has_answer === 1)
  const dataFields = fields.filter(f => f.has_answer === 0)

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

      {/* Hint Banner */}
      {!isDetecting && Object.keys(detectionInfo).length > 0 && (
        <div className="mb-6 bg-green-600/20 border border-green-600/50 rounded-lg p-4">
          <p className="text-green-300 text-sm">
            ✅ <strong>ตรวจจับสำเร็จ!</strong> กด "ดูรูป" ที่แต่ละฟิลด์เพื่อดู Bounding Box และรายละเอียด
          </p>
        </div>
      )}

      {/* Detection Status */}
      {isDetecting && (
        <div className="mb-6 bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 text-blue-300">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-medium">กำลังตรวจจับคำตอบอัตโนมัติ... ({fields.length} ฟิลด์)</span>
          </div>
        </div>
      )}

      {/* Section 1: OCR Fields */}
      {dataFields.length > 0 && (
        <div className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-white">
            📝 ช่องข้อมูล OCR ({dataFields.length} ฟิลด์)
          </h3>
          <div className="space-y-4">
            {dataFields.map((field) => {
              const detectedData = detectedAnswers[field.id]
              const displayData = formatAnswerForDisplay(detectedData)

              return (
                <div key={field.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Left: Image */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-white font-semibold">{field.name}</h4>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-600/20 text-purple-400">
                          {field.type}
                        </span>
                      </div>
                      {croppedImages[field.id] && (
                        <div className="flex items-center justify-center">
                          <img
                            src={croppedImages[field.id]}
                            alt={`Cropped ${field.name}`}
                            className="rounded border border-gray-600 max-w-full"
                            style={{
                              maxHeight: '300px',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {/* Right: Detected Data */}
                    <div className="flex flex-col justify-center">
                      <label className="text-sm text-gray-400 mb-2">ข้อมูลที่ตรวจจับได้:</label>
                      <input
                        type="text"
                        value={displayData}
                        onChange={(e) => handleAnswerEdit(field.id, e.target.value)}
                        placeholder="ข้อมูลที่ตรวจจับได้"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 2: OMR Fields */}
      {fieldsWithAnswer.length > 0 && (
        <div className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-bold mb-4 text-white">
            ✅ ข้อสอบ OMR ({fieldsWithAnswer.length} ฟิลด์)
          </h3>
          <div className="space-y-6">
            {fieldsWithAnswer.map((field) => {
              const studentAnswer = detectedAnswers[field.id]
              const correctAnswer = answerKey[field.id]
              const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : (studentAnswer ? [studentAnswer] : [])
              const correctAnswers = Array.isArray(correctAnswer) ? correctAnswer : (correctAnswer ? [correctAnswer] : [])

              return (
                <div key={field.id} className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                  <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Image with toggle */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-white font-semibold">{field.name}</h4>
                          <span className="inline-block mt-1 px-2 py-1 rounded text-xs font-medium bg-blue-600/20 text-blue-400">
                            {field.type}
                          </span>
                        </div>
                        {detectionInfo[field.id] && detectionInfo[field.id].detections && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-sm text-gray-400">แสดง Labels</span>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={showLabelsToggle[field.id] || false}
                                onChange={(e) => {
                                  setShowLabelsToggle({ ...showLabelsToggle, [field.id]: e.target.checked })
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            </div>
                          </label>
                        )}
                      </div>
                      {/* Show image with CSS overlay */}
                      {detectionInfo[field.id] && detectionInfo[field.id].detections && croppedImages[field.id] ? (
                        <div>
                          <OMRImageWithOverlay
                            imageBase64={croppedImages[field.id]}
                            detections={detectionInfo[field.id].detections}
                            selectedIndices={
                              selectedAnswerIndex[field.id] !== null &&
                              selectedAnswerIndex[field.id] !== undefined &&
                              answerToDetectionMap[field.id] &&
                              answerToDetectionMap[field.id][selectedAnswerIndex[field.id]!] !== undefined &&
                              answerToDetectionMap[field.id][selectedAnswerIndex[field.id]!] !== -1
                                ? [answerToDetectionMap[field.id][selectedAnswerIndex[field.id]!]]
                                : []
                            }
                            hoverIndex={hoverAnswerIndex[field.id]}
                            showAllLabels={showLabelsToggle[field.id] || false}
                            rotation={field.rotate}
                          />
                        </div>
                      ) : croppedImages[field.id] ? (
                        <div className="flex items-center justify-center">
                          <img
                            src={croppedImages[field.id]}
                            alt={`Cropped ${field.name}`}
                            className="rounded border border-gray-600 max-w-full"
                            style={{
                              maxHeight: '300px',
                              objectFit: 'contain'
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-4/3 bg-gray-800 rounded border border-gray-600 flex items-center justify-center text-gray-500">
                          ไม่มีรูปภาพ
                        </div>
                      )}
                    </div>

                    {/* Right: Answers Table with Comparison */}
                    <div>
                      <h5 className="text-white font-semibold mb-3">คำตอบนักเรียน vs เฉลย</h5>

                      {/* Student Answers Section */}
                      <div className="mb-6">
                        <h6 className="text-sm text-gray-400 mb-2">คำตอบนักเรียน:</h6>
                        <OMRAnswerList
                          answers={studentAnswers}
                          onAnswersChange={(newAnswers) => handleAnswersChange(field.id, newAnswers)}
                          selectedIndex={selectedAnswerIndex[field.id] ?? null}
                          onSelectedIndexChange={(index) => setSelectedAnswerIndex({ ...selectedAnswerIndex, [field.id]: index })}
                          detections={detectionInfo[field.id]?.detections || []}
                          onHoverIndexChange={(index) => handleHoverIndexChange(field.id, index)}
                          onDelete={(deletedIndex) => handleAnswerDelete(field.id, deletedIndex)}
                          onAdd={(insertedIndex) => handleAnswerAdd(field.id, insertedIndex)}
                        />
                      </div>

                      {/* Comparison Table */}
                      <div className="mt-4 bg-gray-800/50 rounded-lg p-3">
                        <h6 className="text-sm text-gray-400 mb-2">ผลการตรวจ:</h6>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {Array.from({ length: Math.max(studentAnswers.length, correctAnswers.length) }).map((_, idx) => {
                            const studentAns = studentAnswers[idx] || ''
                            const correctAns = correctAnswers[idx] || ''
                            const isCorrect = compareAnswers(studentAns, correctAns)

                            return (
                              <div
                                key={idx}
                                className={`flex items-center justify-between p-2 rounded text-sm ${
                                  selectedAnswerIndex[field.id] === idx ? 'bg-blue-600/20' : 'bg-gray-900'
                                }`}
                              >
                                <span className="text-gray-400 w-12">#{idx + 1}</span>
                                <span className="text-white font-mono flex-1">{studentAns || '-'}</span>
                                <span className="text-gray-400 mx-2">vs</span>
                                <span className="text-green-400 font-mono flex-1">{correctAns || '-'}</span>
                                {studentAns && correctAns && (
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isCorrect ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                                  }`}>
                                    {isCorrect ? '✓' : '✗'}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Section 3: Summary */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white">📋 สรุปผลการตรวจ</h3>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Full Image */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">รูปภาพกระดาษคำตอบเต็ม</h4>
            {resizedImageDataUrl && (
              <img
                src={resizedImageDataUrl}
                alt="Student answer sheet"
                className="w-full rounded-lg border border-gray-600"
              />
            )}
          </div>

          {/* Right: Score and Info */}
          <div className="space-y-4">
            {/* Score Card */}
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 text-center">คะแนน</h4>
              <div className="text-center">
                {(() => {
                  const { score, total } = calculateScore()
                  return (
                    <>
                      <div className="text-5xl font-bold text-white mb-2">
                        {score}<span className="text-2xl text-gray-400">/{total}</span>
                      </div>
                      <div className="text-lg text-gray-400">
                        {total > 0 ? ((score / total) * 100).toFixed(1) : 0}%
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Exam Info */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">ข้อมูลข้อสอบ</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ชื่อข้อสอบ:</span>
                  <span className="text-white font-semibold text-right ml-2">{examName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ฟิลด์ทั้งหมด:</span>
                  <span className="text-white font-semibold">{fields.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">OMR:</span>
                  <span className="text-blue-400 font-semibold">{fieldsWithAnswer.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">OCR:</span>
                  <span className="text-purple-400 font-semibold">{dataFields.length}</span>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving || saveStatus === 'success'}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-lg"
            >
              {isSaving ? 'กำลังบันทึก...' : saveStatus === 'success' ? 'บันทึกแล้ว ✓' : isEditMode ? 'อัปเดตผลการตรวจ' : 'บันทึกผลการตรวจ'}
            </button>

            {saveStatus === 'success' && (
              <div className="bg-green-600/20 border border-green-600 text-green-400 px-4 py-3 rounded-lg">
                <p className="font-semibold mb-2 text-sm">✓ บันทึกสำเร็จ!</p>
                <Link
                  href={`/exams/${examId}`}
                  className="block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-center text-sm font-medium"
                >
                  ดูรายละเอียดข้อสอบ
                </Link>
              </div>
            )}

            {errorMessage && (
              <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg text-sm">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
