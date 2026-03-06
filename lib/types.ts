export type FieldType = 'ฝน' | 'ข้อเขียน'
export type RotationDegree = 0 | 90 | 180 | 270

export interface Field {
  type: FieldType
  name: string
  rotate: RotationDegree
  location: [number, number, number, number] // [x1, y1, x2, y2]
  has_answer: 0 | 1
}

export interface ExamFields {
  [key: string]: Field
}

// Answer key types
export type AnswerKeyValue = string[] | string 
export interface Exam {
  id?: string
  name: string
  canvas_size: [number, number]
  fields: ExamFields
  answer_key: Record<string, AnswerKeyValue> // field_id -> answer(s)
  image_url?: string
  created_at?: string
  updated_at?: string
}

export interface DrawnField extends Field {
  id: string
  selected?: boolean
}

// Submission types
export interface Submission {
  id?: string
  exam_id: string
  image_url: string
  field_values: Record<string, AnswerKeyValue> // field_id -> student's answer(s)
  score: number // OMR score only
  total: number // Total possible score
  created_at?: string
  updated_at?: string
}
