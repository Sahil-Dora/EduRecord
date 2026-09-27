import { supabase } from './supabase'
import type { Document, DocumentStatus, Student, RecordRow } from './types'

export interface DocumentWithRelations extends Document {
  students: Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'> | null
  records: Pick<RecordRow, 'id' | 'title'> | null
}

export interface DocumentFilters {
  search: string
  status: DocumentStatus | 'all'
  studentId: string | null
}

export async function fetchDocuments(filters?: DocumentFilters): Promise<DocumentWithRelations[]> {
  let query = supabase
    .from('documents')
    .select('*, students(id, first_name, last_name, student_number), records(id, title)')
    .order('created_at', { ascending: false })

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters?.studentId) {
    query = query.eq('student_id', filters.studentId)
  }

  if (filters?.search) {
    const term = filters.search.trim()
    query = query.or(`title.ilike.%${term}%,file_name.ilike.%${term}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function fetchDocumentById(id: string): Promise<DocumentWithRelations | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*, students(id, first_name, last_name, student_number), records(id, title)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchDocumentsByStudent(studentId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface DocumentUploadInput {
  student_id: string
  record_id: string | null
  document_type_id: string | null
  title: string
  expiry_date: string | null
}

export async function uploadDocument(
  file: File,
  input: DocumentUploadInput
): Promise<Document> {
  // Generate a unique path: students/{student_id}/documents/{uuid}/{filename}
  const { data: pathData } = await supabase.rpc('gen_random_uuid')
  const docId = pathData as string
  const filePath = `students/${input.student_id}/documents/${docId}/${file.name}`

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, file, { upsert: false })

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

  // Insert metadata row
  const { data, error } = await supabase
    .from('documents')
    .insert({
      student_id: input.student_id,
      record_id: input.record_id,
      document_type_id: input.document_type_id,
      title: input.title,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      status: 'pending',
      expiry_date: input.expiry_date,
    })
    .select()
    .single()

  if (error) {
    // Rollback: remove the uploaded file
    await supabase.storage.from('documents').remove([filePath])
    throw error
  }

  return data
}

export interface DocumentUpdateInput {
  title?: string
  record_id?: string | null
  document_type_id?: string | null
  status?: DocumentStatus
  expiry_date?: string | null
}

export async function updateDocument(
  id: string,
  input: DocumentUpdateInput
): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .update(input)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  // Fetch the document to get its file_path
  const { data: doc, error: fetchErr } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr) throw fetchErr
  if (!doc) throw new Error('Document not found')

  // Delete from storage
  const { error: storageErr } = await supabase.storage
    .from('documents')
    .remove([doc.file_path])

  if (storageErr) throw new Error(`Failed to delete file: ${storageErr.message}`)

  // Delete the metadata row
  const { error: dbErr } = await supabase.from('documents').delete().eq('id', id)
  if (dbErr) throw dbErr
}

export async function createSignedDownloadUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)

  if (error) throw new Error(`Failed to create download URL: ${error.message}`)
  if (!data?.signedUrl) throw new Error('Failed to create download URL')
  return data.signedUrl
}

export async function fetchStudentOptions(): Promise<Pick<Student, 'id' | 'first_name' | 'last_name' | 'student_number'>[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, first_name, last_name, student_number')
    .order('first_name', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function fetchRecordOptionsByStudent(
  studentId: string
): Promise<Pick<RecordRow, 'id' | 'title'>[]> {
  const { data, error } = await supabase
    .from('records')
    .select('id, title')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function fetchDocumentTypes(): Promise<{ id: string; name: string; code: string }[]> {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name, code')
    .order('name', { ascending: true })

  if (error) throw error
  return data ?? []
}
