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
  active: 'neu-inset-sm text-green-700',
  inactive: 'neu-inset-sm text-neutral-600',
  graduated: 'neu-inset-sm text-primary-700',
  withdrawn: 'neu-inset-sm text-red-700',
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  pending: 'Pending',
  analyzed: 'Analyzed',
  verified: 'Verified',
  rejected: 'Rejected',
}

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  pending: 'neu-inset-sm text-amber-700',
  analyzed: 'neu-inset-sm text-primary-700',
  verified: 'neu-inset-sm text-green-700',
  rejected: 'neu-inset-sm text-red-700',
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
  current: 'neu-inset-sm text-green-700',
  expiring_soon: 'neu-inset-sm text-amber-700',
  expired: 'neu-inset-sm text-red-700',
  no_expiry: 'neu-inset-sm text-neutral-500',
}

export const EXTRACTION_STATUS_LABELS: Record<ExtractionStatus, string> = {
  not_started: 'Not Started',
  pending: 'Extracting...',
  complete: 'Extracted',
  error: 'Extraction Failed',
}

export const EXTRACTION_STATUS_COLORS: Record<ExtractionStatus, string> = {
  not_started: 'neu-inset-sm text-neutral-600',
  pending: 'neu-inset-sm text-amber-700',
  complete: 'neu-inset-sm text-green-700',
  error: 'neu-inset-sm text-red-700',
}

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  enrollment: 'Enrollment',
  medical: 'Medical',
  academic: 'Academic',
  financial: 'Financial',
  other: 'Other',
}

export const RECORD_TYPE_COLORS: Record<RecordType, string> = {
  enrollment: 'neu-inset-sm text-primary-700',
  medical: 'neu-inset-sm text-red-700',
  academic: 'neu-inset-sm text-green-700',
  financial: 'neu-inset-sm text-amber-700',
  other: 'neu-inset-sm text-neutral-600',
}

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  active: 'Active',
  archived: 'Archived',
}

export const RECORD_STATUS_COLORS: Record<RecordStatus, string> = {
  active: 'neu-inset-sm text-green-700',
  archived: 'neu-inset-sm text-neutral-500',
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
