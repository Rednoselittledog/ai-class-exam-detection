import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// GET all submissions for an exam
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const examId = searchParams.get('exam_id')

    if (!examId) {
      return NextResponse.json(
        { error: 'exam_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching submissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new submission
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { exam_id, image_url, field_values, score, total } = body

    if (!exam_id || !image_url || !field_values) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        exam_id,
        image_url,
        field_values,
        score: score || 0,
        total: total || 0
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error creating submission:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
