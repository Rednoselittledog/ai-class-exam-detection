import { NextRequest, NextResponse } from 'next/server'

// Python API URL - use environment variable or default to localhost
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      )
    }

    // Call Python API
    const response = await fetch(`${PYTHON_API_URL}/detect-omr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image }),
    })

    if (!response.ok) {
      throw new Error(`Python API returned ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in detect-omr API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
