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
  name: "list_relaties",
  title: "Lijst relaties",
  description:
    "Lijst met CRM-relaties (kopers, verkopers, huurders, contacten) van de ingelogde gebruiker. Ondersteunt zoeken op naam/plaats en filtert soft-deleted records uit.",
  inputSchema: {
    zoekterm: z
      .string()
      .trim()
      .max(120)
      .optional()
      .describe("Zoekterm op bedrijfsnaam, contactnaam of plaats."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ zoekterm, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Niet geauthenticeerd" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("relaties")
      .select("id, bedrijfsnaam, contactnaam, plaats, telefoon, email, relatietype, categorie, created_at")
      .is("soft_deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (zoekterm) {
      const like = `%${zoekterm}%`;
      q = q.or(
        `bedrijfsnaam.ilike.${like},contactnaam.ilike.${like},plaats.ilike.${like}`,
      );
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `${data?.length ?? 0} relaties gevonden.` }],
      structuredContent: { relaties: data ?? [] },
    };
  },
});
