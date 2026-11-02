import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, EmptyState, ErrorState } from '../components/ui/Spinner'
import { StudentForm } from '../components/students/StudentForm'
import { useAuth } from '../context/AuthContext'
import { STUDENT_STATUS_LABELS, STUDENT_STATUS_COLORS } from '../lib/constants'
import { formatDate } from '../lib/utils'
import {
  fetchStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  type StudentFilters,
  type StudentInput,
} from '../lib/students'
import type { Student, StudentStatus } from '../lib/types'

const STATUS_OPTIONS: (StudentStatus | 'all')[] = [
  'all',
  'active',
  'inactive',
  'graduated',
  'withdrawn',
]

export function Students() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StudentStatus | 'all'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: StudentFilters = { search, status: statusFilter }
      const data = await fetchStudents(filters)
      setStudents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  const handleAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleEdit = (student: Student) => {
    setEditing(student)
    setFormOpen(true)
  }

  const handleSubmit = async (input: StudentInput) => {
    setSubmitting(true)
    try {
      if (editing) {
        await updateStudent(editing.id, input)
      } else {
        await createStudent(input)
      }
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save student'
      setError(msg)
      setFormOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteStudent(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Students"
        description="Manage student records and profiles."
        action={
          canEdit && (
            <Button onClick={handleAdd}>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Student
            </Button>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, Student Number, or Email"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl neu-inset-sm focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StudentStatus | 'all')}
          className="px-3 py-2 text-sm rounded-xl neu-inset-sm focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : STUDENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : students.length === 0 ? (
        <Card>
          <EmptyState
            title={search || statusFilter !== 'all' ? 'No matching students' : 'No students yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : canEdit
                  ? 'Add your first student to get started.'
                  : 'Students will appear here once they are added.'
            }
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            action={
              canEdit && !search && statusFilter === 'all' ? (
                <Button onClick={handleAdd}>Add Student</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200/60">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell">Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden lg:table-cell">Program</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden sm:table-cell">Enrolled</th>
                  {canEdit && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {students.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => navigate(`/students/${student.id}`)}
                    className="hover:bg-surface-light cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl neu-raised-sm text-primary-700 flex items-center justify-center text-sm font-semibold shrink-0">
                          {(student.first_name[0] ?? '') + (student.last_name[0] ?? '')}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">
                            {student.first_name} {student.last_name}
                          </p>
                          <p className="text-xs text-neutral-500 truncate">{student.email ?? 'No email'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                      {student.student_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden lg:table-cell">
                      {student.program ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={STUDENT_STATUS_COLORS[student.status]}>
                        {STUDENT_STATUS_LABELS[student.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden sm:table-cell">
                      {formatDate(student.enrollment_date)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(student)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:bg-surface-light hover:text-neutral-700 active:shadow-neu-inset-sm transition-all"
                            aria-label="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(student)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-red-600 active:shadow-neu-inset-sm transition-all"
                              aria-label="Delete"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-neutral-200/60 text-xs text-neutral-500">
            {students.length} {students.length === 1 ? 'student' : 'students'}
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        title={editing ? 'Edit Student' : 'Add Student'}
        description={editing ? 'Update student information.' : 'Create a new student record.'}
        size="lg"
      >
        <StudentForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setFormOpen(false)
            setEditing(null)
          }}
          submitting={submitting}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Student"
        message={`Are you sure you want to delete ${deleteTarget?.first_name} ${deleteTarget?.last_name}? This will also delete all related records and documents. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </PageContainer>
  )
}
