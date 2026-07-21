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
  name: "list_objecten",
  title: "Lijst objecten",
  description:
    "Lijst met vastgoedobjecten (aanbod) van de ingelogde gebruiker. Geeft kernvelden voor overzicht en beslissing: locatie, type, vraagprijs, huur, oppervlakte, status.",
  inputSchema: {
    zoekterm: z.string().trim().max(120).optional().describe("Zoekterm op naam, adres of plaats."),
    status: z
      .enum(["te_beoordelen", "actief", "onder_bod", "verkocht", "verhuurd", "ingetrokken"])
      .optional(),
    plaats: z.string().trim().max(80).optional(),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ zoekterm, status, plaats, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Niet geauthenticeerd" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("objecten")
      .select(
        "id, intern_referentienummer, objectnaam, adres, plaats, provincie, type_vastgoed, subcategorie, vraagprijs, huurinkomsten, oppervlakte_vvo, oppervlakte, bouwjaar, status, verhuurstatus, bruto_aanvangsrendement, energielabel, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    if (plaats) q = q.ilike("plaats", `%${plaats}%`);
    if (zoekterm) {
      const like = `%${zoekterm}%`;
      q = q.or(
        `objectnaam.ilike.${like},adres.ilike.${like},plaats.ilike.${like},intern_referentienummer.ilike.${like}`,
      );
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} objecten gevonden.` }],
      structuredContent: { objecten: data ?? [] },
    };
  },
});
