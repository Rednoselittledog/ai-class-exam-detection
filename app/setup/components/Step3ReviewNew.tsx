'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DrawnField, AnswerKeyValue } from '@/lib/types'
import { fileToBase64, cropFieldFromImage, formatAnswerForDisplay } from '@/lib/utils/field-helpers'
import OMRAnswerList from '@/app/components/OMRAnswerList'
import OMRImageWithOverlay from '@/app/components/OMRImageWithOverlay'

interface Step3ReviewProps {
  examName: string
  onExamNameChange: (name: string) => void
  canvasSize: [number, number]
  fields: DrawnField[]
  imageFile: File | null
  croppedImageDataUrl: string | null
  onSave: (answerKey: Record<string, AnswerKeyValue>) => Promise<void>
  isEditMode?: boolean
  initialAnswerKey?: Record<string, AnswerKeyValue>
}

export default function Step3ReviewNew({
  examName,
  onExamNameChange,
  canvasSize,
  fields,
  imageFile,
  croppedImageDataUrl,
  onSave,
  isEditMode = false,
  initialAnswerKey = {}
}: Step3ReviewProps) {
  // State: UI control
  const [isSaving, setIsSaving] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [showLabelsToggle, setShowLabelsToggle] = useState<Record<string, boolean>>({})
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState<Record<string, number | null>>({})
  const [hoverAnswerIndex, setHoverAnswerIndex] = useState<Record<string, number | null>>({})

  // State: Answer key and detection results
  const [answerKey, setAnswerKey] = useState<Record<string, AnswerKeyValue>>(initialAnswerKey)
  const [detectionInfo, setDetectionInfo] = useState<Record<string, any>>({})
  const [croppedImages, setCroppedImages] = useState<Record<string, string>>({})

  // Auto-detect on mount (only if not in edit mode or if initialAnswerKey is empty)
  useEffect(() => {
    if (!isEditMode || Object.keys(initialAnswerKey).length === 0) {
      const fieldsWithAnswer = fields.filter(f => f.has_answer === 1)
      if (fieldsWithAnswer.length > 0 && (imageFile || croppedImageDataUrl)) {
        handleAutoDetect()
      }
    } else {
      // In edit mode with existing data - just crop images without detecting
      handleCropAllImages()
    }
  }, []) // Empty dependency array - only run once on mount

  // Crop all field images without detection (for edit mode)
  const handleCropAllImages = async () => {
    if (!imageFile && !croppedImageDataUrl) return

    try {
      let imageBase64 = croppedImageDataUrl
      if (!imageBase64 && imageFile) {
        imageBase64 = await fileToBase64(imageFile)
      }

      const newCroppedImages: Record<string, string> = {}
      for (const field of fields) {
        const croppedFieldImage = await cropFieldFromImage(imageBase64!, field, canvasSize)
        newCroppedImages[field.id] = croppedFieldImage
      }

      setCroppedImages(newCroppedImages)
    } catch (error) {
      console.error('Error cropping images:', error)
    }
  }

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
    if (!imageFile && !croppedImageDataUrl) {
      setErrorMessage('ไม่พบรูปภาพสำหรับตรวจจับเฉลย')
      return
    }

    setIsDetecting(true)
    setErrorMessage('')

    try {
      let imageBase64 = croppedImageDataUrl
      if (!imageBase64 && imageFile) {
        imageBase64 = await fileToBase64(imageFile)
      }

      const newAnswerKey: Record<string, AnswerKeyValue> = { ...answerKey }
      const newDetectionInfo: Record<string, any> = {}
      const newCroppedImages: Record<string, string> = {}

      for (const field of fields) {
        const croppedFieldImage = await cropFieldFromImage(imageBase64!, field, canvasSize)
        newCroppedImages[field.id] = croppedFieldImage

        if (field.type === 'ฝน') {
          const result = await detectOMR(croppedFieldImage)
          if (result.success && result.answers) {
            newAnswerKey[field.id] = result.answers
            newDetectionInfo[field.id] = {
              detections: result.detections || [],
              total_detected: result.total_detected || 0
            }
          }
        } else if (field.type === 'ข้อเขียน') {
          const result = await detectOCR(croppedFieldImage)
          if (result.success && result.text) {
            newAnswerKey[field.id] = result.text.trim()
          }
        }
      }

      setAnswerKey(newAnswerKey)
      setDetectionInfo(newDetectionInfo)
      setCroppedImages(newCroppedImages)
    } catch (error) {
      setErrorMessage(`เกิดข้อผิดพลาดในการตรวจจับเฉลย: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      setAnswerKey({ ...answerKey, [fieldId]: answers })
    } else {
      setAnswerKey({ ...answerKey, [fieldId]: value })
    }
  }

  const handleAnswersChange = (fieldId: string, newAnswers: string[]) => {
    setAnswerKey({ ...answerKey, [fieldId]: newAnswers })
  }

  const handleHoverIndexChange = (fieldId: string, hoverIndex: number | null) => {
    // Only update if the hover index actually changed
    if (hoverAnswerIndex[fieldId] === hoverIndex) return
    setHoverAnswerIndex(prev => ({ ...prev, [fieldId]: hoverIndex }))
  }

  // API: Detect OMR answers (only called once during initial detection)
  const detectOMR = async (croppedImage: string) => {
    const response = await fetch('/api/detect-omr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: croppedImage })
    })
    return await response.json()
  }

  // Save exam
  const handleSave = async () => {
    if (!examName.trim()) {
      setErrorMessage('กรุณากรอกชื่อข้อสอบ')
      return
    }

    if (fields.length === 0) {
      setErrorMessage('กรุณาเพิ่มฟิลด์อย่างน้อย 1 ฟิลด์')
      return
    }

    setIsSaving(true)
    setSaveStatus('idle')
    setErrorMessage('')

    try {
      await onSave(answerKey)
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">ขั้นตอนที่ 3: ตั้งชื่อและระบุเฉลย</h2>
        {isEditMode && (
          <button
            onClick={handleAutoDetect}
            disabled={isDetecting}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${isDetecting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isDetecting ? 'กำลังแสกน...' : '🔄 แสกนใหม่'}
          </button>
        )}
      </div>

      {/* Edit Mode Info Banner */}
      {isEditMode && Object.keys(initialAnswerKey).length > 0 && !isDetecting && (
        <div className="mb-6 bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            ℹ️ <strong>โหมดแก้ไข:</strong> ข้อมูลที่มีอยู่แล้วถูกโหลดมา คุณสามารถแก้ไขหรือกด "แสกนใหม่" เพื่อตรวจจับอีกครั้ง
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

      {/* Detecting Banner */}
      {isDetecting && (
        <div className="mb-6 bg-purple-600/20 border border-purple-600/50 rounded-lg p-4">
          <div className="flex items-center justify-center gap-2 text-purple-300">
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
              const answer = answerKey[field.id]
              const displayData = formatAnswerForDisplay(answer)

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
                        <img
                          src={croppedImages[field.id]}
                          alt={`Cropped ${field.name}`}
                          className="w-full rounded border border-gray-600"
                        />
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
              const answer = answerKey[field.id]
              const answers = Array.isArray(answer) ? answer : (answer ? [answer] : [])

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
                            selectedIndices={selectedAnswerIndex[field.id] !== null && selectedAnswerIndex[field.id] !== undefined ? [selectedAnswerIndex[field.id]!] : []}
                            hoverIndex={hoverAnswerIndex[field.id]}
                            showAllLabels={showLabelsToggle[field.id] || false}
                          />
                          <div className="mt-2 bg-gray-800 rounded-lg p-3">
                            <p className="text-xs text-gray-400 mb-2">
                              ตรวจพบ {detectionInfo[field.id].total_detected} จุด • Hover/Click เพื่อดูตำแหน่ง
                            </p>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {detectionInfo[field.id].detections.map((det: any, idx: number) => (
                                <div
                                  key={idx}
                                  className={`text-xs flex justify-between items-center px-2 py-1 rounded transition-colors ${
                                    selectedAnswerIndex[field.id] === idx
                                      ? 'bg-blue-600/30 border border-blue-500'
                                      : 'bg-gray-900'
                                  }`}
                                >
                                  <span className="text-white font-mono">{det.class}</span>
                                  <span className="text-gray-400">({det.conf.toFixed(2)})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : croppedImages[field.id] ? (
                        <img
                          src={croppedImages[field.id]}
                          alt={`Cropped ${field.name}`}
                          className="w-full rounded border border-gray-600"
                        />
                      ) : (
                        <div className="w-full aspect-4/3 bg-gray-800 rounded border border-gray-600 flex items-center justify-center text-gray-500">
                          ไม่มีรูปภาพ
                        </div>
                      )}
                    </div>

                    {/* Right: Answers Table */}
                    <div>
                      <OMRAnswerList
                        answers={answers}
                        onAnswersChange={(newAnswers) => handleAnswersChange(field.id, newAnswers)}
                        selectedIndex={selectedAnswerIndex[field.id] ?? null}
                        onSelectedIndexChange={(index) => setSelectedAnswerIndex({ ...selectedAnswerIndex, [field.id]: index })}
                        detections={detectionInfo[field.id]?.detections || []}
                        onHoverIndexChange={(index) => handleHoverIndexChange(field.id, index)}
                      />
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
        <h3 className="text-xl font-bold mb-4 text-white">📋 สรุปข้อสอบ</h3>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Full Exam Image */}
          <div className="lg:col-span-2">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">รูปภาพข้อสอบเต็ม</h4>
            {(croppedImageDataUrl || imageFile) && (
              <img
                src={croppedImageDataUrl || (imageFile ? URL.createObjectURL(imageFile) : '')}
                alt="Exam preview"
                className="w-full rounded-lg border border-gray-600"
              />
            )}
          </div>

          {/* Right: Name and Summary */}
          <div className="space-y-4">
            {/* Exam Name Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                ชื่อข้อสอบ
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => onExamNameChange(e.target.value)}
                placeholder="กรอกชื่อข้อสอบ"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Field Summary Stats */}
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">สถิติฟิลด์</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ฟิลด์ทั้งหมด:</span>
                  <span className="text-white font-semibold">{fields.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">OMR (มีเฉลย):</span>
                  <span className="text-blue-400 font-semibold">{fieldsWithAnswer.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">OCR (ช่องข้อมูล):</span>
                  <span className="text-purple-400 font-semibold">{dataFields.length}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400">จำนวนข้อ:</span>
                  <span className="text-green-400 font-semibold">
                    {fieldsWithAnswer.reduce((total, field) => {
                      const answer = answerKey[field.id]
                      return total + (Array.isArray(answer) ? answer.length : 0)
                    }, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-6 bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Save Button */}
      <div className="mt-6 flex flex-col gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || saveStatus === 'success' || !examName.trim() || fields.length === 0}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-lg"
        >
          {isSaving ? 'กำลังบันทึก...' : saveStatus === 'success' ? 'บันทึกแล้ว ✓' : 'บันทึกข้อสอบ'}
        </button>

        {saveStatus === 'success' && (
          <div className="bg-green-600/20 border border-green-600 text-green-400 px-4 py-3 rounded-lg">
            <p className="font-semibold mb-2">✓ บันทึกสำเร็จ!</p>
            <div className="flex gap-2">
              <Link
                href="/"
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-center text-sm font-medium"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
