'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DrawnField, AnswerKeyValue } from '@/lib/types'

interface Step3ReviewProps {
  examName: string
  onExamNameChange: (name: string) => void
  canvasSize: [number, number]
  fields: DrawnField[]
  imageFile: File | null
  croppedImageDataUrl: string | null
  onSave: (answerKey: Record<string, AnswerKeyValue>) => Promise<void>
}

export default function Step3ReviewNew({
  examName,
  onExamNameChange,
  canvasSize,
  fields,
  imageFile,
  croppedImageDataUrl,
  onSave
}: Step3ReviewProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Answer key state: field_id -> answer
  const [answerKey, setAnswerKey] = useState<Record<string, AnswerKeyValue>>({})
  const [editingField, setEditingField] = useState<string | null>(null)
  const [annotatedImages, setAnnotatedImages] = useState<Record<string, string>>({})
  const [detectionInfo, setDetectionInfo] = useState<Record<string, any>>({})
  const [selectedField, setSelectedField] = useState<string | null>(null)

  // Auto-detect answers for fields with has_answer=1
  const handleAutoDetect = async () => {
    if (!imageFile && !croppedImageDataUrl) {
      setErrorMessage('ไม่พบรูปภาพสำหรับตรวจจับเฉลย')
      return
    }

    setIsDetecting(true)
    setErrorMessage('')

    try {
      // Get image as base64
      let imageBase64 = croppedImageDataUrl
      if (!imageBase64 && imageFile) {
        imageBase64 = await fileToBase64(imageFile)
      }

      const newAnswerKey: Record<string, AnswerKeyValue> = { ...answerKey }
      const newAnnotatedImages: Record<string, string> = {}
      const newDetectionInfo: Record<string, any> = {}

      // Process each field with has_answer=1
      for (const field of fields) {
        // if (field.has_answer !== 1) continue

        // Crop field from image
        const croppedFieldImage = await cropFieldFromImage(imageBase64!, field, canvasSize)

        if (field.type === 'ฝน') {
          // Use OMR detection
          const response = await fetch('/api/detect-omr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: croppedFieldImage })
          })
          const result = await response.json()

          if (result.success && result.answers) {
            newAnswerKey[field.id] = result.answers // Array of answers

            // Store annotated image and detection info
            if (result.annotated_image) {
              newAnnotatedImages[field.id] = result.annotated_image
            }
            newDetectionInfo[field.id] = {
              detections: result.detections || [],
              total_detected: result.total_detected || 0
            }
          }
        } else if (field.type === 'ข้อเขียน') {
          // Use OCR detection
          const response = await fetch('/api/detect-ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: croppedFieldImage })
          })
          const result = await response.json()
          console.log('OCR result for field', field.id, result)

          if (result.success && result.text) {
            newAnswerKey[field.id] = result.text.trim() // String
          }
        }
      }

      setAnswerKey(newAnswerKey)
      setAnnotatedImages(newAnnotatedImages)
      setDetectionInfo(newDetectionInfo)
    } catch (error) {
      console.error('Auto-detect error:', error)
      setErrorMessage(`เกิดข้อผิดพลาดในการตรวจจับเฉลย: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDetecting(false)
    }
  }

  // Helper: Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // Helper: Crop field area from image
  const cropFieldFromImage = async (
    imageBase64: string,
    field: DrawnField,
    canvasSize: [number, number]
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
      setAnswerKey({ ...answerKey, [fieldId]: answers })
    } else {
      setAnswerKey({ ...answerKey, [fieldId]: value })
    }
  }

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
      console.error('Save error:', error)
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  // Fields with has_answer=1
  const fieldsWithAnswer = fields.filter(f => f.has_answer === 1)

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">ขั้นตอนที่ 3: ตั้งชื่อและระบุเฉลย</h2>

      {/* Hint Banner */}
      {Object.keys(annotatedImages).length === 0 && fieldsWithAnswer.length > 0  && (
        <div className="mb-6 bg-blue-600/20 border border-blue-600/50 rounded-lg p-4">
          <p className="text-blue-300 text-sm">
            💡 <strong>วิธีดู Bounding Box:</strong>
          </p>
          <ol className="text-blue-300 text-sm mt-2 ml-4 space-y-1 list-decimal">
            <li>กดปุ่ม "🤖 ตรวจจับเฉลยด้วย AI" ทางด้านขวา</li>
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column: Image Preview + Exam Name */}
        <div className="space-y-6">
          {/* Image Preview */}
          {(croppedImageDataUrl || imageFile) && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4 text-white">รูปภาพข้อสอบ</h3>
              <img
                src={croppedImageDataUrl || (imageFile ? URL.createObjectURL(imageFile) : '')}
                alt="Exam preview"
                className="w-full rounded-lg border border-gray-600"
              />
            </div>
          )}

          {/* Exam Name */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ชื่อข้อสอบ
            </label>
            <input
              type="text"
              value={examName}
              onChange={(e) => onExamNameChange(e.target.value)}
              placeholder="กรอกชื่อข้อสอบ"
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Fields Summary */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-white">สรุปฟิลด์ ({fields.length} ฟิลด์)</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fields.map((field, index) => (
                <div key={field.id} className="bg-gray-900 p-3 rounded-lg border border-gray-700">
                  <p className="text-white font-medium text-sm">
                    {index + 1}. {field.name}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">
                    {field.type} • {field.rotate}° • เฉลย: {field.has_answer ? 'มี' : 'ไม่มี'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Answer Key Detection */}
        <div className="space-y-6">
          {/* Auto-detect button */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-bold mb-4 text-white">
              ตรวจจับเฉลยอัตโนมัติ ({fieldsWithAnswer.length} ฟิลด์)
            </h3>
            <button
              onClick={handleAutoDetect}
              disabled={isDetecting /*|| fieldsWithAnswer.length === 0*/}
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
                '🤖 ตรวจจับเฉลยด้วย AI'
              )}
            </button>
            {fieldsWithAnswer.length === 0 && (
              <p className="text-gray-400 text-sm mt-2 text-center">ไม่มีฟิลด์ที่ระบุว่ามีเฉลย</p>
            )}
          </div>

          {/* Answer Key List */}
          {fieldsWithAnswer.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-bold mb-4 text-white">เฉลยที่ตรวจจับได้</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {fieldsWithAnswer.map((field) => {
                  const answer = answerKey[field.id]
                  const displayAnswer = Array.isArray(answer) ? answer.join(', ') : answer || ''

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
                            value={displayAnswer}
                            onChange={(e) => handleAnswerEdit(field.id, e.target.value)}
                            placeholder={field.type === 'ฝน' ? 'a, b, c, d' : 'ข้อความเฉลย'}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {field.type === 'ฝน' && (
                            <p className="text-xs text-gray-500 mt-1">* แยกคำตอบด้วยเครื่องหมายคอมมา (a, b, c)</p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="bg-gray-800 px-3 py-2 rounded border border-gray-700">
                            <p className="text-green-400 font-mono text-sm">
                              {displayAnswer || <span className="text-gray-500">ยังไม่ได้ตรวจจับ</span>}
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
