'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Exam, Submission } from '@/lib/types'

export default function ExamDetailPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const [exam, setExam] = useState<Exam | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFieldOverlay, setShowFieldOverlay] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchExam()
    fetchSubmissions()
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

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`/api/submissions?exam_id=${examId}`)
      if (!response.ok) throw new Error('Failed to fetch submissions')
      const { data } = await response.json()
      setSubmissions(data || [])
    } catch (err) {
      console.error('Error fetching submissions:', err)
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/exams/${examId}`, {
        method: 'DELETE'
      })
      if (!response.ok) throw new Error('Failed to delete exam')
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleExport = (format: 'csv' | 'excel') => {
    window.open(`/api/submissions/export?exam_id=${examId}&format=${format}`, '_blank')
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

  const fieldsWithAnswer = fieldsArray.filter(f => f.has_answer === 1)
  const totalQuestions = fieldsWithAnswer.reduce((sum, field) => {
    const answer = exam.answer_key[field.id]
    return sum + (Array.isArray(answer) ? answer.length : 0)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Link href="/" className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
            ← กลับหน้าหลัก
          </Link>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500"
          >
            ลบข้อสอบ
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">รูปภาพข้อสอบ</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showFieldOverlay}
                  onChange={(e) => setShowFieldOverlay(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-300">แสดงฟิลด์</span>
              </label>
            </div>
            <img src={exam.image_url} alt={exam.name} className="w-full" />
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h1 className="text-2xl font-bold text-white mb-4">{exam.name}</h1>
              <p>ฟิลด์: {fieldsArray.length} | เฉลย: {fieldsWithAnswer.length}</p>
            </div>
            <Link
              href={`/exams/${examId}/test`}
              className="block w-full px-6 py-4 bg-green-600 text-white rounded-lg text-center text-lg"
            >
              🎯 ตรวจข้อสอบ
            </Link>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">ผลการตรวจ ({submissions.length})</h2>
            {submissions.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm"
                >
                  📄 Export CSV
                </button>
                <button
                  onClick={() => handleExport('excel')}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-sm"
                >
                  📊 Export Excel
                </button>
              </div>
            )}
          </div>
          {submissions.length === 0 ? (
            <p className="text-gray-400 text-center py-8">ยังไม่มีการตรวจ</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-3 px-2 text-left sticky left-0 bg-gray-800">#</th>
                    <th className="py-3 px-2 text-left">วันที่</th>
                    {/* Dynamic field columns */}
                    {fieldsArray.map((field) => (
                      <th key={field.id} className="py-3 px-2 text-left">
                        {field.name}
                        <br />
                        <span className="text-xs text-gray-500">({field.type})</span>
                      </th>
                    ))}
                    <th className="py-3 px-2 text-center">คะแนน</th>
                    <th className="py-3 px-2 text-center sticky right-0 bg-gray-800">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  {submissions.map((sub, i) => (
                    <tr key={sub.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                      <td className="py-3 px-2 text-center sticky left-0 bg-gray-800">{i + 1}</td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        {new Date(sub.created_at!).toLocaleDateString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      {/* Dynamic field values */}
                      {fieldsArray.map((field) => {
                        const value = sub.field_values[field.id]
                        let displayValue = ''

                        if (Array.isArray(value)) {
                          // OMR field - wrap array
                          displayValue = value.join(', ')
                        } else if (typeof value === 'string') {
                          // OCR field or parsed text
                          try {
                            const parsed = JSON.parse(value)
                            displayValue = parsed.text || value
                          } catch {
                            displayValue = value
                          }
                        } else {
                          displayValue = value ? String(value) : '-'
                        }

                        return (
                          <td key={field.id} className="py-3 px-2 max-w-xs">
                            <div className="break-words line-clamp-2" title={displayValue}>
                              {displayValue || '-'}
                            </div>
                          </td>
                        )
                      })}
                      <td className="py-3 px-2 text-center font-semibold">
                        {sub.score}/{sub.total}
                        <br />
                        <span className="text-xs text-gray-400">
                          ({sub.total > 0 ? ((sub.score / sub.total) * 100).toFixed(0) : 0}%)
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center sticky right-0 bg-gray-800">
                        <button
                          onClick={() => router.push(`/exams/${examId}/test?edit=${sub.id}`)}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500 text-xs"
                        >
                          ✏️ แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">ยืนยันการลบ</h3>
              <p className="text-gray-300 mb-6">ลบ "{exam.name}"?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg">
                  ยกเลิก
                </button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg">
                  ลบ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
