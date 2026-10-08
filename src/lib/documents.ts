import { supabase } from './supabase'
import type { Document, DocumentAnalysis, DocumentChunk, DocumentStatus, Student, RecordRow } from './types'

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

export interface ExtractionResponse {
  success: boolean
  document_id: string
  char_count: number
  extractor: string
}

export async function triggerExtraction(documentId: string): Promise<ExtractionResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) throw new Error('Not authenticated')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ document_id: documentId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error ?? `Extraction failed (${response.status})`)
  }

  const data = await response.json() as ExtractionResponse
  if (!data.success) throw new Error('Extraction did not succeed')
  return data
}

export async function fetchDocumentAnalyses(documentId: string): Promise<DocumentAnalysis[]> {
  const { data, error } = await supabase
    .from('document_analyses')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export interface AnalysisResponse {
  success: boolean
  document_id: string
  summary: string
  suggested_type: string
  key_fields: Record<string, string>
  flags: string[]
  confidence_score: number
  model_used: string
}

export async function triggerAnalysis(documentId: string): Promise<AnalysisResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-document`
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) throw new Error('Not authenticated')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ document_id: documentId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error ?? `Analysis failed (${response.status})`)
  }

  const data = await response.json() as AnalysisResponse
  if (!data.success) throw new Error('Analysis did not succeed')
  return data
}

export async function fetchDocumentChunks(documentId: string): Promise<Omit<DocumentChunk, 'embedding'>[]> {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('id, document_id, chunk_index, content, metadata, created_at')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })

  if (error) throw error
  return data ?? []
}

export interface EmbeddingResponse {
  success: boolean
  document_id: string
  chunk_count: number
  embedding_dim: number
  embedding_method: string
}

export async function triggerEmbeddings(documentId: string): Promise<EmbeddingResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-embeddings`
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token

  if (!accessToken) throw new Error('Not authenticated')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ document_id: documentId }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error ?? `Embedding generation failed (${response.status})`)
  }

  const data = await response.json() as EmbeddingResponse
  if (!data.success) throw new Error('Embedding generation did not succeed')
  return data
}
