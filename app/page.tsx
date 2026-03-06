'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Exam } from '@/lib/types'

export default function Home() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-3">
            ระบบ OMR Exam Detection
          </h1>
          <p className="text-xl text-gray-400">
            ระบบตรวจข้อสอบ OMR อัตโนมัติด้วย AI
          </p>
        </div>

        {/* Create New Exam Button */}
        <div className="flex justify-center mb-10">
          <Link
            href="/setup"
            className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all font-medium text-lg shadow-lg hover:shadow-xl flex items-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            สร้างข้อสอบใหม่
          </Link>
        </div>

        {error && (
          <div className="bg-red-600/20 border border-red-600 text-red-400 px-4 py-3 rounded-lg mb-6">
            เกิดข้อผิดพลาด: {error}
          </div>
        )}

        {/* Exams Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-4">
            ข้อสอบทั้งหมด ({exams.length} ชุด)
          </h2>
        </div>

        {exams.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-12 text-center border border-gray-700">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg mb-4">ยังไม่มีข้อสอบในระบบ</p>
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
              <Link
                key={exam.id}
                href={`/exams/${exam.id}`}
                className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden hover:border-blue-500 transition-all cursor-pointer group"
              >
                {/* Exam Image Preview */}
                {exam.image_url && (
                  <div className="relative h-48 bg-gray-900">
                    <img
                      src={exam.image_url}
                      alt={exam.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}

                {/* Exam Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2 truncate group-hover:text-blue-400 transition-colors">
                    {exam.name}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>ขนาด: {exam.canvas_size[0]} × {exam.canvas_size[1]} px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>จำนวนฟิลด์: {Object.keys(exam.fields).length} ฟิลด์</span>
                    </div>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(exam.created_at!).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {/* Action Indicator */}
                  <div className="flex items-center gap-2 text-blue-400 font-medium group-hover:gap-3 transition-all">
                    <span>ดูรายละเอียด</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Features Section */}
        <div className="mt-16 bg-gray-800/50 rounded-lg p-8 border border-gray-700">
          <h3 className="text-2xl font-bold text-white mb-6 text-center">คุณสมบัติของระบบ</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h4 className="text-white font-semibold mb-2">ตรวจอัตโนมัติด้วย AI</h4>
              <p className="text-gray-400 text-sm">ใช้ YOLO และ Typhoon OCR ตรวจข้อสอบแม่นยำ</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="text-white font-semibold mb-2">รายงานคะแนนทันที</h4>
              <p className="text-gray-400 text-sm">ดูผลคะแนนและส่งออกเป็น Excel/CSV</p>
            </div>

            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
              </div>
              <h4 className="text-white font-semibold mb-2">เก็บข้อมูลบน Cloud</h4>
              <p className="text-gray-400 text-sm">ปลอดภัยด้วย Supabase</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
