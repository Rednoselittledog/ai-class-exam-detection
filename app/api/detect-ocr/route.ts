import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      )
    }

    const scriptPath = path.join(process.cwd(), 'lib', 'python', 'ocr_detect.py')

    const result = await runPythonScript(scriptPath, image)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in detect-ocr API:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function runPythonScript(scriptPath: string, imageData: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Pass TYPHOON_OCR env variable to Python
    const env = { ...process.env }

    const python = spawn('python3', [scriptPath, imageData], { env })

    let stdout = ''
    let stderr = ''

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      if (stderr) {
        console.log('Python stderr output:')
        console.log(stderr)
      }

      if (code !== 0) {
        reject(new Error(`Python script failed: ${stderr}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        resolve(result)
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`))
      }
    })

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })
  })
}
