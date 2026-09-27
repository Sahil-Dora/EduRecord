import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, ErrorState } from '../components/ui/Spinner'
import { useAuth } from '../context/AuthContext'
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '../lib/constants'
import { formatDate, formatDateTime, formatFileSize } from '../lib/utils'
import {
  fetchDocumentById,
  updateDocument,
  deleteDocument,
  createSignedDownloadUrl,
  fetchRecordOptionsByStudent,
  fetchDocumentTypes,
  type DocumentWithRelations,
  type DocumentUpdateInput,
} from '../lib/documents'
import type { DocumentStatus, RecordRow } from '../lib/types'

const STATUSES: DocumentStatus[] = ['pending', 'analyzed', 'verified', 'rejected']
type RecordOption = Pick<RecordRow, 'id' | 'title'>

export function DocumentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [doc, setDoc] = useState<DocumentWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // Edit form state
  const [records, setRecords] = useState<RecordOption[]>([])
  const [docTypes, setDocTypes] = useState<{ id: string; name: string }[]>([])
  const [editForm, setEditForm] = useState({
    title: '',
    record_id: '',
    document_type_id: '',
    status: 'pending' as DocumentStatus,
    expiry_date: '',
  })

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchDocumentById(id)
      setDoc(data)
      if (!data) setError('Document not found')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const openEdit = async () => {
    if (!doc) return
    setEditForm({
      title: doc.title,
      record_id: doc.record_id ?? '',
      document_type_id: doc.document_type_id ?? '',
      status: doc.status,
      expiry_date: doc.expiry_date ?? '',
    })
    // Load records for this student and doc types
    fetchRecordOptionsByStudent(doc.student_id).then(setRecords).catch(() => setRecords([]))
    fetchDocumentTypes().then((types) => setDocTypes(types.map((t) => ({ id: t.id, name: t.name })))).catch(() => setDocTypes([]))
    setEditOpen(true)
  }

  const handleUpdate = async () => {
    if (!doc || !id) return
    setSubmitting(true)
    try {
      const input: DocumentUpdateInput = {
        title: editForm.title.trim(),
        record_id: editForm.record_id || null,
        document_type_id: editForm.document_type_id || null,
        status: editForm.status,
        expiry_date: editForm.expiry_date || null,
      }
      await updateDocument(id, input)
      await load()
      setEditOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update document')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteDocument(id!)
      navigate('/documents')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
      setDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async () => {
    if (!doc) return
    setDownloading(true)
    try {
      const url = await createSignedDownloadUrl(doc.file_path)
      window.open(url, '_blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download document')
    } finally {
      setDownloading(false)
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

  if (error || !doc) {
    return (
      <PageContainer>
        <ErrorState message={error ?? 'Document not found'} onRetry={() => navigate('/documents')} />
      </PageContainer>
    )
  }

  const studentName = doc.students
    ? `${doc.students.first_name} ${doc.students.last_name}`
    : 'Unknown Student'

  return (
    <PageContainer>
      <div className="mb-4">
        <button
          onClick={() => navigate('/documents')}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Documents
        </button>
      </div>

      <PageHeader
        title={doc.title}
        description={`${doc.file_name} — ${DOCUMENT_STATUS_LABELS[doc.status]}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleDownload} loading={downloading}>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download
            </Button>
            {canEdit && (
              <Button variant="secondary" onClick={openEdit}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader title="Document Details" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Title" value={doc.title} />
                <DetailItem label="Status" value={DOCUMENT_STATUS_LABELS[doc.status]} />
                <DetailItem label="File Name" value={doc.file_name} />
                <DetailItem label="File Size" value={doc.file_size ? formatFileSize(doc.file_size) : null} />
                <DetailItem label="MIME Type" value={doc.mime_type} />
                <DetailItem label="Expiry Date" value={formatDate(doc.expiry_date)} />
                <DetailItem label="Linked Record" value={doc.records?.title ?? null} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Metadata" />
            <CardBody>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailItem label="Uploaded" value={formatDateTime(doc.created_at)} />
                <DetailItem label="Last Updated" value={formatDateTime(doc.updated_at)} />
              </dl>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Linked Student" />
            <CardBody>
              {doc.students ? (
                <button
                  onClick={() => navigate(`/students/${doc.students!.id}`)}
                  className="flex items-center gap-3 w-full text-left group"
                >
                  <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-semibold shrink-0">
                    {(doc.students.first_name[0] ?? '') + (doc.students.last_name[0] ?? '')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 group-hover:text-primary-600 transition-colors">
                      {studentName}
                    </p>
                    <p className="text-xs text-neutral-500">{doc.students.student_number}</p>
                  </div>
                </button>
              ) : (
                <p className="text-sm text-neutral-500">No student linked.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Badge className={DOCUMENT_STATUS_COLORS[doc.status]}>
                {DOCUMENT_STATUS_LABELS[doc.status]}
              </Badge>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Document"
        description="Update document metadata."
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Linked Record</label>
              <select
                value={editForm.record_id}
                onChange={(e) => setEditForm((f) => ({ ...f, record_id: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
              >
                <option value="">No linked record</option>
                {records.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Document Type</label>
              <select
                value={editForm.document_type_id}
                onChange={(e) => setEditForm((f) => ({ ...f, document_type_id: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
              >
                <option value="">No type assigned</option>
                {docTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as DocumentStatus }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{DOCUMENT_STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Expiry Date</label>
              <input
                type="date"
                value={editForm.expiry_date}
                onChange={(e) => setEditForm((f) => ({ ...f, expiry_date: e.target.value }))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdate} loading={submitting}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${doc.title}"? The file will be permanently removed from storage. This action cannot be undone.`}
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
