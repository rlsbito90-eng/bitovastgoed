// Centrale, server-side uitgegeven EENMALIGE preview-aanmelding.
// Vereist Supabase secret: VERCEL_PREVIEW_AUTH_READ_TOKEN met uitsluitend
// read-scope voor het eigen Vercel-project. Er is GEEN anonieme bypass.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

const PRIMARY_ORIGIN = "https://bitovastgoed.vercel.app";
const VERCEL_PROJECT_ID = "prj_oU7EipRl3D0tgO8RN1Wowv2rHhbh";
const VERCEL_TEAM_ID = "team_v2sTCHBAV9BqdVuI2fn0zy46";
const EXPECTED_GITHUB_ORG = "rlsbito90-eng";
const EXPECTED_GITHUB_REPO = "bitovastgoed";
const HOST_RE = /^bitovastgoed-[a-z0-9-]+-bitovastgoed\.vercel\.app$/;
const NONCE_RE = /^[a-f0-9]{64}$/;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": PRIMARY_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
    "Cache-Control": "no-store, private",
    "Referrer-Policy": "no-referrer",
    "Content-Type": "application/json; charset=utf-8",
  };
}

function reply(status: number, data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders() });
}

function previewHost(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.origin !== raw || url.port) return null;
    if (!HOST_RE.test(url.hostname) || url.hostname.length >= 220) return null;
    return url.hostname;
  } catch {
    return null;
  }
}

type Deployment = {
  url?: string;
  alias?: string[];
  projectId?: string;
  project?: { id?: string };
  target?: string | null;
  readyState?: string;
  state?: string;
  meta?: Record<string, string>;
};

async function verifiedPreviewHost(hostname: string, readToken: string): Promise<boolean> {
  // Geen wildcard-bypass: elk individueel previewadres wordt live geverifieerd
  // tegen de Vercel API en moet daadwerkelijk bij het eigen project horen.
  const endpoint = new URL(`https://api.vercel.com/v13/deployments/${encodeURIComponent(hostname)}`);
  endpoint.searchParams.set("teamId", VERCEL_TEAM_ID);
  endpoint.searchParams.set("withGitRepoInfo", "true");

  const result = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${readToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!result.ok) return false;
  const item = await result.json() as Deployment;
  if ((item.projectId ?? item.project?.id) !== VERCEL_PROJECT_ID) return false;
  if (item.target !== null && item.target !== "preview") return false;
  if ((item.readyState ?? item.state) !== "READY") return false;
  if (item.url !== hostname && !item.alias?.includes(hostname)) return false;
  if (item.meta?.githubOrg !== EXPECTED_GITHUB_ORG || item.meta?.githubRepo !== EXPECTED_GITHUB_REPO) return false;
  // Geen login voor een productiealias via deze previewroute.
  if (!item.meta.githubCommitRef || item.meta.githubCommitRef === "main") return false;
  return true;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return request.headers.get("origin") === PRIMARY_ORIGIN
      ? new Response(null, { status: 204, headers: corsHeaders() })
      : reply(403, { error: "origin_not_allowed" });
  }

  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });
  if (request.headers.get("origin") !== PRIMARY_ORIGIN) return reply(403, { error: "origin_not_allowed" });

  const readToken = Deno.env.get("VERCEL_PREVIEW_AUTH_READ_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!readToken || !supabaseUrl || !serviceKey) return reply(503, { error: "preview_auth_not_configured" });

  const authHeader = request.headers.get("authorization") ?? "";
  const userToken = /^Bearer (.+)$/i.exec(authHeader)?.[1];
  if (!userToken) return reply(401, { error: "not_authenticated" });

  let payload: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return reply(413, { error: "payload_too_large" });
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { error: "invalid_payload" });
  }

  const input = payload as { previewOrigin?: unknown; nonce?: unknown } | null;
  const hostname = previewHost(input?.previewOrigin);
  if (!hostname || typeof input?.nonce !== "string" || !NONCE_RE.test(input.nonce)) {
    return reply(400, { error: "invalid_preview_request" });
  }

  // De service-role-key blijft UITSLUITEND in de serveromgeving en omzeilt
  // NOOIT de hieronder uitgevoerde expliciete admin-autoriseringscontrole.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: authData, error: userError } = await admin.auth.getUser(userToken);
    const user = authData?.user;
    if (userError || !user?.id || !user.email || !user.email_confirmed_at || user.is_anonymous) {
      return reply(401, { error: "not_authenticated" });
    }

    const { data: roles, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .limit(1);
    if (roleError || !roles?.length) return reply(403, { error: "not_authorized" });

    const owned = await verifiedPreviewHost(hostname, readToken);
    if (!owned) return reply(403, { error: "unverified_preview" });

    // Nieuwe, aparte previewsessie. Geen centrale refresh token overdragen.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    if (linkError || !linkData?.properties?.hashed_token || linkData.user?.id !== user.id) {
      return reply(503, { error: "cannot_issue_preview_login" });
    }

    // One-time token, alleen in POST-response; nooit in URL of log.
    return reply(200, { nonce: input.nonce, tokenHash: linkData.properties.hashed_token, type: "magiclink" });
  } catch {
    // Geen identificerende gegevens, JWT, keys of OTP in foutlog.
    return reply(503, { error: "preview_auth_temporarily_unavailable" });
  }
});
