import { DrawnField, AnswerKeyValue } from '@/lib/types'

/**
 * Convert a File object to base64 data URL
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Crop a field area from an image and return as base64 data URL
 */
export const cropFieldFromImage = async (
  imageBase64: string,
  field: DrawnField,
  canvasSize?: [number, number]
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // Set crossOrigin to allow canvas operations on images from different origins
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const [x1, y1, x2, y2] = field.location
        const width = x2 - x1
        const height = y2 - y1

        console.log('=== cropFieldFromImage ===')
        console.log('Field:', field.name, 'Type:', field.type)
        console.log('Rotation:', field.rotate)
        console.log('Location:', { x1, y1, x2, y2 })
        console.log('Crop size:', { width, height })
        console.log('Image size:', { imgWidth: img.width, imgHeight: img.height })

        // Create canvas for cropped image
        const canvas = document.createElement('canvas')

        // Adjust canvas size based on rotation
        if (field.rotate === 90 || field.rotate === 270) {
          canvas.width = height
          canvas.height = width
        } else {
          canvas.width = width
          canvas.height = height
        }

        console.log('Canvas size:', { canvasWidth: canvas.width, canvasHeight: canvas.height })

        const ctx = canvas.getContext('2d')!

        // Apply rotation transformation
        if (field.rotate !== 0) {
          console.log('Applying rotation:', field.rotate, 'degrees')
          // Move to center of canvas
          ctx.translate(canvas.width / 2, canvas.height / 2)
          // Rotate
          ctx.rotate((field.rotate * Math.PI) / 180)
          // Draw the cropped region centered
          // For any rotation, we draw the original dimensions centered
          ctx.drawImage(img, x1, y1, width, height, -width / 2, -height / 2, width, height)
          console.log('Drew with original dimensions centered')
        } else {
          console.log('No rotation needed')
          // No rotation - draw normally
          ctx.drawImage(img, x1, y1, width, height, 0, 0, width, height)
        }
        console.log('===========================')

        resolve(canvas.toDataURL('image/png'))
      } catch (error) {
        console.error('Error cropping image:', error)
        reject(error)
      }
    }

    img.onerror = (error) => {
      console.error('Error loading image:', error)
      reject(error)
    }

    img.src = imageBase64
  })
}

/**
 * Format answer value for display (handles both arrays and strings)
 */
export const formatAnswerForDisplay = (value: AnswerKeyValue): string => {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  if (typeof value === 'string') {
    // Try to parse JSON if it's OCR result format like {"text": "..."}
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && 'text' in parsed) {
        return parsed.text
      }
    } catch {
      // Not JSON, return as is
    }
    return value
  }
  // Handle objects (in case value is already parsed)
  if (value && typeof value === 'object' && 'text' in value) {
    return (value as any).text
  }
  return value ? String(value) : '-'
}

/**
 * Parse answer value from field based on field type
 */
export const parseAnswerValue = (
  value: string,
  fieldType: string
): AnswerKeyValue => {
  if (fieldType === 'ฝน') {
    // OMR field - parse comma-separated values
    return value.split(',').map(a => a.trim()).filter(Boolean)
  }
  // OCR field - return as string
  return value
}

/**
 * Compare two answers for equality (case-insensitive)
 */
export const compareAnswers = (
  answer1: string | undefined,
  answer2: string | undefined
): boolean => {
  if (!answer1 || !answer2) return false
  return answer1.toLowerCase() === answer2.toLowerCase()
}
