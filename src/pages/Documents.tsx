import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, EmptyState, ErrorState } from '../components/ui/Spinner'
import { DocumentUploadForm } from '../components/documents/DocumentUploadForm'
import { useAuth } from '../context/AuthContext'
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '../lib/constants'
import { formatDate, formatFileSize } from '../lib/utils'
import {
  fetchDocuments,
  uploadDocument,
  deleteDocument,
  type DocumentFilters,
  type DocumentUploadInput,
  type DocumentWithRelations,
} from '../lib/documents'
import type { DocumentStatus } from '../lib/types'

const STATUS_OPTIONS: (DocumentStatus | 'all')[] = ['all', 'pending', 'analyzed', 'verified', 'rejected']

export function Documents() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [documents, setDocuments] = useState<DocumentWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | 'all'>('all')

  const [uploadOpen, setUploadOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<DocumentWithRelations | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: DocumentFilters = { search, status: statusFilter, studentId: null }
      const data = await fetchDocuments(filters)
      setDocuments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  const handleUpload = async (file: File, input: DocumentUploadInput) => {
    setSubmitting(true)
    try {
      await uploadDocument(file, input)
      setUploadOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document')
      setUploadOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDocument(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description="Browse and manage uploaded documents."
        action={
          canEdit && (
            <Button onClick={() => setUploadOpen(true)}>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Document
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
            placeholder="Search by title or filename"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | 'all')}
          className="px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : DOCUMENT_STATUS_LABELS[s]}
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
      ) : documents.length === 0 ? (
        <Card>
          <EmptyState
            title={search || statusFilter !== 'all' ? 'No matching documents' : 'No documents yet'}
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : canEdit
                  ? 'Upload your first document to get started.'
                  : 'Documents will appear here once they are uploaded.'
            }
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
            action={
              canEdit && !search && statusFilter === 'all' ? (
                <Button onClick={() => setUploadOpen(true)}>Upload Document</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden md:table-cell">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden sm:table-cell">File</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden sm:table-cell">Uploaded</th>
                  {canDelete && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900 truncate">{doc.title}</p>
                      <p className="text-xs text-neutral-500 truncate md:hidden">
                        {doc.students ? `${doc.students.first_name} ${doc.students.last_name}` : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                      {doc.students ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/students/${doc.students!.id}`)
                          }}
                          className="text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {doc.students.first_name} {doc.students.last_name}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <FileIcon mimeType={doc.mime_type} />
                        <span className="truncate max-w-[150px]">{doc.file_name}</span>
                        {doc.file_size && <span className="text-xs text-neutral-400">({formatFileSize(doc.file_size)})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={DOCUMENT_STATUS_COLORS[doc.status]}>
                        {DOCUMENT_STATUS_LABELS[doc.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden sm:table-cell">
                      {formatDate(doc.created_at)}
                    </td>
                    {canDelete && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteTarget(doc)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                          aria-label="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-neutral-100 text-xs text-neutral-500">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </div>
        </Card>
      )}

      {/* Upload Modal */}
      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Document"
        description="Upload a file and link it to a student."
        size="lg"
      >
        <DocumentUploadForm
          onSubmit={handleUpload}
          onCancel={() => setUploadOpen(false)}
          submitting={submitting}
        />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? The file will be permanently removed from storage. This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </PageContainer>
  )
}

function FileIcon({ mimeType }: { mimeType: string | null }) {
  const isImage = mimeType?.startsWith('image/')
  return (
    <svg className="h-4 w-4 text-neutral-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {isImage ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9-9 0 00-9-9z" />
      )}
    </svg>
  )
}
