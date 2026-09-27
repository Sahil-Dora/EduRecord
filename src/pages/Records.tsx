import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Spinner, EmptyState, ErrorState } from '../components/ui/Spinner'
import { RecordForm } from '../components/records/RecordForm'
import { useAuth } from '../context/AuthContext'
import {
  RECORD_TYPE_LABELS,
  RECORD_TYPE_COLORS,
  RECORD_STATUS_LABELS,
  RECORD_STATUS_COLORS,
} from '../lib/constants'
import { formatDate } from '../lib/utils'
import {
  fetchRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  type RecordFilters,
  type RecordInput,
  type RecordWithStudent,
} from '../lib/records'
import type { RecordRow, RecordType, RecordStatus } from '../lib/types'

const TYPE_OPTIONS: (RecordType | 'all')[] = ['all', 'enrollment', 'medical', 'academic', 'financial', 'other']
const STATUS_OPTIONS: (RecordStatus | 'all')[] = ['all', 'active', 'archived']

export function Records() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canEdit = profile?.role === 'admin' || profile?.role === 'staff'
  const canDelete = profile?.role === 'admin'

  const [records, setRecords] = useState<RecordWithStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RecordType | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RecordRow | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RecordWithStudent | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const filters: RecordFilters = {
        search,
        recordType: typeFilter,
        status: statusFilter,
        studentId: null,
      }
      const data = await fetchRecords(filters)
      setRecords(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load records')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  const handleAdd = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const handleEdit = (record: RecordWithStudent) => {
    setEditing(record)
    setFormOpen(true)
  }

  const handleSubmit = async (input: RecordInput) => {
    setSubmitting(true)
    try {
      if (editing) {
        await updateRecord(editing.id, input)
      } else {
        await createRecord(input)
      }
      setFormOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save record')
      setFormOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRecord(deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Records"
        description="Browse and manage student records."
        action={
          canEdit && (
            <Button onClick={handleAdd}>
              <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Record
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
            placeholder="Search by title or description"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as RecordType | 'all')}
          className="px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All Types' : RECORD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RecordStatus | 'all')}
          className="px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All Statuses' : RECORD_STATUS_LABELS[s]}
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
      ) : records.length === 0 ? (
        <Card>
          <EmptyState
            title={search || typeFilter !== 'all' || statusFilter !== 'all' ? 'No matching records' : 'No records yet'}
            description={
              search || typeFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : canEdit
                  ? 'Add your first record to get started.'
                  : 'Records will appear here once they are added.'
            }
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            action={
              canEdit && !search && typeFilter === 'all' && statusFilter === 'all' ? (
                <Button onClick={handleAdd}>Add Record</Button>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider hidden sm:table-cell">Created</th>
                  {canEdit && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {records.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => navigate(`/records/${record.id}`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-neutral-900 truncate">{record.title}</p>
                      <p className="text-xs text-neutral-500 truncate md:hidden">
                        {record.students ? `${record.students.first_name} ${record.students.last_name}` : '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden md:table-cell">
                      {record.students ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/students/${record.students!.id}`)
                          }}
                          className="text-primary-600 hover:text-primary-700 hover:underline"
                        >
                          {record.students.first_name} {record.students.last_name}
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={RECORD_TYPE_COLORS[record.record_type]}>
                        {RECORD_TYPE_LABELS[record.record_type]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={RECORD_STATUS_COLORS[record.status]}>
                        {RECORD_STATUS_LABELS[record.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral-600 hidden sm:table-cell">
                      {formatDate(record.created_at)}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(record)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                            aria-label="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(record)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:bg-red-50 hover:text-red-600 transition-colors"
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
          <div className="px-4 py-3 border-t border-neutral-100 text-xs text-neutral-500">
            {records.length} {records.length === 1 ? 'record' : 'records'}
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
        title={editing ? 'Edit Record' : 'Add Record'}
        description={editing ? 'Update record information.' : 'Create a new student record.'}
        size="lg"
      >
        <RecordForm
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
        title="Delete Record"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </PageContainer>
  )
}
