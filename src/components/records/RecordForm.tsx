import { useState, useEffect } from 'react'
import { Button } from '../ui/Button'
import { RECORD_TYPE_LABELS, RECORD_STATUS_LABELS } from '../../lib/constants'
import { fetchStudentOptions } from '../../lib/records'
import type { RecordRow, RecordType, RecordStatus, Student } from '../../lib/types'
import type { RecordInput } from '../../lib/records'

interface RecordFormProps {
  initial?: RecordRow
  defaultStudentId?: string
  lockStudent?: boolean
  onSubmit: (input: RecordInput) => Promise<void>
  onCancel: () => void
  submitting: boolean
}

const RECORD_TYPES: RecordType[] = ['enrollment', 'medical', 'academic', 'financial', 'other']
const STATUSES: RecordStatus[] = ['active', 'archived']

type StudentOption = Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'>

export function RecordForm({ initial, defaultStudentId, lockStudent, onSubmit, onCancel, submitting }: RecordFormProps) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [form, setForm] = useState({
    student_id: initial?.student_id ?? defaultStudentId ?? '',
    title: initial?.title ?? '',
    record_type: initial?.record_type ?? ('enrollment' as RecordType),
    description: initial?.description ?? '',
    status: initial?.status ?? ('active' as RecordStatus),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchStudentOptions()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setStudentsLoading(false))
  }, [])

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const e: Record<string, string> = {}
    if (!form.student_id) e.student_id = 'Student is required'
    if (!form.title.trim()) e.title = 'Title is required'
    setErrors(e)
    if (Object.keys(e).length > 0) return

    await onSubmit({
      student_id: form.student_id,
      title: form.title.trim(),
      record_type: form.record_type,
      description: form.description.trim() || null,
      status: form.status,
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
          placeholder="e.g. Enrollment Form 2026"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Record Type" required>
          <select
            value={form.record_type}
            onChange={(e) => update('record_type', e.target.value)}
            className={inputClass('record_type')}
          >
            {RECORD_TYPES.map((t) => (
              <option key={t} value={t}>
                {RECORD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status" required>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            className={inputClass('status')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {RECORD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          className={inputClass('description')}
          rows={3}
          placeholder="Optional notes about this record..."
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? 'Save Changes' : 'Add Record'}
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
