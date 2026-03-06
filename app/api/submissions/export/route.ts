import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import ExcelJS from 'exceljs'

// GET - Export submissions to CSV or Excel
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get('exam_id')
    const format = searchParams.get('format') || 'csv' // csv or excel

    if (!examId) {
      return NextResponse.json(
        { error: 'exam_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Fetch exam data
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examId)
      .single()

    if (examError || !exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    // Fetch submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })

    if (submissionsError) {
      return NextResponse.json({ error: submissionsError.message }, { status: 500 })
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({ error: 'No submissions found' }, { status: 404 })
    }

    // Get fields with answers
    const fieldsWithAnswer = Object.entries(exam.fields)
      .filter(([_, field]: [string, any]) => field.has_answer === 1)
      .map(([id, field]: [string, any]) => ({ id, ...field }))

    if (format === 'excel') {
      return await exportToExcel(examId, exam, submissions, fieldsWithAnswer)
    } else {
      return exportToCSV(examId, exam, submissions, fieldsWithAnswer)
    }
  } catch (error) {
    console.error('Error exporting submissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Export to CSV
function exportToCSV(examId: string, exam: any, submissions: any[], fieldsWithAnswer: any[]) {
  // Build CSV header
  const headers = ['ลำดับ', 'วันที่', 'คะแนน', 'คะแนนเต็ม', 'เปอร์เซ็นต์']

  // Add field headers (student answer + correct answer)
  fieldsWithAnswer.forEach(field => {
    headers.push(`${field.name} (คำตอบ)`)
    headers.push(`${field.name} (เฉลย)`)
  })

  // Build CSV rows
  const rows = submissions.map((sub, index) => {
    const row = [
      (index + 1).toString(),
      new Date(sub.created_at).toLocaleDateString('th-TH'),
      sub.score.toString(),
      sub.total.toString(),
      sub.total > 0 ? ((sub.score / sub.total) * 100).toFixed(1) : '0'
    ]

    // Add field values
    fieldsWithAnswer.forEach(field => {
      const studentAnswer = sub.field_values[field.id]
      const correctAnswer = exam.answer_key[field.id]

      row.push(Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || '-')
      row.push(Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer || '-')
    })

    return row
  })

  // Combine into CSV string
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  // Add BOM for Thai characters
  const bom = '\uFEFF'
  const csvWithBom = bom + csvContent

  // Create safe filename
  const safeFilename = `exam_${examId}_submissions_${Date.now()}.csv`

  return new NextResponse(csvWithBom, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${safeFilename}"`
    }
  })
}

// Export to Excel
async function exportToExcel(examId: string, exam: any, submissions: any[], fieldsWithAnswer: any[]) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Submissions')

  // Build header row
  const headers = ['ลำดับ', 'วันที่', 'คะแนน', 'คะแนนเต็ม', 'เปอร์เซ็นต์']

  fieldsWithAnswer.forEach(field => {
    headers.push(`${field.name} (คำตอบ)`)
    headers.push(`${field.name} (เฉลย)`)
  })

  // Add header row with styling
  const headerRow = worksheet.addRow(headers)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }

  // Add data rows
  submissions.forEach((sub, index) => {
    const row = [
      index + 1,
      new Date(sub.created_at).toLocaleDateString('th-TH'),
      sub.score,
      sub.total,
      sub.total > 0 ? ((sub.score / sub.total) * 100).toFixed(1) : '0'
    ]

    fieldsWithAnswer.forEach(field => {
      const studentAnswer = sub.field_values[field.id]
      const correctAnswer = exam.answer_key[field.id]

      row.push(Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || '-')
      row.push(Array.isArray(correctAnswer) ? correctAnswer.join(', ') : correctAnswer || '-')
    })

    worksheet.addRow(row)
  })

  // Auto-fit columns
  worksheet.columns.forEach((column, index) => {
    let maxLength = 0
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10
      if (columnLength > maxLength) {
        maxLength = columnLength
      }
    })
    column.width = maxLength < 10 ? 10 : maxLength + 2
  })

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()

  // Create safe filename
  const safeFilename = `exam_${examId}_submissions_${Date.now()}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${safeFilename}"`
    }
  })
}
