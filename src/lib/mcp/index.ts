import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRelatiesTool from "./tools/list_relaties";
import listObjectenTool from "./tools/list_objecten";
import listDealsTool from "./tools/list_deals";
import listTakenTool from "./tools/list_taken";

// Zie knowledge: issuer MUST be direct supabase.co host, gebouwd uit project-ref.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bito-vastgoed-mcp",
  title: "Bito Vastgoed CRM",
  version: "0.1.0",
  instructions:
    "Read-only toegang tot het Bito Vastgoed CRM: relaties, objecten (aanbod), deals en taken. Alle tools draaien onder de ingelogde gebruiker; RLS bepaalt zichtbaarheid. Gebruik `list_relaties`, `list_objecten`, `list_deals` en `list_taken` om commercieel overzicht te krijgen.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRelatiesTool, listObjectenTool, listDealsTool, listTakenTool],
});
