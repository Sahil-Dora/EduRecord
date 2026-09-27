import { supabase } from './supabase'
import type { RecordRow, RecordType, RecordStatus, Student } from './types'

export interface RecordWithStudent extends RecordRow {
  students: Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'> | null
}

export interface RecordFilters {
  search: string
  recordType: RecordType | 'all'
  status: RecordStatus | 'all'
  studentId: string | null
}

export async function fetchRecords(filters?: RecordFilters): Promise<RecordWithStudent[]> {
  let query = supabase
    .from('records')
    .select('*, students(id, first_name, last_name, student_number)')
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.recordType && filters.recordType !== 'all') {
    query = query.eq('record_type', filters.recordType)
  }

  if (filters?.studentId) {
    query = query.eq('student_id', filters.studentId)
  }

  if (filters?.search) {
    const term = filters.search.trim()
    query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchRecordById(id: string): Promise<RecordWithStudent | null> {
  const { data, error } = await supabase
    .from('records')
    .select('*, students(id, first_name, last_name, student_number)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchRecordsByStudent(studentId: string): Promise<RecordRow[]> {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface RecordInput {
  student_id: string
  title: string
  record_type: RecordType
  description: string | null
  status: RecordStatus
}

export async function createRecord(input: RecordInput): Promise<RecordRow> {
  const { data, error } = await supabase
    .from('records')
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateRecord(id: string, input: Partial<RecordInput>): Promise<RecordRow> {
  const { data, error } = await supabase
    .from('records')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('records').delete().eq('id', id)
  if (error) throw error
}

export async function fetchStudentOptions(): Promise<Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'>[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_number')
    .order('first_name', { ascending: true })

  if (error) throw error
  return data ?? []
}
