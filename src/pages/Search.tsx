import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Spinner, EmptyState, ErrorState } from '../components/ui/Spinner'
import { DOCUMENT_STATUS_LABELS, DOCUMENT_STATUS_COLORS } from '../lib/constants'
import { hybridSearch } from '../lib/search'
import type { HybridSearchResult, SearchMode } from '../lib/types'

const MODE_OPTIONS: { value: SearchMode; label: string; hint: string }[] = [
  { value: 'hybrid', label: 'Hybrid', hint: 'Vector + keyword (best of both)' },
  { value: 'vector', label: 'Vector', hint: 'Semantic similarity' },
  { value: 'keyword', label: 'Keyword', hint: 'Exact text match' },
]

export function Search() {
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<SearchMode>('hybrid')
  const [results, setResults] = useState<HybridSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const runSearch = useCallback(async (q: string, m: SearchMode) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setResults([])
      setError(null)
      setHasSearched(false)
      return
    }

    setLoading(true)
    setError(null)
    setHasSearched(true)

    try {
      const data = await hybridSearch(trimmed, m)
      setResults(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => runSearch(query, mode), 300)
    return () => clearTimeout(timer)
  }, [query, mode, runSearch])

  const activeMode = MODE_OPTIONS.find((m) => m.value === mode)

  return (
    <PageContainer>
      <PageHeader
        title="Smart Search"
        description="Search across documents using semantic vector similarity, keyword matching, or a hybrid of both."
      />

      {/* Search bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents by meaning or text…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl neu-inset-sm focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            autoFocus
          />
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className={
              'px-4 py-2 text-sm font-medium rounded-xl transition-all active:scale-[0.97] ' +
              (mode === opt.value
                ? 'neu-inset-sm text-primary-700'
                : 'neu-raised-sm text-neutral-600 hover:shadow-neu-raised')
            }
          >
            {opt.label}
          </button>
        ))}
        <span className="flex items-center text-xs text-neutral-500 ml-1">{activeMode?.hint}</span>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => runSearch(query, mode)} />
      ) : results.length === 0 ? (
        <Card>
          <EmptyState
            title={hasSearched ? 'No results found' : 'Search across your documents'}
            description={
              hasSearched
                ? 'Try different keywords or switch to hybrid mode for broader coverage.'
                : 'Type a query above to search document content with AI-powered semantic matching.'
            }
            icon={
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            {results.length} {results.length === 1 ? 'result' : 'results'} • ranked by {mode} relevance
          </p>
          {results.map((r) => (
            <SearchResultCard key={r.document_id} result={r} mode={mode} onOpen={() => navigate(`/documents/${r.document_id}`)} onStudent={() => navigate(`/students/${r.student_id}`)} />
          ))}
        </div>
      )}
    </PageContainer>
  )
}

function SearchResultCard({
  result,
  mode,
  onOpen,
  onStudent,
}: {
  result: HybridSearchResult
  mode: SearchMode
  onOpen: () => void
  onStudent: () => void
}) {
  const statusKey = (result.status in DOCUMENT_STATUS_LABELS ? result.status : 'pending') as keyof typeof DOCUMENT_STATUS_LABELS
  const rank = Math.round(result.combined_rank * 100)

  return (
    <Card className="p-5 hover:shadow-neu-raised transition-all cursor-pointer" >
      <div onClick={onOpen} className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 truncate">{result.title}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStudent()
                }}
                className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
              >
                {result.student_name} {result.student_number && `(${result.student_number})`}
              </button>
              <Badge className={DOCUMENT_STATUS_COLORS[statusKey]}>{DOCUMENT_STATUS_LABELS[statusKey]}</Badge>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <span className="text-xs font-semibold text-neutral-700">{rank}% match</span>
            {result.file_name && (
              <span className="text-xs text-neutral-400 truncate max-w-[120px]">{result.file_name}</span>
            )}
          </div>
        </div>

        {/* Matched chunk preview */}
        {result.matched_chunk && (
          <div className="neu-inset-sm rounded-xl px-3 py-2.5">
            <p className="text-xs text-neutral-600 line-clamp-3 leading-relaxed">{result.matched_chunk}</p>
          </div>
        )}

        {/* Score breakdown */}
        <div className="flex items-center gap-4 text-xs">
          <ScoreBar label="Similarity" value={result.similarity_score} show={mode !== 'keyword'} />
          <ScoreBar label="Keyword" value={result.keyword_score} show={mode !== 'vector'} />
        </div>
      </div>
    </Card>
  )
}

function ScoreBar({ label, value, show }: { label: string; value: number; show: boolean }) {
  if (!show) return null
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-neutral-400">{label}</span>
      <div className="w-16 h-1.5 rounded-full bg-neutral-200/60 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary-400 transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-neutral-500 font-medium tabular-nums">{pct}%</span>
    </div>
  )
}
