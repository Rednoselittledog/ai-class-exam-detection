import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { image, selectedDetectionIndices, showAllLabels } = await request.json()

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'No image provided' },
        { status: 400 }
      )
    }

    // Path to Python script
    const scriptPath = path.join(
      process.cwd(),
      'lib',
      'python',
      'omr_detect.py'
    )

    console.log('[DEBUG] Detecting OMR bubbles with YOLO')

    // Call Python script (reads from stdin)
    const result = await runPythonScript(scriptPath, image, selectedDetectionIndices, showAllLabels)

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

/**
 * Execute Python script and return result
 * Note: omr_detect.py reads from stdin (not command line args)
 */
function runPythonScript(
  scriptPath: string,
  imageData: string,
  selectedDetectionIndices?: number[],
  showAllLabels?: boolean
): Promise<any> {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath])

    let stdout = ''
    let stderr = ''

    // Prepare input data with optional selectedDetectionIndices and showAllLabels
    const inputData = JSON.stringify({
      image: imageData,
      selectedDetectionIndices: selectedDetectionIndices ?? [],
      showAllLabels: showAllLabels ?? false
    })

    // Write input data to stdin
    python.stdin.write(inputData)
    python.stdin.end()

    python.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    python.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    python.on('close', (code) => {
      // Log stderr for debugging
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
