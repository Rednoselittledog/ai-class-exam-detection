'use client'

import { useEffect, useRef, useState } from 'react'

interface Detection {
  class: string
  bbox: number[] // [x1, y1, x2, y2]
  conf: number
}

interface OMRImageWithOverlayProps {
  imageBase64: string
  detections: Detection[]
  selectedIndices?: number[]
  hoverIndex?: number | null
  showAllLabels: boolean
}

const OMRImageWithOverlay = ({
  imageBase64,
  detections,
  selectedIndices = [],
  hoverIndex = null,
  showAllLabels
}: OMRImageWithOverlayProps) => {
  const imageRef = useRef<HTMLImageElement>(null)
  const [scale, setScale] = useState(1)
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 })

  // Define colors for each class
  const colors: Record<string, string> = {
    'a': '#3b82f6',  // blue
    'b': '#10b981',  // green
    'c': '#f59e0b',  // yellow
    'd': '#ef4444',  // red
    'double': '#8b5cf6',  // purple
    'null': '#6b7280'   // gray
  }

  // Calculate scale when image loads
  useEffect(() => {
    const img = imageRef.current
    if (!img) return

    const handleLoad = () => {
      // Get original image dimensions from base64
      const tempImg = new Image()
      tempImg.onload = () => {
        setOriginalSize({ width: tempImg.width, height: tempImg.height })
        // Calculate scale based on displayed size vs original size
        const displayedWidth = img.offsetWidth
        const scaleRatio = displayedWidth / tempImg.width
        setScale(scaleRatio)
      }
      tempImg.src = imageBase64
    }

    if (img.complete) {
      handleLoad()
    } else {
      img.addEventListener('load', handleLoad)
      return () => img.removeEventListener('load', handleLoad)
    }
  }, [imageBase64])

  // Recalculate scale on window resize
  useEffect(() => {
    const handleResize = () => {
      const img = imageRef.current
      if (!img || !originalSize.width) return

      const displayedWidth = img.offsetWidth
      const scaleRatio = displayedWidth / originalSize.width
      setScale(scaleRatio)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [originalSize])

  // Determine which indices should be highlighted
  const highlightIndices = [...selectedIndices]
  if (hoverIndex !== null && !highlightIndices.includes(hoverIndex)) {
    highlightIndices.push(hoverIndex)
  }

  return (
    <div className="relative inline-block">
      {/* Original image without any labels */}
      <img
        ref={imageRef}
        src={imageBase64}
        alt="OMR Detection"
        className="w-full h-auto"
      />

      {/* Overlay labels */}
      {detections.map((det, i) => {
        const isHighlighted = highlightIndices.includes(i)
        const shouldShow = showAllLabels || isHighlighted

        if (!shouldShow) return null

        const [x1, y1, x2, y2] = det.bbox
        const width = (x2 - x1) * scale
        const height = (y2 - y1) * scale
        const left = x1 * scale
        const top = y1 * scale

        const color = colors[det.class] || '#ffffff'
        const borderWidth = isHighlighted ? 4 : 2

        return (
          <div
            key={i}
            className="absolute pointer-events-none transition-all duration-100"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`,
              border: `${borderWidth}px solid ${color}`,
              boxSizing: 'border-box'
            }}
          >
            {/* Label background and text */}
            <div
              className="absolute text-white text-xs font-medium px-1 whitespace-nowrap"
              style={{
                backgroundColor: color,
                top: '-20px',
                left: '0'
              }}
            >
              {det.class} ({det.conf.toFixed(2)})
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default OMRImageWithOverlay
