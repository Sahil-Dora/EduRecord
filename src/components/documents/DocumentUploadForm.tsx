import { useState, useEffect, useRef } from 'react'
import { Button } from '../ui/Button'
import {
  fetchStudentOptions,
  fetchRecordOptionsByStudent,
  fetchDocumentTypes,
} from '../../lib/documents'
import type { Student, RecordRow } from '../../lib/types'
import type { DocumentUploadInput } from '../../lib/documents'

interface DocumentUploadFormProps {
  defaultStudentId?: string
  lockStudent?: boolean
  onSubmit: (file: File, input: DocumentUploadInput) => Promise<void>
  onCancel: () => void
  submitting: boolean
}

type StudentOption = Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'>
type RecordOption = Pick<RecordRow, 'id' | 'title'>

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function DocumentUploadForm({ defaultStudentId, lockStudent, onSubmit, onCancel, submitting }: DocumentUploadFormProps) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [records, setRecords] = useState<RecordOption[]>([])
  const [docTypes, setDocTypes] = useState<{ id: string; name: string; code: string }[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    student_id: defaultStudentId ?? '',
    record_id: '' as string,
    document_type_id: '' as string,
    title: '',
    expiry_date: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchStudentOptions()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false))
    fetchDocumentTypes()
      .then(setDocTypes)
      .catch(() => setDocTypes([]))
  }, [])

  useEffect(() => {
    if (form.student_id) {
      fetchRecordOptionsByStudent(form.student_id)
        .then(setRecords)
        .catch(() => setRecords([]))
    } else {
      setRecords([])
    }
  }, [form.student_id])

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setErrors((prev) => ({ ...prev, file: '' }))
    if (selected && !form.title) {
      setForm((f) => ({ ...f, title: selected.name.replace(/\.[^/.]+$/, '') }))
    }
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (!file) e.file = 'Please select a file'
    if (!form.student_id) e.student_id = 'Student is required'
    if (!form.title.trim()) e.title = 'Title is required'
    if (file && file.size > MAX_FILE_SIZE) e.file = 'File exceeds 50MB limit'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    await onSubmit(file!, {
      student_id: form.student_id,
      record_id: form.record_id || null,
      document_type_id: form.document_type_id || null,
      title: form.title.trim(),
      expiry_date: form.expiry_date || null,
    })
  }

  const inputClass = (key: string) =>
    `w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
      errors[key]
        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
        : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500'
    } focus:outline-none focus:ring-1`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File selection */}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          File <span className="text-red-500">*</span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center justify-center w-full rounded-lg border-2 border-dashed px-4 py-6 cursor-pointer transition-colors ${
            errors.file
              ? 'border-red-300 hover:border-red-400 bg-red-50'
              : 'border-neutral-300 hover:border-primary-400 hover:bg-neutral-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={submitting}
          />
          {file ? (
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-900">{file.name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{formatFileSize(file.size)}</p>
            </div>
          ) : (
            <div className="text-center">
              <svg className="h-8 w-8 mx-auto text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-neutral-600">Click to select a file</p>
              <p className="text-xs text-neutral-400 mt-0.5">PDF, images, documents — up to 50MB</p>
            </div>
          )}
        </div>
        {errors.file && <p className="mt-1 text-xs text-red-600">{errors.file}</p>}
      </div>

      <Field label="Student" error={errors.student_id} required>
        {lockStudent ? (
          <input
            type="text"
            value={students.find((s) => s.id === form.student_id)?.student_number ?? form.student_id}
            disabled
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm bg-neutral-50 text-neutral-500"
          />
        ) : (
          <select
            value={form.student_id}
            onChange={(e) => update('student_id', e.target.value)}
            className={inputClass('student_id')}
            disabled={studentsLoading}
          >
            <option value="">{studentsLoading ? 'Loading students...' : 'Select a student'}</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_number} — {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field label="Title" error={errors.title} required>
        <input
          type="text"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
          className={inputClass('title')}
          placeholder="Document title"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Linked Record (optional)">
          <select
            value={form.record_id}
            onChange={(e) => update('record_id', e.target.value)}
            className={inputClass('record_id')}
            disabled={!form.student_id}
          >
            <option value="">{form.student_id ? 'No linked record' : 'Select a student first'}</option>
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Document Type (optional)">
          <select
            value={form.document_type_id}
            onChange={(e) => update('document_type_id', e.target.value)}
            className={inputClass('document_type_id')}
          >
            <option value="">No type assigned</option>
            {docTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Expiry Date (optional)">
        <input
          type="date"
          value={form.expiry_date}
          onChange={(e) => update('expiry_date', e.target.value)}
          className={inputClass('expiry_date')}
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Upload Document
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
