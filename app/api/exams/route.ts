import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, canvas_size, fields, answer_key, image_url } = body

    // Validate required fields
    if (!name || !canvas_size || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: name, canvas_size, fields' },
        { status: 400 }
      )
    }

    // Insert exam (use insert instead of upsert for simplicity)
    const { data, error } = await supabase
      .from('exams')
      .insert({
        name,
        canvas_size,
        fields,
        answer_key: answer_key || {},
        image_url: image_url || null
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to save exam', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data },
      { status: 200 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    // Only fetch non-deleted exams (soft delete)
    const { data, error } = await supabase
      .from('exams')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch exams', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
