import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <main className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-white mb-4">
            ระบบ OMR Exam Detection
          </h1>
          <p className="text-xl text-gray-400">
            ระบบตั้งค่าและจัดการข้อสอบ OMR อย่างง่ายดาย
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Setup Card */}
          <Link href="/setup">
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group">
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                สร้างข้อสอบใหม่
              </h2>
              <p className="text-gray-400">
                อัปโหลดรูปภาพข้อสอบ กำหนดฟิลด์ และบันทึกข้อมูล
              </p>
              <div className="mt-4 text-blue-400 font-medium flex items-center gap-2">
                เริ่มต้น
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Exams List Card */}
          <Link href="/exams">
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 hover:border-green-500 transition-all cursor-pointer group">
              <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                รายการข้อสอบ
              </h2>
              <p className="text-gray-400">
                ดูและจัดการข้อสอบที่บันทึกไว้ทั้งหมด
              </p>
              <div className="mt-4 text-green-400 font-medium flex items-center gap-2">
                ดูรายการ
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Features */}
        <div className="mt-12 bg-gray-800/50 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-4">คุณสมบัติ</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">อัปโหลดง่าย</p>
                <p className="text-gray-400 text-sm">Drag & Drop หรือเลือกไฟล์</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">กำหนดฟิลด์</p>
                <p className="text-gray-400 text-sm">วาดและกำหนดค่าฟิลด์บนภาพ</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">บันทึก Cloud</p>
                <p className="text-gray-400 text-sm">เก็บข้อมูลบน Supabase</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
