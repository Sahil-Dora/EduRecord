import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { PageContainer, PageHeader } from '../components/ui/PageHeader'
import { Card, CardBody } from '../components/ui/Card'
import { Spinner } from '../components/ui/Spinner'
import { ROLE_LABELS } from '../lib/constants'
import { supabase } from '../lib/supabase'

interface Stats {
  totalStudents: number
  totalDocuments: number
  pendingVerification: number
  expiringSoon: number
}

export function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadStats() {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const soonDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        const nowStr = now.toISOString()
        const soonStr = soonDate.toISOString()

        const [studentsRes, documentsRes, pendingRes, expiringRes] = await Promise.all([
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('documents').select('*', { count: 'exact', head: true }),
          supabase.from('documents').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .not('expiry_date', 'is', null)
            .gte('expiry_date', nowStr)
            .lte('expiry_date', soonStr),
        ])

        if (studentsRes.error) throw studentsRes.error
        if (documentsRes.error) throw documentsRes.error
        if (pendingRes.error) throw pendingRes.error
        if (expiringRes.error) throw expiringRes.error

        if (mounted) {
          setStats({
            totalStudents: studentsRes.count ?? 0,
            totalDocuments: documentsRes.count ?? 0,
            pendingVerification: pendingRes.count ?? 0,
            expiringSoon: expiringRes.count ?? 0,
          })
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load statistics')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadStats()
    return () => {
      mounted = false
    }
  }, [])

  const statCards = [
    { label: 'Total Students', value: stats?.totalStudents },
    { label: 'Total Documents', value: stats?.totalDocuments },
    { label: 'Pending Verification', value: stats?.pendingVerification },
    { label: 'Expiring Soon', value: stats?.expiringSoon },
  ]

  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Overview of your institution's records and documents."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardBody>
              <p className="text-sm text-neutral-500 mb-1">{stat.label}</p>
              {loading ? (
                <div className="py-1">
                  <Spinner size="sm" />
                </div>
              ) : error ? (
                <p className="text-3xl font-bold text-neutral-300">—</p>
              ) : (
                <p className="text-3xl font-bold text-neutral-900">{stat.value}</p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-neutral-800 mb-2">Welcome to EduRecord</h3>
          <p className="text-sm text-neutral-500">
            You are signed in as <span className="font-medium text-neutral-700">{profile?.full_name}</span> ({profile ? ROLE_LABELS[profile.role] : ''}).
            Use the navigation on the left to manage students, records, and documents.
          </p>
          {error && (
            <p className="text-sm text-red-600 mt-2">Statistics unavailable: {error}</p>
          )}
        </CardBody>
      </Card>
    </PageContainer>
  )
}
