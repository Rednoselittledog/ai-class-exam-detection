'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { DrawnField, Field } from '@/lib/types'
import FieldModal from './FieldModal'

interface Step2AnnotateProps {
  image: HTMLImageElement
  fields: DrawnField[]
  onFieldsChange: (fields: DrawnField[]) => void
}

export default function Step2Annotate({ image, fields, onFieldsChange }: Step2AnnotateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null)
  const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  // Undo/Redo history
  const [history, setHistory] = useState<DrawnField[][]>([fields])
  const [historyIndex, setHistoryIndex] = useState(0)

  // Zoom and Pan
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  // Canvas display size (scaled to fit container)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899']

  // Update fields and add to history
  const updateFieldsWithHistory = useCallback((newFields: DrawnField[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newFields)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    onFieldsChange(newFields)
  }, [history, historyIndex, onFieldsChange])

  // Undo function
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      onFieldsChange(history[newIndex])
    }
  }, [historyIndex, history, onFieldsChange])

  // Redo function
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      onFieldsChange(history[newIndex])
    }
  }, [historyIndex, history, onFieldsChange])

  // Zoom functions
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5))
  const handleZoomReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault()
        redo()
      }
      // Delete: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedFieldId) {
        e.preventDefault()
        handleDeleteField()
      }
      // Escape: Deselect
      if (e.key === 'Escape') {
        setSelectedFieldId(null)
        const updatedFields = fields.map(f => ({ ...f, selected: false }))
        onFieldsChange(updatedFields)
      }
      // Zoom: + and -
      if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        handleZoomIn()
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        handleZoomOut()
      }
      // Reset zoom: 0
      if (e.key === '0') {
        e.preventDefault()
        handleZoomReset()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, selectedFieldId, fields, onFieldsChange])

  // Mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)))
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [])

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0)

    fields.forEach((field, index) => {
      const [x1, y1, x2, y2] = field.location
      const color = colors[index % colors.length]

      // Draw rectangle
      ctx.strokeStyle = field.selected ? '#ffff00' : color
      ctx.lineWidth = field.selected ? 3 : 2
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1)

      // Fill with semi-transparent color
      ctx.fillStyle = color + '40'
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)

      // Draw badge
      const badgeSize = 24
      ctx.fillStyle = color
      ctx.fillRect(x1, y1 - badgeSize, badgeSize, badgeSize)
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index + 1), x1 + badgeSize / 2, y1 - badgeSize / 2)

      // Draw label
      ctx.fillStyle = color
      ctx.fillRect(x1 + badgeSize, y1 - badgeSize, ctx.measureText(field.name).width + 8, badgeSize)
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'left'
      ctx.fillText(field.name, x1 + badgeSize + 4, y1 - badgeSize / 2)
    })

    // Draw current rectangle being drawn with colored fill
    if (currentRect) {
      const nextColor = colors[fields.length % colors.length]

      // Fill with semi-transparent color
      ctx.fillStyle = nextColor + '30'
      ctx.fillRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h)

      // Border
      ctx.strokeStyle = nextColor
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      ctx.strokeRect(currentRect.x, currentRect.y, currentRect.w, currentRect.h)
      ctx.setLineDash([])
    }
  }, [image, fields, currentRect, colors])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    // Set actual canvas resolution to image size
    canvas.width = image.width
    canvas.height = image.height

    // Calculate display size to fit in container (max height ~500px to fit in viewport)
    const maxHeight = Math.min(500, window.innerHeight * 0.5)
    const maxWidth = container.clientWidth || 800

    const scaleWidth = maxWidth / image.width
    const scaleHeight = maxHeight / image.height
    const scale = Math.min(scaleWidth, scaleHeight, 1) // Don't scale up, only down

    setDisplaySize({
      width: image.width * scale,
      height: image.height * scale
    })

    redrawCanvas()
  }, [image])

  // Redraw when fields change
  useEffect(() => {
    redrawCanvas()
  }, [fields, currentRect])

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Pan with Space or Middle Mouse Button
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      return
    }

    const pos = getCanvasCoordinates(e)

    // Check if clicking on existing field
    const clickedField = fields.find(field => {
      const [x1, y1, x2, y2] = field.location
      return pos.x >= x1 && pos.x <= x2 && pos.y >= y1 && pos.y <= y2
    })

    if (clickedField) {
      setSelectedFieldId(clickedField.id)
      const updatedFields = fields.map(f => ({
        ...f,
        selected: f.id === clickedField.id
      }))
      onFieldsChange(updatedFields) // No history update for selection
      redrawCanvas()
    } else {
      setSelectedFieldId(null)
      const updatedFields = fields.map(f => ({ ...f, selected: false }))
      onFieldsChange(updatedFields) // No history update for selection
      setIsDrawing(true)
      setStartPos(pos)
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      })
      return
    }

    if (!isDrawing || !startPos) return

    const pos = getCanvasCoordinates(e)
    setCurrentRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      w: Math.abs(pos.x - startPos.x),
      h: Math.abs(pos.y - startPos.y)
    })
    redrawCanvas()
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (!isDrawing || !startPos) return

    const pos = getCanvasCoordinates(e)
    const x1 = Math.min(startPos.x, pos.x)
    const y1 = Math.min(startPos.y, pos.y)
    const x2 = Math.max(startPos.x, pos.x)
    const y2 = Math.max(startPos.y, pos.y)

    // Only create field if rectangle is large enough
    if (Math.abs(x2 - x1) > 10 && Math.abs(y2 - y1) > 10) {
      setEditingFieldId(null)
      setIsModalOpen(true)
      setCurrentRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 })
    }

    setIsDrawing(false)
    setStartPos(null)
  }

  const handleSaveField = (fieldData: Omit<Field, 'location'>) => {
    if (editingFieldId) {
      // Update existing field
      const updatedFields = fields.map(f =>
        f.id === editingFieldId ? { ...f, ...fieldData } : f
      )
      updateFieldsWithHistory(updatedFields)
    } else if (currentRect) {
      // Create new field
      const newField: DrawnField = {
        id: `field${fields.length + 1}`,
        ...fieldData,
        location: [
          currentRect.x,
          currentRect.y,
          currentRect.x + currentRect.w,
          currentRect.y + currentRect.h
        ]
      }
      updateFieldsWithHistory([...fields, newField])
      setCurrentRect(null)
    }

    setIsModalOpen(false)
    setEditingFieldId(null)
  }

  const handleEditField = () => {
    if (selectedFieldId) {
      setEditingFieldId(selectedFieldId)
      setIsModalOpen(true)
    }
  }

  const handleDeleteField = () => {
    if (selectedFieldId) {
      const updatedFields = fields.filter(f => f.id !== selectedFieldId)
      updateFieldsWithHistory(updatedFields)
      setSelectedFieldId(null)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-white">ขั้นตอนที่ 2: กำหนดฟิลด์บนภาพ</h2>

      <div className="flex gap-6">
        <div className="flex-1">
          <div className="mb-3 flex gap-2 items-center flex-wrap">
            <div className="flex gap-2">
              <button
                onClick={undo}
                disabled={historyIndex === 0}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-sm"
                title="Undo (Ctrl+Z)"
              >
                ↶ Undo
              </button>
              <button
                onClick={redo}
                disabled={historyIndex === history.length - 1}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors text-sm"
                title="Redo (Ctrl+Shift+Z)"
              >
                ↷ Redo
              </button>
              <span className="text-gray-400 text-sm flex items-center px-2">
                {historyIndex + 1} / {history.length}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-600"></div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleZoomOut}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                title="Zoom Out (-)"
              >
                −
              </button>
              <span className="text-gray-400 text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                title="Zoom In (+)"
              >
                +
              </button>
              <button
                onClick={handleZoomReset}
                className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                title="Reset (0)"
              >
                รีเซ็ต
              </button>
            </div>
          </div>
          <div
            ref={containerRef}
            className="border border-gray-700 rounded-lg bg-gray-900 overflow-hidden relative"
          >
            <div
              className="overflow-auto"
              style={{
                maxHeight: '500px',
                width: '100%'
              }}
            >
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: '0 0',
                  transition: isPanning ? 'none' : 'transform 0.1s',
                  width: displaySize.width || 'fit-content',
                  height: displaySize.height || 'fit-content'
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    setIsPanning(false)
                    setIsDrawing(false)
                  }}
                  className={`${isPanning ? 'cursor-grabbing' : 'cursor-crosshair'}`}
                  style={{
                    display: 'block',
                    width: displaySize.width || '100%',
                    height: displaySize.height || 'auto'
                  }}
                />
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            วาดฟิลด์: คลิกลาก | เลือก: คลิกที่ฟิลด์ | แพน: Shift+ลาก | ซูม: Ctrl+Scroll หรือ +/- | คีย์ลัด: Ctrl+Z (Undo), Ctrl+Shift+Z (Redo), Delete (ลบ), Esc (ยกเลิก), 0 (รีเซ็ตซูม)
          </p>
        </div>

        <div className="w-80 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h3 className="text-lg font-bold mb-4 text-white">รายการฟิลด์</h3>

          {selectedFieldId && (
            <div className="mb-4 flex gap-2">
              <button
                onClick={handleEditField}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm"
              >
                แก้ไข
              </button>
              <button
                onClick={handleDeleteField}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-500 text-sm"
              >
                ลบ
              </button>
            </div>
          )}

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {fields.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-8">ยังไม่มีฟิลด์</p>
            )}
            {fields.map((field, index) => (
              <div
                key={field.id}
                onClick={() => {
                  setSelectedFieldId(field.id)
                  const updatedFields = fields.map(f => ({
                    ...f,
                    selected: f.id === field.id
                  }))
                  onFieldsChange(updatedFields)
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  field.selected ? 'bg-gray-700 border-2 border-yellow-500' : 'bg-gray-900 border-2 border-transparent hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: colors[index % colors.length] }}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{field.name}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      ประเภท: {field.type} | มุม: {field.rotate}° | เฉลย: {field.has_answer ? 'ใช่' : 'ไม่'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FieldModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingFieldId(null)
          setCurrentRect(null)
        }}
        onSave={handleSaveField}
        initialData={editingFieldId ? fields.find(f => f.id === editingFieldId) : undefined}
      />
    </div>
  )
}
