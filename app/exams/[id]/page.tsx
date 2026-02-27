'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Exam, Field } from '@/lib/types'

export default function ExamViewPage() {
  const params = useParams()
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

  const fetchExam = useCallback(async () => {
    try {
      const response = await fetch(`/api/exams/${params.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch exam')
      }
      const { data } = await response.json()
      setExam(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    fetchExam()
  }, [fetchExam])

  const drawCanvas = useCallback(() => {
    if (!exam || !exam.image_url) return

    const canvas = canvasRef.current
    if (!canvas) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Draw image
      ctx.drawImage(img, 0, 0)

      // Draw fields
      const fieldsArray = Object.entries(exam.fields)
      fieldsArray.forEach(([fieldId, field], index) => {
        const [x1, y1, x2, y2] = field.location
        const color = colors[index % colors.length]
        const isSelected = fieldId === selectedFieldId

        // Draw rectangle
        ctx.strokeStyle = isSelected ? '#ffff00' : color
        ctx.lineWidth = isSelected ? 3 : 2
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

        // Fill with semi-transparent color
        ctx.fillStyle = color + '40'
        ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

        // Draw badge with number
        const badgeSize = 24
        ctx.fillStyle = color
        ctx.fillRect(x1, y1 - badgeSize, badgeSize, badgeSize)
        ctx.fillStyle = '#ffffff'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(index + 1), x1 + badgeSize / 2, y1 - badgeSize / 2)

        // Draw label
        ctx.fillStyle = color
        const labelWidth = ctx.measureText(field.name).width + 8
        ctx.fillRect(x1 + badgeSize, y1 - badgeSize, labelWidth, badgeSize)
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'left'
        ctx.fillText(field.name, x1 + badgeSize + 4, y1 - badgeSize / 2)
      })
    }
    img.src = exam.image_url
  }, [exam, selectedFieldId, colors])

  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!exam) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    // Find clicked field
    const fieldsArray = Object.entries(exam.fields)
    const clickedField = fieldsArray.find(([_, field]) => {
      const [x1, y1, x2, y2] = field.location
      return x >= x1 && x <= x2 && y >= y1 && y <= y2
    })

    setSelectedFieldId(clickedField ? clickedField[0] : null)
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">เกิดข้อผิดพลาด: {error || 'ไม่พบข้อสอบ'}</div>
          <Link
            href="/exams"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
          >
            กลับไปหน้ารายการ
          </Link>
        </div>
      </div>
    )
  }

  const fieldsArray = Object.entries(exam.fields)

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/exams"
              className="text-blue-400 hover:text-blue-300 text-sm mb-2 inline-block"
            >
              ← กลับไปหน้ารายการ
            </Link>
            <h1 className="text-4xl font-bold text-white mb-2">
              {exam.name}
            </h1>
            <p className="text-gray-400">
              {fieldsArray.length} ฟิลด์ · {exam.canvas_size[0]} × {exam.canvas_size[1]} px
            </p>
          </div>
          <button
            onClick={() => router.push('/exams')}
            className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            ปิด
          </button>
        </div>

        {/* Content */}
        <div className="flex gap-6">
          {/* Canvas */}
          <div className="flex-1">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              {exam.image_url ? (
                <>
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="border border-gray-700 rounded-lg max-w-full h-auto bg-gray-900 cursor-pointer"
                  />
                  <p className="text-sm text-gray-400 mt-2">
                    คลิกที่ฟิลด์เพื่อดูรายละเอียด
                  </p>
                </>
              ) : (
                <div className="text-gray-400 text-center py-12">
                  ไม่มีรูปภาพ
                </div>
              )}
            </div>
          </div>

          {/* Fields List */}
          <div className="w-80">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-bold mb-4 text-white">
                รายการฟิลด์ ({fieldsArray.length})
              </h3>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {fieldsArray.length === 0 && (
                  <p className="text-gray-500 text-sm text-center py-8">ไม่มีฟิลด์</p>
                )}
                {fieldsArray.map(([fieldId, field], index) => (
                  <div
                    key={fieldId}
                    onClick={() => setSelectedFieldId(fieldId)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      fieldId === selectedFieldId
                        ? 'bg-gray-700 border-2 border-yellow-500'
                        : 'bg-gray-900 border-2 border-transparent hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{field.name}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          ประเภท: {field.type}
                        </p>
                        <p className="text-gray-400 text-xs">
                          มุม: {field.rotate}° | เฉลย: {field.has_answer ? 'ใช่' : 'ไม่'}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          [{field.location.join(', ')}]
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* JSON Export */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mt-4">
              <h3 className="text-sm font-bold mb-2 text-white">ข้อมูล JSON</h3>
              <button
                onClick={() => {
                  const json = JSON.stringify(exam, null, 2)
                  navigator.clipboard.writeText(json)
                  alert('คัดลอก JSON สำเร็จ!')
                }}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm"
              >
                คัดลอก JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
