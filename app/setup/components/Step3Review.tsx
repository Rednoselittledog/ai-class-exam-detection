'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { DrawnField, ExamFields } from '@/lib/types'

interface Step3ReviewProps {
  examName: string
  onExamNameChange: (name: string) => void
  canvasSize: [number, number]
  fields: DrawnField[]
  onSave: () => Promise<void>
}

export default function Step3Review({
  examName,
  onExamNameChange,
  canvasSize,
  fields,
  onSave
}: Step3ReviewProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const [isCheckingName, setIsCheckingName] = useState(false)

  // Check for duplicate exam name
  useEffect(() => {
    if (!examName.trim()) {
      setIsDuplicateName(false)
      return
    }

    const checkDuplicateName = async () => {
      setIsCheckingName(true)
      try {
        const response = await fetch('/api/exams')
        const exams = await response.json()
        const duplicate = Array.isArray(exams) && exams.some((exam: any) =>
          exam.name.toLowerCase().trim() === examName.toLowerCase().trim()
        )
        setIsDuplicateName(duplicate)
      } catch (error) {
        console.error('Error checking duplicate name:', error)
      } finally {
        setIsCheckingName(false)
      }
    }

    const debounce = setTimeout(checkDuplicateName, 500)
    return () => clearTimeout(debounce)
  }, [examName])

  // Validate fields for overlaps
  useEffect(() => {
    const errors: string[] = []

    // Check field overlaps
    for (let i = 0; i < fields.length; i++) {
      for (let j = i + 1; j < fields.length; j++) {
        const field1 = fields[i]
        const field2 = fields[j]

        const [x1_1, y1_1, x2_1, y2_1] = field1.location
        const [x1_2, y1_2, x2_2, y2_2] = field2.location

        // Check if rectangles overlap
        const overlap = !(x2_1 < x1_2 || x2_2 < x1_1 || y2_1 < y1_2 || y2_2 < y1_1)

        if (overlap) {
          errors.push(`ฟิลด์ "${field1.name}" และ "${field2.name}" ทับกัน`)
        }
      }
    }

    setValidationErrors(errors)
  }, [fields])

  const fieldsJson: ExamFields = {}
  fields.forEach(field => {
    fieldsJson[field.id] = {
      type: field.type,
      name: field.name,
      rotate: field.rotate,
      location: field.location,
      has_answer: field.has_answer
    }
  })

  const examJson = {
    name: examName,
    canvas_size: canvasSize,
    fields: fieldsJson,
    answer_key: {}
  }

  const handleSave = async () => {
    // Validate before saving
    if (!examName.trim()) {
      setErrorMessage('กรุณากรอกชื่อข้อสอบ')
      return
    }

    if (isDuplicateName) {
      setErrorMessage('ชื่อข้อสอบนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น')
      return
    }

    if (validationErrors.length > 0) {
      setErrorMessage('กรุณาแก้ไขข้อผิดพลาดก่อนบันทึก (ฟิลด์ทับกัน)')
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
      await onSave()
      setSaveStatus('success')
    } catch (error) {
      console.error('Save error:', error)
      setSaveStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">ขั้นตอนที่ 3: ตรวจสอบและบันทึก</h2>

      <div className="space-y-6">
        {/* Exam Name Input */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            ชื่อข้อสอบ
          </label>
          <input
            type="text"
            value={examName}
            onChange={(e) => onExamNameChange(e.target.value)}
            placeholder="กรอกชื่อข้อสอบ"
            className={`w-full px-4 py-2 bg-gray-900 border rounded-md text-white focus:outline-none focus:ring-2 ${
              isDuplicateName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-700 focus:ring-blue-500'
            }`}
            required
          />
          {isCheckingName && (
            <p className="text-sm text-gray-400 mt-2">กำลังตรวจสอบชื่อ...</p>
          )}
          {isDuplicateName && !isCheckingName && (
            <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ชื่อข้อสอบนี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น
            </p>
          )}
          {!isDuplicateName && !isCheckingName && examName.trim() && (
            <p className="text-sm text-green-400 mt-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ชื่อนี้สามารถใช้ได้
            </p>
          )}
        </div>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-red-400 font-medium mb-2">พบข้อผิดพลาด:</p>
                <ul className="list-disc list-inside space-y-1 text-red-300 text-sm">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Fields Summary */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-white">สรุปฟิลด์ ({fields.length} ฟิลด์)</h3>
          <div className="space-y-2">
            {fields.length === 0 && (
              <p className="text-gray-500 text-center py-4">ยังไม่มีฟิลด์</p>
            )}
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-gray-900 p-4 rounded-lg border border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white font-medium">
                      {index + 1}. {field.name}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      ประเภท: {field.type} | การหมุน: {field.rotate}° | มีเฉลย: {field.has_answer ? 'ใช่' : 'ไม่'}
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      ตำแหน่ง: [{field.location.join(', ')}]
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Size */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold mb-2 text-white">ขนาดภาพ</h3>
          <p className="text-gray-300">
            {canvasSize[0]} × {canvasSize[1]} พิกเซล
          </p>
        </div>

        {/* JSON Preview */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-white">ตัวอย่าง JSON</h3>
          <pre className="bg-gray-900 p-4 rounded-lg text-sm text-gray-300 overflow-x-auto border border-gray-700">
            {JSON.stringify(examJson, null, 2)}
          </pre>
        </div>

        {/* Save Button */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !examName || fields.length === 0 || isDuplicateName || validationErrors.length > 0}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            {isSaving ? 'กำลังบันทึก...' : 'บันทึกไปยัง Supabase'}
          </button>

          {saveStatus === 'success' && (
            <div className="bg-green-600/20 border border-green-600 text-green-400 px-4 py-3 rounded-lg">
              <p className="font-semibold mb-2">✓ บันทึกสำเร็จ!</p>
              <div className="flex gap-2">
                <Link
                  href="/exams"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors text-center text-sm font-medium"
                >
                  ดูรายการข้อสอบ
                </Link>
                <Link
                  href="/"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-center text-sm font-medium"
                >
                  กลับหน้าหลัก
                </Link>
              </div>
            </div>
          )}

          {saveStatus === 'error' && (
            <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg">
              <p className="font-semibold">เกิดข้อผิดพลาดในการบันทึก</p>
              {errorMessage && (
                <p className="text-sm mt-1 text-red-300">{errorMessage}</p>
              )}
              <p className="text-sm mt-1">กรุณาตรวจสอบ console สำหรับรายละเอียดเพิ่มเติม</p>
            </div>
          )}

          {(!examName || fields.length === 0 || isDuplicateName || validationErrors.length > 0) && (
            <p className="text-yellow-500 text-sm text-center">
              {!examName
                ? 'กรุณากรอกชื่อข้อสอบ'
                : isDuplicateName
                ? 'ชื่อข้อสอบซ้ำ กรุณาเปลี่ยนชื่อ'
                : validationErrors.length > 0
                ? 'กรุณาแก้ไขฟิลด์ที่ทับกัน'
                : 'กรุณาเพิ่มฟิลด์อย่างน้อย 1 ฟิลด์'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
