import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_taken",
  title: "Lijst taken",
  description:
    "Lijst met openstaande taken van de ingelogde gebruiker met titel, deadline, prioriteit en status. Sluit standaard afgeronde en geannuleerde taken uit.",
  inputSchema: {
    inclusief_afgerond: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ inclusief_afgerond, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Niet geauthenticeerd" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("taken")
      .select("id, titel, omschrijving, deadline, prioriteit, status, type, relatie_id, object_id, deal_id, created_at, updated_at")
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(limit);
    if (!inclusief_afgerond) q = q.not("status", "in", "(afgerond,geannuleerd)");
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} taken gevonden.` }],
      structuredContent: { taken: data ?? [] },
    };
  },
});
