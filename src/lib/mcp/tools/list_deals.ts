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
  name: "list_deals",
  title: "Lijst deals",
  description:
    "Lijst met deals (pipeline) voor de ingelogde gebruiker met fase, interessegraad, indicatief bod, en gekoppelde relatie/object. Sluit gearchiveerde deals standaard uit.",
  inputSchema: {
    fase: z.string().trim().max(40).optional().describe("Filter op deal-fase."),
    inclusief_archief: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ fase, inclusief_archief, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Niet geauthenticeerd" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("deals")
      .select(
        "id, fase, interessegraad, indicatief_bod, datum_eerste_contact, datum_follow_up, verwachte_closingdatum, commissie_pct, commissie_bedrag, dd_status, is_archived, closed_at, object_id, relatie_id, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (!inclusief_archief) q = q.eq("is_archived", false);
    if (fase) q = q.eq("fase", fase);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} deals gevonden.` }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
