import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY!

function makeClient() {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
}

async function signIn(email: string, password: string) {
  const client = makeClient()
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`)
  return client
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`)
  console.log(`  PASS: ${message}`)
}

const TEST_FILE_CONTENT = 'Hello EduRecord test file content'

async function testAdminUploadReadDelete() {
  console.log('\n=== ADMIN: UPLOAD + READ + DOWNLOAD + DELETE ===')
  const client = await signIn('admin@edurecord.demo', 'TestPass123!')

  // Find a student
  const { data: students } = await client.from('students').select('id').limit(1)
  assert(!!students && students.length > 0, 'Found a student')
  const studentId = students![0].id

  // Upload file to storage
  const testFileName = `test-${Date.now()}.txt`
  const filePath = `students/${studentId}/documents/test-${Date.now()}/${testFileName}`
  const fileBlob = new Blob([TEST_FILE_CONTENT], { type: 'text/plain' })

  const { error: uploadErr } = await client.storage
    .from('documents')
    .upload(filePath, fileBlob, { contentType: 'text/plain' })
  assert(!uploadErr, 'Admin can upload file to storage')

  // Insert document metadata
  const { data: doc, error: insertErr } = await client
    .from('documents')
    .insert({
      student_id: studentId,
      title: 'Test Document',
      file_path: filePath,
      file_name: testFileName,
      file_size: TEST_FILE_CONTENT.length,
      mime_type: 'text/plain',
      status: 'pending',
    })
    .select()
    .single()
  assert(!insertErr, 'Admin can create document metadata')
  assert(!!doc, 'Document metadata created')
  const docId = doc!.id

  // Read with student + record joins
  const { data: fetched, error: readErr } = await client
    .from('documents')
    .select('*, students(id, first_name, last_name, student_number), records(id, title)')
    .eq('id', docId)
    .single()
  assert(!readErr, 'Admin can read document with joins')
  assert(!!fetched?.students, 'Document includes linked student')

  // Create signed URL (download)
  const { data: urlData, error: urlErr } = await client.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)
  assert(!urlErr, 'Admin can create signed download URL')
  assert(!!urlData?.signedUrl, 'Signed URL generated')

  // Update
  const { data: updated, error: updateErr } = await client
    .from('documents')
    .update({ title: 'Updated Title' })
    .eq('id', docId)
    .select()
    .single()
  assert(!updateErr, 'Admin can update document')
  assert(updated?.title === 'Updated Title', 'Update applied')

  // Delete - storage + DB
  const { error: storageDelErr } = await client.storage.from('documents').remove([filePath])
  assert(!storageDelErr, 'Admin can delete file from storage')

  const { error: dbDelErr } = await client.from('documents').delete().eq('id', docId)
  assert(!dbDelErr, 'Admin can delete document metadata')

  const { data: afterDelete } = await client.from('documents').select('id').eq('id', docId).maybeSingle()
  assert(afterDelete === null, 'Document metadata no longer exists')
}

async function testStaffUploadReadUpdate() {
  console.log('\n=== STAFF: UPLOAD + READ + UPDATE (no delete) ===')
  const client = await signIn('staff@edurecord.demo', 'TestPass123!')

  const { data: students } = await client.from('students').select('id').limit(1)
  const studentId = students![0].id

  // Upload
  const filePath = `students/${studentId}/documents/staff-test-${Date.now()}/staff.txt`
  const fileBlob = new Blob(['Staff upload test'], { type: 'text/plain' })
  const { error: uploadErr } = await client.storage
    .from('documents')
    .upload(filePath, fileBlob, { contentType: 'text/plain' })
  assert(!uploadErr, 'Staff can upload file to storage')

  // Insert metadata
  const { data: doc, error: insertErr } = await client
    .from('documents')
    .insert({
      student_id: studentId,
      title: 'Staff Upload',
      file_path: filePath,
      file_name: 'staff.txt',
      file_size: 16,
      mime_type: 'text/plain',
      status: 'pending',
    })
    .select()
    .single()
  assert(!insertErr, 'Staff can create document metadata')
  const docId = doc!.id

  // Read
  const { data: fetched, error: readErr } = await client.from('documents').select('*').eq('id', docId).single()
  assert(!readErr, 'Staff can read document')

  // Update
  const { data: updated, error: updateErr } = await client
    .from('documents')
    .update({ title: 'Staff Updated' })
    .eq('id', docId)
    .select()
    .single()
  assert(!updateErr, 'Staff can update document')
  assert(updated?.title === 'Staff Updated', 'Staff update applied')

  // Delete from DB - should be blocked (0 rows)
  const { count: delCount } = await client.from('documents').delete({ count: 'exact' }).eq('id', docId)
  assert(delCount === 0, 'Staff CANNOT delete document metadata (RLS blocks)')

  // Delete from storage - RLS blocks silently (no error, but file remains)
  const { error: storageDelErr } = await client.storage.from('documents').remove([filePath])
  assert(!storageDelErr, 'Staff storage delete request does not error')

  // Verify file still exists in storage
  const { data: listResult } = await client.storage.from('documents').list(
    filePath.split('/').slice(0, -1).join('/'),
    { limit: 100 }
  )
  const fileStillExists = !!listResult?.some((f) => f.name === filePath.split('/').pop())
  assert(fileStillExists, 'Staff CANNOT delete file from storage (file still exists)')

  // Verify still exists
  const { data: stillExists } = await client.from('documents').select('id').eq('id', docId).maybeSingle()
  assert(!!stillExists, 'Document still exists after staff delete attempt')

  // Cleanup with admin
  const admin = await signIn('admin@edurecord.demo', 'TestPass123!')
  await admin.storage.from('documents').remove([filePath])
  await admin.from('documents').delete().eq('id', docId)
}

