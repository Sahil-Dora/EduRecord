import type { UserRole, StudentStatus, RecordType, RecordStatus, DocumentStatus, ExtractionStatus, VerificationStatus, AlertStatus } from './types'

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  staff: 'Staff',
  viewer: 'Viewer',
}

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  graduated: 'Graduated',
  withdrawn: 'Withdrawn',
}

export const STUDENT_STATUS_COLORS: Record<StudentStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-neutral-100 text-neutral-600',
  graduated: 'bg-blue-100 text-blue-700',
  withdrawn: 'bg-red-100 text-red-700',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'Pending',
  analyzed: 'Analyzed',
  verified: 'Verified',
  rejected: 'Rejected',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  analyzed: 'bg-blue-100 text-blue-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  verified: 'Verified',
  rejected: 'Rejected',
  pending: 'Pending',
}

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  current: 'Current',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
  no_expiry: 'No Expiry',
}

export const ALERT_STATUS_COLORS: Record<AlertStatus, string> = {
  current: 'bg-green-100 text-green-700',
  expiring_soon: 'bg-amber-100 text-amber-700',
  expired: 'bg-red-100 text-red-700',
  no_expiry: 'bg-neutral-100 text-neutral-500',
}

export const EXTRACTION_STATUS_LABELS: Record<ExtractionStatus, string> = {
  not_started: 'Not Started',
  pending: 'Extracting...',
  complete: 'Extracted',
  error: 'Extraction Failed',
}

export const EXTRACTION_STATUS_COLORS: Record<ExtractionStatus, string> = {
  not_started: 'bg-neutral-100 text-neutral-600',
  pending: 'bg-amber-100 text-amber-700',
  complete: 'bg-green-100 text-green-700',
  error: 'bg-red-100 text-red-700',
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  enrollment: 'Enrollment',
  medical: 'Medical',
  academic: 'Academic',
  financial: 'Financial',
  other: 'Other',
}

export const RECORD_TYPE_COLORS: Record<RecordType, string> = {
  enrollment: 'bg-blue-100 text-blue-700',
  medical: 'bg-red-100 text-red-700',
  academic: 'bg-green-100 text-green-700',
  financial: 'bg-amber-100 text-amber-700',
  other: 'bg-neutral-100 text-neutral-600',
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  active: 'Active',
  archived: 'Archived',
}

export const RECORD_STATUS_COLORS: Record<RecordStatus, string> = {
  active: 'bg-green-100 text-green-700',
  archived: 'bg-neutral-100 text-neutral-500',
}

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: 'dashboard', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'Students', path: '/students', icon: 'students', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'Records', path: '/records', icon: 'records', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'Documents', path: '/documents', icon: 'documents', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'Smart Search', path: '/search', icon: 'search', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'Verification', path: '/verification', icon: 'verification', roles: ['admin', 'staff'] as UserRole[] },
  { label: 'Expiry Alerts', path: '/expiry', icon: 'expiry', roles: ['admin', 'staff', 'viewer'] as UserRole[] },
  { label: 'User Management', path: '/admin/users', icon: 'users', roles: ['admin'] as UserRole[] },
  { label: 'Audit History', path: '/admin/audit', icon: 'audit', roles: ['admin'] as UserRole[] },
  { label: 'Settings', path: '/settings', icon: 'settings', roles: ['admin'] as UserRole[] },
] as const
