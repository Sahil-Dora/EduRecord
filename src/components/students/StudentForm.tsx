import { useState } from 'react'
import { Button } from '../ui/Button'
import { STUDENT_STATUS_LABELS } from '../../lib/constants'
import { checkStudentNumberUnique } from '../../lib/students'
import type { Student, StudentStatus } from '../../lib/types'
import type { StudentInput } from '../../lib/students'

interface StudentFormProps {
  initial?: Student
  onSubmit: (input: StudentInput) => Promise<void>
  onCancel: () => void
  submitting: boolean
}

const STATUSES: StudentStatus[] = ['active', 'inactive', 'graduated', 'withdrawn']

const GENDERS = ['', 'Male', 'Female', 'Other', 'Prefer not to say']

function fieldError(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required`
  return null
}

export function StudentForm({ initial, onSubmit, onCancel, submitting }: StudentFormProps) {
  const [form, setForm] = useState({
    student_number: initial?.student_number ?? '',
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    email: initial?.email ?? '',
    phone: initial?.phone ?? '',
    date_of_birth: initial?.date_of_birth ?? '',
    gender: initial?.gender ?? '',
    address: initial?.address ?? '',
    program: initial?.program ?? '',
    enrollment_date: initial?.enrollment_date ?? '',
    status: initial?.status ?? ('active' as StudentStatus),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [numberError, setNumberError] = useState<string | null>(null)

  const update = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: '' }))
    if (key === 'student_number') setNumberError(null)
  }

  const validate = async (): Promise<boolean> => {
    const e: Record<string, string> = {}
    const numErr = fieldError(form.student_number, 'Student number')
    if (numErr) e.student_number = numErr
    const fnErr = fieldError(form.first_name, 'First name')
    if (fnErr) e.first_name = fnErr
    const lnErr = fieldError(form.last_name, 'Last name')
    if (lnErr) e.last_name = lnErr
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      e.email = 'Invalid email format'
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return false

    if (form.student_number.trim()) {
      const isUnique = await checkStudentNumberUnique(
        form.student_number.trim(),
        initial?.id
      )
      if (!isUnique) {
        setNumberError('A student with this number already exists')
        return false
      }
    }

    return true
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const valid = await validate()
    if (!valid) return

    const input: StudentInput = {
      student_number: form.student_number.trim(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      address: form.address.trim() || null,
      program: form.program.trim() || null,
      enrollment_date: form.enrollment_date || null,
      status: form.status,
    }
    await onSubmit(input)
  }

  const inputClass = (key: string) =>
    `w-full rounded-xl px-3 py-2 text-sm transition-all neu-inset-sm ${
      errors[key]
        ? 'text-red-700 focus-visible:outline-red-500'
        : 'focus-visible:outline-primary-500'
    } focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Student Number" error={errors.student_number || numberError} required>
          <input
            type="text"
            value={form.student_number}
            onChange={(e) => update('student_number', e.target.value)}
            className={inputClass('student_number')}
            placeholder="e.g. STU-2026-001"
          />
        </Field>
        <Field label="Status" required>
          <select
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
            className={inputClass('status')}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STUDENT_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="First Name" error={errors.first_name} required>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => update('first_name', e.target.value)}
            className={inputClass('first_name')}
            placeholder="John"
          />
        </Field>
        <Field label="Last Name" error={errors.last_name} required>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => update('last_name', e.target.value)}
            className={inputClass('last_name')}
            placeholder="Doe"
          />
        </Field>
        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            className={inputClass('email')}
            placeholder="john.doe@school.edu"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            className={inputClass('phone')}
            placeholder="+1 555-0100"
          />
        </Field>
        <Field label="Date of Birth">
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => update('date_of_birth', e.target.value)}
            className={inputClass('date_of_birth')}
          />
        </Field>
        <Field label="Gender">
          <select
            value={form.gender}
            onChange={(e) => update('gender', e.target.value)}
            className={inputClass('gender')}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g || '—'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Program">
          <input
            type="text"
            value={form.program}
            onChange={(e) => update('program', e.target.value)}
            className={inputClass('program')}
            placeholder="e.g. Computer Science"
          />
        </Field>
        <Field label="Enrollment Date">
          <input
            type="date"
            value={form.enrollment_date}
            onChange={(e) => update('enrollment_date', e.target.value)}
            className={inputClass('enrollment_date')}
          />
        </Field>
      </div>
      <Field label="Address">
        <textarea
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          className={inputClass('address')}
          rows={2}
          placeholder="123 Main St, City, State 12345"
        />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {initial ? 'Save Changes' : 'Add Student'}
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
