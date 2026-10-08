import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmbedRequest {
  document_id: string;
}

/**
 * Embedding dimension — must match the vector(384) column in document_chunks.
 */
const EMBEDDING_DIM = 384;

/**
 * Chunk size in characters and overlap between adjacent chunks.
 */
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json() as EmbedRequest;
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Validate the caller's JWT and role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = userData.user.id;
    const { data: profile } = await adminClient
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.is_active || (profile.role !== "admin" && profile.role !== "staff")) {
      return new Response(
        JSON.stringify({ error: "Only admin and staff can generate embeddings" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the latest extracted text from document_analyses
    const { data: latestAnalysis, error: analysisErr } = await adminClient
      .from("document_analyses")
      .select("id, extracted_text")
      .eq("document_id", document_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (analysisErr) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch document analysis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!latestAnalysis || !latestAnalysis.extracted_text) {
      return new Response(
        JSON.stringify({ error: "No extracted text found. Please extract text from the document first." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const extractedText = latestAnalysis.extracted_text;

    // Chunk the text
    const chunks = chunkText(extractedText, CHUNK_SIZE, CHUNK_OVERLAP);

    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No text content to chunk after processing." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete existing chunks for this document (rebuild)
    const { error: deleteErr } = await adminClient
      .from("document_chunks")
      .delete()
      .eq("document_id", document_id);

    if (deleteErr) {
      return new Response(
        JSON.stringify({ error: `Failed to clear existing chunks: ${deleteErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate embeddings and insert chunks
    const rows = chunks.map((chunk, i) => ({
      document_id: document_id,
      chunk_index: i,
      content: chunk,
      metadata: { char_start: i * (CHUNK_SIZE - CHUNK_OVERLAP), chunk_size: CHUNK_SIZE },
      embedding: generateEmbedding(chunk),
    }));

    const { error: insertErr } = await adminClient
      .from("document_chunks")
      .insert(rows);

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: `Failed to insert chunks: ${insertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log to audit
    await adminClient
      .from("audit_logs")
      .insert({
        actor_id: userId,
        action: "generate_embeddings",
        entity_type: "document",
        entity_id: document_id,
        metadata: { chunk_count: chunks.length, embedding_dim: EMBEDDING_DIM },
      });

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        chunk_count: chunks.length,
        embedding_dim: EMBEDDING_DIM,
        embedding_method: "local-hash-v1",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Splits text into overlapping chunks of approximately `chunkSize` characters.
 * Tries to break on sentence/paragraph boundaries when possible.
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const cleaned = text.trim();
  if (cleaned.length === 0) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to break at a sentence boundary within the last 20% of the chunk
    if (end < cleaned.length) {
      const searchStart = Math.max(start + Math.floor(chunkSize * 0.8), start);
      const lastSentence = Math.max(
        cleaned.lastIndexOf(".", end),
        cleaned.lastIndexOf("!", end),
        cleaned.lastIndexOf("?", end),
        cleaned.lastIndexOf("\n", end),
      );
      if (lastSentence > searchStart) {
        end = lastSentence + 1;
      }
    }

    const chunk = cleaned.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) break;
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}

/**
 * Generates a deterministic 384-dimensional embedding vector from text using
 * a local hashing approach. No external API calls are made.
 *
 * The method uses character-level and word-level feature hashing:
 * 1. Tokenizes text into lowercase words.
 * 2. For each token, hashes it to a bucket in the vector and adds the
 *    token's frequency weight to that bucket.
 * 3. Also hashes character n-grams (bigrams and trigrams) for subword signal.
 * 4. L2-normalizes the resulting vector.
 *
 * This produces a deterministic, reproducible embedding suitable for
 * similarity search via cosine distance. It is not a neural embedding but
 * works for keyword-overlap retrieval in a RAG pipeline without paid APIs.
 */
function generateEmbedding(text: string): number[] {
  const vec = new Float64Array(EMBEDDING_DIM);

  const lowerText = text.toLowerCase();
  const tokens = lowerText.match(/[a-z0-9]+/g) ?? [];

  // Word-level features
  for (const token of tokens) {
    const hash = fnv1aHash(token) % EMBEDDING_DIM;
    vec[hash] += 1.0;
  }

  // Character bigram features
  for (let i = 0; i < lowerText.length - 1; i++) {
    const bigram = lowerText.slice(i, i + 2);
    if (/[a-z0-9 ]/.test(bigram)) {
      const hash = fnv1aHash(bigram) % EMBEDDING_DIM;
      vec[hash] += 0.3;
    }
  }

  // Character trigram features
  for (let i = 0; i < lowerText.length - 2; i++) {
    const trigram = lowerText.slice(i, i + 3);
    if (/^[a-z0-9 ]+$/.test(trigram)) {
      const hash = fnv1aHash(trigram) % EMBEDDING_DIM;
      vec[hash] += 0.15;
    }
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);

  const result = new Array(EMBEDDING_DIM);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      result[i] = Math.round((vec[i] / norm) * 10000) / 10000;
    }
  } else {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      result[i] = 0;
    }
  }

  return result;
}

/**
 * FNV-1a hash — fast, deterministic, well-distributed for string hashing.
 */
function fnv1aHash(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned 32-bit
  return hash >>> 0;
}
