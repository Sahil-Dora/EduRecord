import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalyzeRequest {
  document_id: string;
}

interface AIAnalysisResult {
  summary: string;
  suggested_type: string;
  key_fields: Record<string, string>;
  flags: string[];
  confidence_score: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { document_id } = await req.json() as AnalyzeRequest;
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
        JSON.stringify({ error: "Only admin and staff can trigger AI analysis" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch the latest extracted text from document_analyses
    const { data: latestAnalysis, error: analysisErr } = await adminClient
      .from("document_analyses")
      .select("id, extracted_text, model_used")
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

    // Truncate text to avoid exceeding API limits (keep first ~12000 chars)
    const maxChars = 12000;
    const truncatedText = extractedText.length > maxChars
      ? extractedText.slice(0, maxChars) + "\n[...truncated]"
      : extractedText;

    // Run heuristic analysis (no external API required)
    const analysisResult = heuristicAnalysis(truncatedText);
    const modelUsed = "heuristic-v1";

    // Save the structured analysis as a new document_analyses row
    const { error: insertErr } = await adminClient
      .from("document_analyses")
      .insert({
        document_id: document_id,
        extracted_text: latestAnalysis.extracted_text,
        summary: analysisResult.summary,
        key_fields: analysisResult.key_fields,
        suggested_type: analysisResult.suggested_type,
        confidence_score: analysisResult.confidence_score,
        flags: analysisResult.flags,
        model_used: modelUsed,
        analyzed_by: userId,
      });

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: `Failed to save analysis: ${insertErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update document status to analyzed
    await adminClient
      .from("documents")
      .update({ status: "analyzed" })
      .eq("id", document_id);

    // Log to audit
    await adminClient
      .from("audit_logs")
      .insert({
        actor_id: userId,
        action: "analyze_document",
        entity_type: "document",
        entity_id: document_id,
        metadata: { model_used: modelUsed },
      });

    return new Response(
      JSON.stringify({
        success: true,
        document_id: document_id,
        summary: analysisResult.summary,
        suggested_type: analysisResult.suggested_type,
        key_fields: analysisResult.key_fields,
        flags: analysisResult.flags,
        confidence_score: analysisResult.confidence_score,
        model_used: modelUsed,
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
 * Heuristic analysis — no external API required.
 * Extracts basic information from the text using keyword matching and regex.
 */
function heuristicAnalysis(text: string): AIAnalysisResult {
  const lowerText = text.toLowerCase();
  const flags: string[] = [];

  // Detect document type based on keywords
  let suggestedType = "other";
  if (lowerText.includes("transcript") || lowerText.includes("grade point") || lowerText.includes("gpa")) {
    suggestedType = "transcript";
  } else if (lowerText.includes("certificate") || lowerText.includes("certify")) {
    suggestedType = "certificate";
  } else if (lowerText.includes("enroll") || lowerText.includes("registration")) {
    suggestedType = "enrollment_form";
  } else if (lowerText.includes("medical") || lowerText.includes("health") || lowerText.includes("vaccination")) {
    suggestedType = "medical_record";
  } else if (lowerText.includes("passport") || lowerText.includes("license") || lowerText.includes("id card")) {
    suggestedType = "identification";
  } else if (lowerText.includes("invoice") || lowerText.includes("payment") || lowerText.includes("tuition") || lowerText.includes("fee")) {
    suggestedType = "financial_document";
  } else if (lowerText.includes("dear") || lowerText.includes("sincerely") || lowerText.includes("regards")) {
    suggestedType = "letter";
  } else if (lowerText.includes("report") || lowerText.includes("assessment")) {
    suggestedType = "report";
  }

  // Extract potential key fields (dates, emails, phone numbers)
  const keyFields: Record<string, string> = {};

  const dateMatch = text.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
  if (dateMatch) keyFields["date_found"] = dateMatch[0];

  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (emailMatch) keyFields["email_found"] = emailMatch[0];

  const phoneMatch = text.match(/(\+?\d[\d\s\-()]{7,}\d)/);
  if (phoneMatch) keyFields["phone_found"] = phoneMatch[0];

  // Check for flags
  if (lowerText.includes("expired") || lowerText.includes("void")) {
    flags.push("expired_reference");
  }
  if (lowerText.includes("confidential") || lowerText.includes("private") || lowerText.includes("sensitive")) {
    flags.push("sensitive_data");
  }
  if (text.trim().length < 50) {
    flags.push("incomplete");
  }

  // Generate summary (first 200 chars)
  const summaryText = text.trim().slice(0, 200);
  const summary = summaryText.length < text.trim().length
    ? `${summaryText}...`
    : summaryText || "No readable text content found in document.";

  // Confidence based on text length and key field extraction
  const textLengthScore = Math.min(1, text.trim().length / 500);
  const keyFieldScore = Object.keys(keyFields).length > 0 ? 0.2 : 0;
  const confidenceScore = Math.min(0.85, textLengthScore * 0.6 + keyFieldScore + 0.2);

  return {
    summary,
    suggested_type: suggestedType,
    key_fields: keyFields,
    flags,
    confidence_score: confidenceScore,
  };
}
