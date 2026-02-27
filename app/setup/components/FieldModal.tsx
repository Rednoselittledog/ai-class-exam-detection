'use client'

import { useState, useEffect } from 'react'
import { Field, FieldType, RotationDegree } from '@/lib/types'

interface FieldModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (field: Omit<Field, 'location'>) => void
  initialData?: Omit<Field, 'location'>
}

export default function FieldModal({ isOpen, onClose, onSave, initialData }: FieldModalProps) {
  const [fieldName, setFieldName] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('ฝน')
  const [rotation, setRotation] = useState<RotationDegree>(0)
  const [hasAnswer, setHasAnswer] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFieldName(initialData.name)
      setFieldType(initialData.type)
      setRotation(initialData.rotate)
      setHasAnswer(initialData.has_answer === 1)
    } else {
      setFieldName('')
      setFieldType('ฝน')
      setRotation(0)
      setHasAnswer(false)
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      name: fieldName,
      type: fieldType,
      rotate: rotation,
      has_answer: hasAnswer ? 1 : 0
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white">
          {initialData ? 'แก้ไขฟิลด์' : 'เพิ่มฟิลด์ใหม่'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              ชื่อฟิลด์
            </label>
            <input
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              ประเภท
            </label>
            <select
              value={fieldType}
              onChange={(e) => setFieldType(e.target.value as FieldType)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ฝน">ฝน</option>
              <option value="ข้อเขียน">ข้อเขียน</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              การหมุน (องศา)
            </label>
            <select
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value) as RotationDegree)}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="hasAnswer"
              checked={hasAnswer}
              onChange={(e) => setHasAnswer(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-900 border-gray-700 rounded focus:ring-blue-500"
            />
            <label htmlFor="hasAnswer" className="ml-2 text-sm text-gray-300">
              มีเฉลย
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
            >
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
