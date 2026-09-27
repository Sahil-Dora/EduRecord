import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, ErrorState } from '../components/ui/Spinner'
import { RecordForm } from '../components/records/RecordForm'
import { useAuth } from '../context/AuthContext'
import {
  RECORD_TYPE_LABELS,
  RECORD_TYPE_COLORS,
  RECORD_STATUS_LABELS,
  RECORD_STATUS_COLORS,
} from '../lib/constants'
import { formatDateTime } from '../lib/utils'
import {
  fetchRecordById,
  updateRecord,
  deleteRecord,
  type RecordInput,
  type RecordWithStudent,
} from '../lib/records'

export function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [record, setRecord] = useState<RecordWithStudent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRecordById(id)
      setRecord(data)
      if (!data) setError('Record not found')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load record')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleUpdate = async (input: RecordInput) => {
    setSubmitting(true)
    try {
      await updateRecord(id!, input)
      await load()
      setEditOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteRecord(id!)
      navigate('/records')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record')
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

  if (error || !record) {
    return (
      <PageContainer>
        <ErrorState
          message={error ?? 'Record not found'}
          onRetry={() => navigate('/records')}
        />
      </PageContainer>
    )
  }

  const studentName = record.students
    ? `${record.students.first_name} ${record.students.last_name}`
    : 'Unknown Student'

  return (
    <PageContainer>
      <div className="mb-4">
        <button
          onClick={() => navigate('/records')}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Records
        </button>
      </div>

      <PageHeader
        title={record.title}
        description={`${RECORD_TYPE_LABELS[record.record_type]} — ${RECORD_STATUS_LABELS[record.status]}`}
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
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Record Details" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Title" value={record.title} />
                <DetailItem label="Type" value={RECORD_TYPE_LABELS[record.record_type]} />
                <DetailItem label="Status" value={RECORD_STATUS_LABELS[record.status]} />
                <DetailItem label="Description" value={record.description} full />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Created" value={formatDateTime(record.created_at)} />
                <DetailItem label="Last Updated" value={formatDateTime(record.updated_at)} />
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Linked Student" />
            <CardBody>
              {record.students ? (
                <button
                  onClick={() => navigate(`/students/${record.students!.id}`)}
                  className="flex items-center gap-3 w-full text-left group"
                >
                  <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {(record.students.first_name[0] ?? '') + (record.students.last_name[0] ?? '')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                      {studentName}
                    </p>
                    <p className="text-xs text-neutral-500">{record.students.student_number}</p>
                  </div>
                </button>
              ) : (
                <p className="text-sm text-neutral-500">No student linked.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex flex-col gap-2">
                <Badge className={RECORD_TYPE_COLORS[record.record_type]}>
                  {RECORD_TYPE_LABELS[record.record_type]}
                </Badge>
                <Badge className={RECORD_STATUS_COLORS[record.status]}>
                  {RECORD_STATUS_LABELS[record.status]}
                </Badge>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Record"
        description="Update record information."
        size="lg"
      >
        <RecordForm
          initial={record}
          lockStudent
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
        title="Delete Record"
        message={`Are you sure you want to delete "${record.title}"? This action cannot be undone.`}
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