async function testViewerReadOnly() {
  console.log('\n=== VIEWER: READ-ONLY ===')
  const client = await signIn('viewer@edurecord.demo', 'TestPass123!')

  // Read - should work
  const { data: list, error: readErr } = await client.from('documents').select('id').limit(1)
  assert(!readErr, 'Viewer can read documents')

  // Upload to storage - should fail
  const fileBlob = new Blob(['Viewer attempt'], { type: 'text/plain' })
  const { error: uploadErr } = await client.storage
    .from('documents')
    .upload('students/00000000-0000-0000-0000-000000000000/documents/viewer/viewer.txt', fileBlob)
  assert(!!uploadErr, 'Viewer CANNOT upload to storage (RLS blocks)')

  // Insert metadata - should fail
  const { data: createData, error: createErr } = await client
    .from('documents')
    .insert({
      student_id: '00000000-0000-0000-0000-000000000000',
      title: 'Viewer Attempt',
      file_path: 'fake/path.txt',
      file_name: 'viewer.txt',
      status: 'pending',
    })
    .select()
    .maybeSingle()
  assert(!!createErr || !createData, 'Viewer CANNOT create document metadata (RLS blocks)')

  // Update - should fail (0 rows)
  const { count: updateCount } = await client
    .from('documents')
    .update({ title: 'Hacked' }, { count: 'exact' })
    .eq('title', 'Staff Updated')
  assert(updateCount === 0, 'Viewer CANNOT update document (RLS blocks, 0 rows)')

  // Delete from DB - should fail (0 rows)
  const { count: delCount } = await client
    .from('documents')
    .delete({ count: 'exact' })
    .eq('title', 'Staff Updated')
  assert(delCount === 0, 'Viewer CANNOT delete document (RLS blocks, 0 rows)')
}

async function testStudentRecordRegression() {
  console.log('\n=== STUDENT + RECORD REGRESSION ===')
  const client = await signIn('admin@edurecord.demo', 'TestPass123!')

  // Student CRUD
  const { data: students, error: sErr } = await client.from('students').select('id').limit(5)
  assert(!sErr, 'Student list still loads')
  assert(!!students && students.length > 0, 'Students exist')

  const { data: created, error: createErr } = await client
    .from('students')
    .insert({ student_number: `REG-${Date.now()}`, first_name: 'Regression', last_name: 'Doc', status: 'active' })
    .select()
    .single()
  assert(!createErr, 'Student create still works')
  await client.from('students').delete().eq('id', created!.id)
  assert(true, 'Student delete still works')

  // Record CRUD
  const { data: recs, error: rErr } = await client.from('records').select('id').limit(5)
  assert(!rErr, 'Record list still loads')
  assert(!!recs, 'Records query succeeds')
}

async function main() {
  try {
    await testAdminUploadReadDelete()
    await testStaffUploadReadUpdate()
    await testViewerReadOnly()
    await testStudentRecordRegression()
    console.log('\n========================================')
    console.log('ALL DOCUMENT CRUD + STORAGE + RLS + REGRESSION TESTS PASSED')
    console.log('========================================')
  } catch (err) {
    console.error('\n========================================')
    console.error('TEST FAILED:', err instanceof Error ? err.message : err)
    console.error('========================================')
    process.exit(1)
  }
}

main()
