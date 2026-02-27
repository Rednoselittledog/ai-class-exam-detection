'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Exam } from '@/lib/types'

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const response = await fetch('/api/exams')
      if (!response.ok) {
        throw new Error('Failed to fetch exams')
      }
      const { data } = await response.json()
      setExams(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirm({ id, name })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const response = await fetch(`/api/exams/${deleteConfirm.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete exam')
      }

      // Refresh the list
      setDeleteConfirm(null)
      fetchExams()
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการลบข้อสอบ: ' + (err instanceof Error ? err.message : 'Unknown error'))
      setDeleteConfirm(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">
              รายการข้อสอบ
            </h1>
            <p className="text-gray-400">
              ข้อสอบทั้งหมด {exams.length} ชุด
            </p>
          </div>
          <Link
            href="/setup"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
          >
            + สร้างข้อสอบใหม่
          </Link>
        </div>

        {error && (
          <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg mb-6">
            เกิดข้อผิดพลาด: {error}
          </div>
        )}

        {/* Exams Grid */}
        {exams.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <p className="text-gray-400 text-lg mb-4">ยังไม่มีข้อสอบ</p>
            <Link
              href="/setup"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
            >
              สร้างข้อสอบแรก
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
              >
                {/* Exam Image Preview */}
                {exam.image_url && (
                  <div className="relative h-48 bg-gray-900">
                    <img
                      src={exam.image_url}
                      alt={exam.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Exam Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 truncate">
                    {exam.name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <p>
                      ขนาดภาพ: {exam.canvas_size[0]} × {exam.canvas_size[1]} px
                    </p>
                    <p>
                      จำนวนฟิลด์: {Object.keys(exam.fields).length} ฟิลด์
                    </p>
                    <p className="text-xs text-gray-500">
                      สร้างเมื่อ: {new Date(exam.created_at!).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/exams/${exam.id}`}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors text-center text-sm font-medium"
                    >
                      ดูรายละเอียด
                    </Link>
                    <button
                      onClick={() => handleDeleteClick(exam.id!, exam.name)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 transition-colors text-sm font-medium"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 max-w-md w-full p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">ยืนยันการลบข้อสอบ</h3>
                  <p className="text-gray-300 mb-1">คุณต้องการลบข้อสอบนี้ใช่หรือไม่?</p>
                  <p className="text-white font-medium mb-4">"{deleteConfirm.name}"</p>
                  <p className="text-sm text-red-400 mb-6">
                    ⚠️ การกระทำนี้ไม่สามารถยกเลิกได้ ข้อมูลทั้งหมดจะถูกลบอย่างถาวร
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      ลบข้อสอบ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
