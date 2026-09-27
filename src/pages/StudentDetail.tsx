import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, ErrorState } from '../components/ui/Spinner'
import { StudentForm } from '../components/students/StudentForm'
import { useAuth } from '../context/AuthContext'
import { STUDENT_STATUS_LABELS, STUDENT_STATUS_COLORS } from '../lib/constants'
import { formatDate, formatDateTime } from '../lib/utils'
import {
  fetchStudentById,
  updateStudent,
  deleteStudent,
  type StudentInput,
} from '../lib/students'
import { fetchRecordsByStudent, deleteRecord as deleteStudentRecord } from '../lib/records'
import { RECORD_TYPE_LABELS, RECORD_TYPE_COLORS, RECORD_STATUS_LABELS, RECORD_STATUS_COLORS } from '../lib/constants'
import type { Student, RecordRow } from '../lib/types'

export function StudentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [studentRecords, setStudentRecords] = useState<RecordRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [recordDeleting, setRecordDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchStudentById(id)
      setStudent(data)
      if (!data) setError('Student not found')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const loadRecords = useCallback(async () => {
    if (!id) return
    setRecordsLoading(true)
    try {
      const data = await fetchRecordsByStudent(id)
      setStudentRecords(data)
    } catch {
      setStudentRecords([])
    } finally {
      setRecordsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const handleUpdate = async (input: StudentInput) => {
    setSubmitting(true)
    try {
      const updated = await updateStudent(id!, input)
      setStudent(updated)
      setEditOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteStudent(id!)
      navigate('/students')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </PageContainer>
    )
  }

  if (error || !student) {
    return (
      <PageContainer>
        <ErrorState
          message={error ?? 'Student not found'}
          onRetry={() => navigate('/students')}
        />
      </PageContainer>
    )
  }

  const fullName = `${student.first_name} ${student.last_name}`

  return (
    <PageContainer>
      <div className="mb-4">
        <button
          onClick={() => navigate('/students')}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Students
        </button>
      </div>

      <PageHeader
        title={fullName}
        description={`${student.student_number} — ${STUDENT_STATUS_LABELS[student.status]}`}
        action={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditOpen(true)}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
              {canDelete && (
                <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Records section */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader
              title="Student Records"
              description={`${studentRecords.length} ${studentRecords.length === 1 ? 'record' : 'records'}`}
              action={
                canEdit && (
                  <Button size="sm" variant="secondary" onClick={() => navigate('/records')}>
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add Record
                  </Button>
                )
              }
            />
            {recordsLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : studentRecords.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-neutral-500">No records for this student yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {studentRecords.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => navigate(`/records/${rec.id}`)}
                    className="flex items-center justify-between px-6 py-3 hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-900 truncate">{rec.title}</p>
                      <p className="text-xs text-neutral-500">{formatDate(rec.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <Badge className={RECORD_TYPE_COLORS[rec.record_type]}>
                        {RECORD_TYPE_LABELS[rec.record_type]}
                      </Badge>
                      <Badge className={RECORD_STATUS_COLORS[rec.status]}>
                        {RECORD_STATUS_LABELS[rec.status]}
                      </Badge>
                      {canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setRecordDeleting(true)
                            deleteStudentRecord(rec.id).then(() => loadRecords()).finally(() => setRecordDeleting(false))
                          }}
                          disabled={recordDeleting}
                          className="p-1 rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label="Delete record"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Profile card */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center px-6 py-6">
            <div className="h-20 w-20 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-2xl font-bold mb-3">
              {(student.first_name[0] ?? '') + (student.last_name[0] ?? '')}
            </div>
            <h2 className="text-lg font-semibold text-neutral-900">{fullName}</h2>
            <p className="text-sm text-neutral-500 mb-3">{student.student_number}</p>
            <Badge className={STUDENT_STATUS_COLORS[student.status]}>
              {STUDENT_STATUS_LABELS[student.status]}
            </Badge>
          </div>
        </Card>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Contact Information" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Email" value={student.email} />
                <DetailItem label="Phone" value={student.phone} />
                <DetailItem label="Address" value={student.address} full />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Academic Information" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Program" value={student.program} />
                <DetailItem label="Enrollment Date" value={formatDate(student.enrollment_date)} />
                <DetailItem label="Status" value={STUDENT_STATUS_LABELS[student.status]} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Personal Information" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Date of Birth" value={formatDate(student.date_of_birth)} />
                <DetailItem label="Gender" value={student.gender} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Created" value={formatDateTime(student.created_at)} />
                <DetailItem label="Last Updated" value={formatDateTime(student.updated_at)} />
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Student"
        description="Update student information."
        size="lg"
      >
        <StudentForm
          initial={student}
          onSubmit={handleUpdate}
          onCancel={() => setEditOpen(false)}
          submitting={submitting}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Student"
        message={`Are you sure you want to delete ${fullName}? This will also delete all related records and documents. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </PageContainer>
  )
}

function DetailItem({ label, value, full }: { label: string; value: string | null; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{label}</dt>
      <dd className="text-sm text-neutral-800 mt-0.5">{value ?? '—'}</dd>
    </div>
  )
}
