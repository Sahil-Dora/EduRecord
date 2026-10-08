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
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS, EXTRACTION_STATUS_LABELS, EXTRACTION_STATUS_COLORS } from '../lib/constants'
import { formatDate, formatDateTime, formatFileSize } from '../lib/utils'
import {
  fetchDocumentById,
  updateDocument,
  deleteDocument,
  createSignedDownloadUrl,
  fetchRecordOptionsByStudent,
  fetchDocumentTypes,
  triggerExtraction,
  triggerAnalysis,
  triggerEmbeddings,
  fetchDocumentAnalyses,
  fetchDocumentChunks,
  type DocumentWithRelations,
  type DocumentUpdateInput,
  type ExtractionResponse,
} from '../lib/documents'
import type { DocumentAnalysis, DocumentChunk, DocumentStatus, ExtractionStatus, RecordRow } from '../lib/types'

const STATUSES: DocumentStatus[] = ['pending', 'analyzed', 'verified', 'rejected']
type RecordOption = Pick<RecordRow, 'id' | 'title'>
type ChunkRow = Omit<DocumentChunk, 'embedding'>

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
  const [extracting, setExtracting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [embedding, setEmbedding] = useState(false)
  const [analyses, setAnalyses] = useState<DocumentAnalysis[]>([])
  const [analysesLoading, setAnalysesLoading] = useState(false)
  const [chunks, setChunks] = useState<ChunkRow[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)

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

  const loadAnalyses = useCallback(async () => {
    if (!id) return
    setAnalysesLoading(true)
    try {
      const data = await fetchDocumentAnalyses(id)
      setAnalyses(data)
    } catch {
      setAnalyses([])
    } finally {
      setAnalysesLoading(false)
    }
  }, [id])

  const loadChunks = useCallback(async () => {
    if (!id) return
    setChunksLoading(true)
    try {
      const data = await fetchDocumentChunks(id)
      setChunks(data)
    } catch {
      setChunks([])
    } finally {
      setChunksLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (doc?.extraction_status === 'complete') {
      loadAnalyses()
      loadChunks()
    }
  }, [doc?.extraction_status, loadAnalyses, loadChunks])

  const openEdit = async () => {
    if (!doc) return
    setEditForm({
      title: doc.title,
      record_id: doc.record_id ?? '',
      document_type_id: doc.document_type_id ?? '',
      status: doc.status,
      expiry_date: doc.expiry_date ?? '',
    })
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

  const handleExtract = async () => {
    if (!doc || !id) return
    setExtracting(true)
    setError(null)
    try {
      const result: ExtractionResponse = await triggerExtraction(id)
      await load()
      if (result.success) {
        await loadAnalyses()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text')
      await load()
    } finally {
      setExtracting(false)
    }
  }

  const handleAnalyze = async () => {
    if (!doc || !id) return
    setAnalyzing(true)
    setError(null)
    try {
      await triggerAnalysis(id)
      await load()
      await loadAnalyses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze document')
      await load()
    } finally {
      setAnalyzing(false)
    }
  }

  const handleGenerateEmbeddings = async () => {
    if (!doc || !id) return
    setEmbedding(true)
    setError(null)
    try {
      await triggerEmbeddings(id)
      await loadChunks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate embeddings')
    } finally {
      setEmbedding(false)
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

  const analyzedRow = analyses.find((a) => a.summary)

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
              <Button variant="secondary" onClick={handleExtract} loading={extracting} disabled={doc.extraction_status === 'pending'}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {doc.extraction_status === 'complete' ? 'Re-extract Text' : 'Extract Text'}
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={handleAnalyze} loading={analyzing} disabled={doc.extraction_status !== 'complete'}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.5.8a2 2 0 11-3.536 0z" />
                </svg>
                Analyze with AI
              </Button>
            )}
            {canEdit && (
              <Button variant="secondary" onClick={handleGenerateEmbeddings} loading={embedding} disabled={doc.extraction_status !== 'complete'}>
                <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
                {chunks.length > 0 ? 'Rebuild Chunks' : 'Generate Chunks'}
              </Button>
            )}
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

          <Card>
            <CardHeader
              title="Text Extraction"
              action={
                <Badge className={EXTRACTION_STATUS_COLORS[doc.extraction_status]}>
                  {EXTRACTION_STATUS_LABELS[doc.extraction_status]}
                </Badge>
              }
            />
            <CardBody>
              {doc.extraction_error && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {doc.extraction_error}
                </div>
              )}

              {doc.extraction_status === 'not_started' && (
                <p className="text-sm text-neutral-500">
                  Text has not been extracted from this document yet.
                  {canEdit && ' Click "Extract Text" to start extraction.'}
                </p>
              )}

              {doc.extraction_status === 'pending' && (
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Spinner size="sm" />
                  Extraction is in progress...
                </div>
              )}

              {doc.extraction_status === 'error' && (
                <p className="text-sm text-neutral-500">
                  Extraction failed. {canEdit && 'You can retry by clicking "Extract Text" again.'}
                </p>
              )}

              {doc.extraction_status === 'complete' && (
                analysesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Spinner size="sm" />
                    Loading extracted text...
                  </div>
                ) : analyses.length === 0 ? (
                  <p className="text-sm text-neutral-500">Extraction completed but no text was found.</p>
                ) : (
                  <div className="space-y-3">
                    {analyses.filter((a) => a.extracted_text).map((analysis) => (
                      <div key={analysis.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-neutral-500">
                            Extracted {formatDateTime(analysis.created_at)}
                          </span>
                          {analysis.model_used && (
                            <span className="text-xs text-neutral-400">via {analysis.model_used}</span>
                          )}
                        </div>
                        {analysis.extracted_text ? (
                          <pre className="text-sm text-neutral-700 whitespace-pre-wrap break-words max-h-96 overflow-y-auto font-mono bg-white rounded border border-neutral-100 p-3">
                            {analysis.extracted_text}
                          </pre>
                        ) : (
                          <p className="text-sm text-neutral-400">No text content extracted.</p>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
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

          {analyzedRow && (
            <Card>
              <CardHeader title="AI Analysis" />
              <CardBody>
                <AnalysisResultCard analysis={analyzedRow} />
              </CardBody>
            </Card>
          )}

          {canEdit && doc.extraction_status === 'complete' && !analyzedRow && (
            <Card>
              <CardBody>
                <p className="text-sm text-neutral-500 mb-3">No AI analysis yet. Run analysis to get a summary, classification, and key fields.</p>
                <Button variant="secondary" onClick={handleAnalyze} loading={analyzing}>
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.5.8a2 2 0 11-3.536 0z" />
                  </svg>
                  Analyze with AI
                </Button>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="RAG Chunks"
              action={
                chunks.length > 0 ? (
                  <Badge className="bg-green-100 text-green-800">{chunks.length} chunks</Badge>
                ) : null
              }
            />
            <CardBody>
              <ChunksContent
                extractionStatus={doc.extraction_status}
                chunksLoading={chunksLoading}
                chunks={chunks}
                canEdit={canEdit}
                embedding={embedding}
                onGenerate={handleGenerateEmbeddings}
              />
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

function AnalysisResultCard({ analysis }: { analysis: DocumentAnalysis }) {
  const confidencePct = analysis.confidence_score !== null ? Math.round(analysis.confidence_score * 100) : null

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Summary</h4>
        <p className="text-sm text-neutral-800">{analysis.summary}</p>
      </div>

      {analysis.suggested_type && (
        <div>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Suggested Type</h4>
          <Badge className="bg-blue-100 text-blue-800">{analysis.suggested_type}</Badge>
        </div>
      )}

      {confidencePct !== null && (
        <div>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Confidence</h4>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 rounded-full bg-neutral-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary-500"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="text-sm text-neutral-600">{confidencePct}%</span>
          </div>
        </div>
      )}

      {analysis.key_fields && Object.keys(analysis.key_fields).length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Key Fields</h4>
          <dl className="grid grid-cols-1 gap-1">
            {Object.entries(analysis.key_fields).map(([key, value]) => (
              <div key={key} className="flex justify-between text-sm">
                <dt className="text-neutral-500 capitalize">{key.replace(/_/g, ' ')}</dt>
                <dd className="text-neutral-800 font-medium text-right">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {analysis.flags && analysis.flags.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">Flags</h4>
          <div className="flex flex-wrap gap-2">
            {analysis.flags.map((flag, i) => (
              <Badge
                key={i}
                className={
                  flag.includes('sensitive') ? 'bg-red-100 text-red-800'
                  : flag.includes('expired') ? 'bg-orange-100 text-orange-800'
                  : flag.includes('incomplete') ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-neutral-100 text-neutral-700'
                }
              >
                {flag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {analysis.model_used && (
        <div className="pt-2 border-t border-neutral-100">
          <p className="text-xs text-neutral-400">Analyzed via {analysis.model_used}</p>
        </div>
      )}
    </div>
  )
}

function ChunksContent({
  extractionStatus,
  chunksLoading,
  chunks,
  canEdit,
  embedding,
  onGenerate,
}: {
  extractionStatus: ExtractionStatus
  chunksLoading: boolean
  chunks: ChunkRow[]
  canEdit: boolean
  embedding: boolean
  onGenerate: () => void
}) {
  if (extractionStatus !== 'complete') {
    return <p className="text-sm text-neutral-500">Extract text first to generate chunks and embeddings.</p>
  }

  if (chunksLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Spinner size="sm" />
        Loading chunks...
      </div>
    )
  }

  if (chunks.length === 0) {
    return (
      <div>
        <p className="text-sm text-neutral-500 mb-3">No chunks generated yet. Generate chunks to build the RAG index for this document.</p>
        {canEdit && (
          <Button variant="secondary" onClick={onGenerate} loading={embedding}>
            <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            Generate Chunks
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {chunks.slice(0, 5).map((chunk) => (
        <div key={chunk.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-neutral-500">Chunk {chunk.chunk_index + 1}</span>
            <span className="text-xs text-neutral-400">{chunk.content.length} chars</span>
          </div>
          <p className="text-sm text-neutral-700" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{chunk.content}</p>
        </div>
      ))}
      {chunks.length > 5 && (
        <p className="text-xs text-neutral-400 text-center pt-1">
          + {chunks.length - 5} more chunks
        </p>
      )}
    </div>
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
