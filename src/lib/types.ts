export type UserRole = 'admin' | 'staff' | 'viewer'

export type StudentStatus = 'active' | 'inactive' | 'graduated' | 'withdrawn'

export type RecordType = 'enrollment' | 'medical' | 'academic' | 'financial' | 'other'

export type RecordStatus = 'active' | 'archived'

export type DocumentStatus = 'pending' | 'analyzed' | 'verified' | 'rejected'

export type VerificationStatus = 'verified' | 'rejected' | 'pending'

export type AlertStatus = 'current' | 'expiring_soon' | 'expired' | 'no_expiry'

export type Profile = {
  id: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Student = {
  id: string
  student_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  address: string | null
  program: string | null
  enrollment_date: string | null
  status: StudentStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type RecordRow = {
  id: string
  student_id: string
  title: string
  record_type: RecordType
  description: string | null
  status: RecordStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DocumentType = {
  id: string
  name: string
  code: string
  description: string | null
  default_expiry_months: number | null
  created_at: string
}

export type Document = {
  id: string
  student_id: string
  record_id: string | null
  document_type_id: string | null
  title: string
  file_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  status: DocumentStatus
  expiry_date: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

export type DocumentAnalysis = {
  id: string
  document_id: string
  extracted_text: string | null
  summary: string | null
  key_fields: Record<string, unknown> | null
  suggested_type: string | null
  confidence_score: number | null
  flags: string[] | null
  model_used: string | null
  analyzed_by: string | null
  created_at: string
}

export type Verification = {
  id: string
  document_id: string
  status: VerificationStatus
  notes: string | null
  verified_by: string | null
  verified_at: string
}

export type ExpiryAlert = {
  id: string
  document_id: string
  expiry_date: string
  days_until_expiry: number | null
  alert_status: AlertStatus
  acknowledged: boolean
  acknowledged_by: string | null
  updated_at: string
}

export type AuditLog = {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type Setting = {
  id: string
  key: string
  value: unknown
  updated_by: string | null
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: {
          id?: string
          full_name: string
          role?: string
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: string
          avatar_url?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: Student
        Insert: {
          id?: string
          student_number: string
          first_name: string
          last_name: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          program?: string | null
          enrollment_date?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_number?: string
          first_name?: string
          last_name?: string
          email?: string | null
          phone?: string | null
          date_of_birth?: string | null
          gender?: string | null
          address?: string | null
          program?: string | null
          enrollment_date?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      records: {
        Row: RecordRow
        Insert: {
          id?: string
          student_id: string
          title: string
          record_type: string
          description?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          title?: string
          record_type?: string
          description?: string | null
          status?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: 'records_student_id_fkey', columns: ['student_id'], referencedRelation: 'students', referencedColumns: ['id'] }]
      }
      document_types: {
        Row: DocumentType
        Insert: {
          id?: string
          name: string
          code: string
          description?: string | null
          default_expiry_months?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          description?: string | null
          default_expiry_months?: number | null
          created_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: Document
        Insert: {
          id?: string
          student_id: string
          record_id?: string | null
          document_type_id?: string | null
          title: string
          file_path: string
          file_name: string
          file_size?: number | null
          mime_type?: string | null
          status?: string
          expiry_date?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          record_id?: string | null
          document_type_id?: string | null
          title?: string
          file_path?: string
          file_name?: string
          file_size?: number | null
          mime_type?: string | null
          status?: string
          expiry_date?: string | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: 'documents_student_id_fkey', columns: ['student_id'], referencedRelation: 'students', referencedColumns: ['id'] },
          { foreignKeyName: 'documents_record_id_fkey', columns: ['record_id'], referencedRelation: 'records', referencedColumns: ['id'] },
          { foreignKeyName: 'documents_document_type_id_fkey', columns: ['document_type_id'], referencedRelation: 'document_types', referencedColumns: ['id'] },
        ]
      }
      document_analyses: {
        Row: DocumentAnalysis
        Insert: {
          id?: string
          document_id: string
          extracted_text?: string | null
          summary?: string | null
          key_fields?: Record<string, unknown> | null
          suggested_type?: string | null
          confidence_score?: number | null
          flags?: string[] | null
          model_used?: string | null
          analyzed_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          extracted_text?: string | null
          summary?: string | null
          key_fields?: Record<string, unknown> | null
          suggested_type?: string | null
          confidence_score?: number | null
          flags?: string[] | null
          model_used?: string | null
          analyzed_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      verifications: {
        Row: Verification
        Insert: {
          id?: string
          document_id: string
          status: string
          notes?: string | null
          verified_by?: string | null
          verified_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          status?: string
          notes?: string | null
          verified_by?: string | null
          verified_at?: string
        }
        Relationships: []
      }
      expiry_alerts: {
        Row: ExpiryAlert
        Insert: {
          id?: string
          document_id: string
          expiry_date: string
          days_until_expiry?: number | null
          alert_status: string
          acknowledged?: boolean
          acknowledged_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          expiry_date?: string
          days_until_expiry?: number | null
          alert_status?: string
          acknowledged?: boolean
          acknowledged_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: AuditLog
        Insert: {
          id?: string
          actor_id?: string | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          actor_id?: string | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          metadata?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: Setting
        Insert: {
          id?: string
          key: string
          value: unknown
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          value?: unknown
          updated_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, {
      Row: Record<string, unknown>
      Relationships: []
    }>
    Functions: Record<string, {
      Args: Record<string, unknown>
      Returns: unknown
    }>
  }
}
