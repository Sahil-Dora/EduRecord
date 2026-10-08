import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequest {
  document_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json() as ExtractRequest;
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
        JSON.stringify({ error: "Only admin and staff can trigger text extraction" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the document
    const { data: doc, error: docErr } = await adminClient
      .from("documents")
      .select("id, file_path, file_name, mime_type, title")
      .eq("id", document_id)
      .maybeSingle();

    if (docErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Set extraction status to pending
    const { error: statusErr } = await adminClient
      .from("documents")
      .update({ extraction_status: "pending", extraction_error: null })
      .eq("id", document_id);

    if (statusErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update extraction status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Download the file from storage
    const { data: fileData, error: downloadErr } = await adminClient
      .storage
      .from("documents")
      .download(doc.file_path);

    if (downloadErr || !fileData) {
      await adminClient
        .from("documents")
        .update({ extraction_status: "error", extraction_error: `Failed to download file: ${downloadErr?.message ?? "unknown"}` })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Failed to download file from storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mimeType = doc.mime_type || "application/octet-stream";
    const fileBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(fileBuffer);

    let extractedText: string;
    let modelUsed: string;

    try {
      const result = await extractText(uint8, mimeType, doc.file_name);
      extractedText = result.text;
      modelUsed = result.extractor;
    } catch (extractErr) {
      const errMsg = extractErr instanceof Error ? extractErr.message : "Extraction failed";
      await adminClient
        .from("documents")
        .update({ extraction_status: "error", extraction_error: errMsg })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ error: `Text extraction failed: ${errMsg}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Store extracted text in document_analyses
    const { error: analysisErr } = await adminClient
      .from("document_analyses")
      .insert({
        document_id: document_id,
        extracted_text: extractedText || null,
        model_used: modelUsed,
        analyzed_by: userId,
      });

    if (analysisErr) {
      await adminClient
        .from("documents")
        .update({ extraction_status: "error", extraction_error: `Failed to save extracted text: ${analysisErr.message}` })
        .eq("id", document_id);

      return new Response(
        JSON.stringify({ error: "Failed to save extracted text" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update document status to complete
    await adminClient
      .from("documents")
      .update({ extraction_status: "complete", extraction_error: null })
      .eq("id", document_id);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        char_count: extractedText.length,
        extractor: modelUsed,
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
 * Extracts text from a file based on its MIME type or file extension.
 * Supported formats:
 *   - PDF (with text layer) via unpdf
 *   - DOCX via mammoth
 *   - XLSX via SheetJS (xlsx)
 *   - DOC (legacy) via word-extractor
 *   - Images (JPG, JPEG, PNG, WEBP) via Tesseract WASM OCR (no Worker)
 *   - Plain text: txt, csv, json, xml, html, markdown, yaml
 */
async function extractText(
  data: Uint8Array,
  mimeType: string,
  fileName: string,
): Promise<{ text: string; extractor: string }> {
  const decoder = new TextDecoder("utf-8");
  const lowerName = fileName.toLowerCase();

  // ---- Plain text formats ----
  if (
    mimeType === "text/plain" ||
    mimeType === "text/csv" ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    mimeType === "text/xml" ||
    mimeType === "text/html" ||
    mimeType === "text/markdown" ||
    mimeType === "application/x-yaml" ||
    mimeType === "text/yaml"
  ) {
    return { text: decoder.decode(data), extractor: "text-decoder-v1" };
  }

  // ---- PDF ----
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    try {
      // Use pdfjs-dist directly for Deno compatibility
      const pdfjs = await import("npm:pdfjs-dist@4.7.76");
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
        useSystemFonts: true,
        isEvalSupported: false,
      });
      const pdfDocument = await loadingTask.promise;
      const textParts: string[] = [];
      for (let i = 1; i <= pdfDocument.numPages; i++) {
        const page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => "str" in item ? item.str : "")
          .join(" ");
        textParts.push(pageText);
      }
      await pdfDocument.destroy();
      return { text: textParts.join("\n\n"), extractor: "pdfjs-dist-v4.7.76" };
    } catch (pdfErr) {
      const detail = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      throw new Error(`PDF text extraction failed: ${detail}. The PDF may be scanned images without a text layer, or corrupted.`);
    }
  }

  // ---- DOCX (Office Open XML Word) ----
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    try {
      const mammoth = await import("npm:mammoth@1.8.0");
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const result = await mammoth.extractRawText({ buffer: new Uint8Array(arrayBuffer) });
      return { text: result.value, extractor: "mammoth-v1.8.0" };
    } catch (docxErr) {
      const detail = docxErr instanceof Error ? docxErr.message : String(docxErr);
      throw new Error(`DOCX text extraction failed: ${detail}. The file may be corrupted or password-protected.`);
    }
  }

  // ---- XLSX (Office Open XML Excel) ----
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    lowerName.endsWith(".xlsx")
  ) {
    try {
      const XLSX = await import("npm:xlsx@0.18.5");
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheets: string[] = [];
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        sheets.push(`--- Sheet: ${sheetName} ---\n${csv}`);
      }
      return { text: sheets.join("\n\n"), extractor: "xlsx-v0.18.5" };
    } catch (xlsxErr) {
      const detail = xlsxErr instanceof Error ? xlsxErr.message : String(xlsxErr);
      throw new Error(`XLSX text extraction failed: ${detail}. The file may be corrupted or password-protected.`);
    }
  }

  // ---- DOC (legacy Word binary) ----
  if (mimeType === "application/msword" || lowerName.endsWith(".doc")) {
    try {
      const WordExtractor = (await import("npm:word-extractor@1.0.4")).default;
      const extractor = new WordExtractor();
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const blob = new Blob([arrayBuffer], { type: "application/msword" });
      const extracted = await extractor.extract(blob);
      const parts = [extracted.getBody(), extracted.getHeaders(), extracted.getFootnotes()];
      const text = parts.filter((p) => p && p.trim().length > 0).join("\n\n");
      return { text, extractor: "word-extractor-v1.0.4" };
    } catch (docErr) {
      const detail = docErr instanceof Error ? docErr.message : String(docErr);
      throw new Error(`DOC text extraction failed: ${detail}. The file may be corrupted or in an unsupported legacy format.`);
    }
  }

  // ---- Images: JPG, JPEG, PNG, WEBP via OCR (Tesseract WASM, no Worker) ----
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp" ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".webp")
  ) {
    try {
      const text = await runOcr(data, mimeType);
      return { text, extractor: "tesseract-wasm-v5.1.1" };
    } catch (ocrErr) {
      const detail = ocrErr instanceof Error ? ocrErr.message : String(ocrErr);
      throw new Error(`Image OCR failed: ${detail}. The image may be corrupted or too low quality for text recognition.`);
    }
  }

  // ---- Other image types not supported via OCR ----
  if (mimeType.startsWith("image/")) {
    throw new Error(`Image type ${mimeType} is not supported for OCR. Supported image formats: JPG, PNG, WEBP.`);
  }

  // ---- Unknown binary format ----
  throw new Error(
    `Unsupported file type: ${mimeType}. Supported formats: PDF, DOCX, XLSX, DOC, JPG, PNG, WEBP, plain text, CSV, JSON, XML, HTML, Markdown, YAML.`,
  );
}

/**
 * Runs Tesseract OCR directly on the main thread using the WASM core,
 * bypassing the Worker abstraction that is incompatible with the Supabase
 * Deno Edge Function runtime.
 *
 * Steps:
 * 1. Load the tesseract.js-core WASM module (tesseract-core-simd-lstm.wasm.js).
 * 2. Fetch the English language traineddata from the tessdata CDN.
 * 3. Initialize the Tesseract engine with the language data.
 * 4. Decode the image to raw RGBA pixels using Canvas API.
 * 5. Set the image on the engine and run recognition.
 * 6. Extract and return the recognized text.
 */
async function runOcr(data: Uint8Array, mimeType: string): Promise<string> {
  // Load the Tesseract WASM core directly (no Worker)
  const coreModule = await import("npm:tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js");

  // The WASM module exposes a factory function that returns a ready module
  const Module = await coreModule.default();

  // Fetch English traineddata from the official tessdata_fast CDN
  const langUrl = "https://tessdata.fastprojects.org/4.0.0_best/eng.traineddata";
  const langResponse = await fetch(langUrl);
  if (!langResponse.ok) {
    throw new Error(`Failed to download OCR language data (HTTP ${langResponse.status})`);
  }
  const langData = new Uint8Array(await langResponse.arrayBuffer());

  // Write language data to the WASM filesystem
  const langPath = "eng.traineddata";
  Module.FS.writeFile(langPath, langData);

  // Initialize the Tesseract engine
  const api = new Module.TessBaseAPI();
  const initResult = api.Init(null, "eng");
  if (initResult !== 0) {
    throw new Error("Tesseract engine initialization failed");
  }

  try {
    // Decode the image to raw RGBA pixel data
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const imageBlob = new Blob([arrayBuffer], { type: mimeType || "image/png" });
    const bitmap = await createImageBitmap(imageBlob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);

    // Set the image on the Tesseract engine and recognize
    api.SetImage(
      imageData.data,
      imageData.width,
      imageData.height,
      4, // RGBA channels
      imageData.width * 4, // row stride
    );

    // Get the recognized text
    const textPtr = api.GetUTF8Text();
    const recognizedText = Module.UTF8ToString(textPtr);

    // Clean up WASM-allocated memory
    Module._free(textPtr);

    return recognizedText.trim();
  } finally {
    api.End();
  }
}
