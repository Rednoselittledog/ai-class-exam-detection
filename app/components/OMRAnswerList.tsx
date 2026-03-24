'use client'

import { useState, useEffect, useRef } from 'react'

interface Detection {
  class: string
  bbox: number[]
  conf: number
}

interface OMRAnswerListProps {
  answers: string[]
  onAnswersChange: (answers: string[]) => void
  onSelectedIndexChange?: (index: number | null) => void
  selectedIndex?: number | null
  detections?: Detection[]
  onHoverIndexChange?: (index: number | null) => void
  readOnly?: boolean
}

export default function OMRAnswerList({
  answers,
  onAnswersChange,
  onSelectedIndexChange,
  selectedIndex: controlledSelectedIndex,
  detections = [],
  onHoverIndexChange,
  readOnly = false
}: OMRAnswerListProps) {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Use controlled or uncontrolled state
  const selectedIndex = controlledSelectedIndex !== undefined ? controlledSelectedIndex : internalSelectedIndex
  const setSelectedIndex = onSelectedIndexChange || setInternalSelectedIndex

  // Notify parent about hover changes
  useEffect(() => {
    if (onHoverIndexChange) {
      onHoverIndexChange(hoverIndex)
    }
  }, [hoverIndex, onHoverIndexChange])

  // Handle click outside to deselect
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setSelectedIndex(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setSelectedIndex])

  // Handle ESC key to deselect
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedIndex(null)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [setSelectedIndex])

  // Handle Arrow Up/Down navigation
  useEffect(() => {
    const handleArrowKeys = (e: KeyboardEvent) => {
      if (selectedIndex === null || answers.length === 0) return

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        const newIndex = Math.max(0, selectedIndex - 1)
        setSelectedIndex(newIndex)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        const newIndex = Math.min(answers.length - 1, selectedIndex + 1)
        setSelectedIndex(newIndex)
      }
    }

    document.addEventListener('keydown', handleArrowKeys)
    return () => document.removeEventListener('keydown', handleArrowKeys)
  }, [selectedIndex, answers.length, setSelectedIndex])

  const handleRowClick = (index: number) => {
    if (readOnly) return
    setSelectedIndex(index)
  }

  const handleRowHover = (index: number | null) => {
    if (readOnly) return
    setHoverIndex(index)
  }

  const handleEdit = (index: number, newValue: string) => {
    if (readOnly) return
    const updated = [...answers]
    updated[index] = newValue.trim()
    onAnswersChange(updated)
  }

  const handleDelete = (index: number) => {
    if (readOnly) return
    const updated = answers.filter((_, i) => i !== index)
    onAnswersChange(updated)

    // Adjust selection after delete
    if (selectedIndex === index) {
      setSelectedIndex(null)
    } else if (selectedIndex !== null && selectedIndex > index) {
      setSelectedIndex(selectedIndex - 1)
    }
  }

  const handleAdd = () => {
    if (readOnly) return
    const updated = [...answers]

    // Insert after selected index, or at end if none selected
    const insertIndex = selectedIndex !== null ? selectedIndex + 1 : answers.length
    updated.splice(insertIndex, 0, '')

    onAnswersChange(updated)
    setSelectedIndex(insertIndex)
  }

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    if (readOnly) return
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (readOnly) return
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    if (readOnly) return
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const updated = [...answers]
    const [draggedItem] = updated.splice(draggedIndex, 1)
    updated.splice(dropIndex, 0, draggedItem)

    onAnswersChange(updated)
    setSelectedIndex(dropIndex)
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Get border width based on state
  const getBorderStyle = (index: number) => {
    const isSelected = selectedIndex === index
    const isHovered = hoverIndex === index

    if (isSelected) {
      return 'border-2 border-blue-500 shadow-lg shadow-blue-500/20'
    } else if (isHovered) {
      return 'border-2 border-purple-400 shadow-md shadow-purple-400/10'
    } else {
      return 'border border-gray-700'
    }
  }

  return (
    <div ref={listRef} className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h5 className="text-white font-semibold">เฉลยคำตอบ ({answers.length} ข้อ)</h5>
        {!readOnly && (
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded text-sm font-medium transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มข้อ
            {selectedIndex !== null && ` (หลังข้อ ${selectedIndex + 1})`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-gray-300 font-semibold w-16">ข้อ</th>
              <th className="px-3 py-2 text-left text-gray-300 font-semibold">คำตอบ</th>
              {detections.length > 0 && (
                <th className="px-3 py-2 text-center text-gray-300 font-semibold w-20">Conf</th>
              )}
              {!readOnly && (
                <>
                  <th className="px-3 py-2 text-center text-gray-300 font-semibold w-16">
                    <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </th>
                  <th className="px-3 py-2 text-center text-gray-300 font-semibold w-16">ลบ</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {answers.length === 0 ? (
              <tr>
                <td colSpan={readOnly ? 2 : 5} className="px-3 py-4 text-center text-gray-500">
                  {readOnly ? 'ไม่มีคำตอบ' : 'รอการตรวจจับ...'}
                </td>
              </tr>
            ) : (
              answers.map((ans, idx) => {
                const detection = detections[idx]
                const isDragging = draggedIndex === idx
                const isDragOver = dragOverIndex === idx

                return (
                  <tr
                    key={idx}
                    draggable={!readOnly}
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleRowClick(idx)}
                    onMouseEnter={() => handleRowHover(idx)}
                    onMouseLeave={() => handleRowHover(null)}
                    className={`
                      transition-all cursor-pointer
                      ${isDragging ? 'opacity-50' : ''}
                      ${isDragOver ? 'bg-blue-500/20' : 'hover:bg-gray-800/50'}
                      ${selectedIndex === idx ? 'bg-gray-800' : ''}
                    `}
                  >
                    <td className="px-3 py-2 text-gray-400">
                      <span className={selectedIndex === idx ? 'font-bold text-blue-400' : ''}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className={`rounded overflow-hidden ${getBorderStyle(idx)}`}>
                        <input
                          type="text"
                          value={ans}
                          onChange={(e) => handleEdit(idx, e.target.value)}
                          onFocus={() => handleRowClick(idx)}
                          placeholder="a, b, c, d"
                          readOnly={readOnly}
                          className={`
                            w-full px-3 py-1.5 bg-gray-800 text-white text-sm
                            focus:outline-none focus:ring-0
                            ${readOnly ? 'cursor-default' : ''}
                          `}
                        />
                      </div>
                    </td>
                    {detections.length > 0 && (
                      <td className="px-3 py-2 text-center">
                        {detection && (
                          <span className="text-xs text-gray-400 font-mono">
                            {detection.conf.toFixed(2)}
                          </span>
                        )}
                      </td>
                    )}
                    {!readOnly && (
                      <>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center cursor-grab active:cursor-grabbing">
                            <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(idx)
                            }}
                            className="px-2 py-1 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded text-xs font-medium transition-colors"
                          >
                            ✕
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Keyboard shortcuts hint */}
      {!readOnly && selectedIndex !== null && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-4">
          <span>💡 เคล็ดลับ:</span>
          <span>↑↓ เลื่อนเลือก</span>
          <span>ESC ยกเลิก</span>
          <span>ลากเพื่อย้าย</span>
        </div>
      )}
    </div>
  )
}
