// PDF-extractie + opslag voor Kadasterbericht (Fase 4K.5).
//
// Doel:
//   - Wanneer een Kadaster-respons een PDF/Kadasterbericht bevat (vereist
//     `includePdf: true` in het request), wordt de PDF intern opgeslagen
//     in Storage en als rij in `kadaster_documenten` vastgelegd.
//   - Geen automatische deling in dataroom, geen export, geen relatie-
//     koppeling, geen OCR/parsing. Alleen ophalen + intern terugvindbaar.
//
// Strikte regels:
//   - Geen API-key, headers of upstream URL loggen.
//   - PDF-inhoud staat NIET in logs of debug-shape.
//   - Faalt opslag, dan blijft de Kadasterrecord behouden en geven we een
//     leesbare melding terug. Geen retry, geen nieuwe Kadaster-call.

// @ts-nocheck — Deno runtime

type SupabaseClient = ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>;

const PDF_KEY_HINT = /pdf|document|bericht|report|kadasterbericht/i;
const BASE64_PDF_PREFIX = 'JVBERi'; // base64-encoded "%PDF-"
const MAX_PDF_BYTES = 30 * 1024 * 1024; // 30 MB defensieve bovengrens

export interface ExtractedPdf {
  /** Base64-string zonder data-URL prefix. */
  base64: string;
  /** Geschatte byte-grootte (na decode). */
  bytes: number;
  /** Sleutel waar de PDF onder gevonden is (alleen voor debug — geen inhoud). */
  source_key: string | null;
}

function stripDataUrl(s: string): string {
  // "data:application/pdf;base64,JVBERi..." → "JVBERi..."
  const idx = s.indexOf('base64,');
  if (idx >= 0) return s.slice(idx + 'base64,'.length);
  return s;
}

function looksLikePdfBase64(value: string): boolean {
  if (!value || value.length < 200) return false;
  const cleaned = stripDataUrl(value).replace(/\s+/g, '').slice(0, 16);
  return cleaned.startsWith(BASE64_PDF_PREFIX);
}

/**
 * Zoek in een willekeurige Kadaster-respons recursief naar een PDF.
 * Stopt bij eerste hit. Diepte begrensd om endless objects te voorkomen.
 */
export function extractPdfFromResponse(raw: unknown, maxDepth = 5): ExtractedPdf | null {
  if (!raw) return null;

  function walk(node: unknown, depth: number, path: string[]): ExtractedPdf | null {
    if (depth > maxDepth || node === null || node === undefined) return null;
    if (typeof node === 'string') {
      if (looksLikePdfBase64(node)) {
        const base64 = stripDataUrl(node).replace(/\s+/g, '');
        return {
          base64,
          bytes: Math.floor((base64.length * 3) / 4),
          source_key: path.join('.') || null,
        };
      }
      return null;
    }
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const hit = walk(node[i], depth + 1, [...path, String(i)]);
        if (hit) return hit;
      }
      return null;
    }
    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      // Eerst keys die op een PDF lijken — geeft betere `source_key`.
      const keys = Object.keys(obj).sort((a, b) => {
        const ah = PDF_KEY_HINT.test(a) ? 0 : 1;
        const bh = PDF_KEY_HINT.test(b) ? 0 : 1;
        return ah - bh;
      });
      for (const k of keys) {
        const hit = walk(obj[k], depth + 1, [...path, k]);
        if (hit) return hit;
      }
    }
    return null;
  }

  return walk(raw, 0, []);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function veiligPad(stuk: string): string {
  return stuk.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 60);
}

export function buildKadasterPdfPad(args: {
  objectId: string | null;
  signaalId: string | null;
  zoekadres: string;
  producten: string[];
  fetchedAt: string;
  fileId: string;
}): { storagePath: string; bestandsnaam: string } {
  const root = args.objectId
    ? `${args.objectId}/kadaster`
    : `signaal/${args.signaalId}/kadaster`;
  const datum = (args.fetchedAt.split('T')[0]) ?? new Date().toISOString().slice(0, 10);
  const zoek = veiligPad(args.zoekadres.replace(/\s+/g, '_'));
  const prod = veiligPad(args.producten.join('-'));
  const bestandsnaam = `Kadasterbericht_${zoek}_${prod}_${datum}.pdf`;
  const storagePath = `${root}/${args.fileId}_${bestandsnaam}`;
  return { storagePath, bestandsnaam };
}

export interface PdfPersistArgs {
  objectId: string | null;
  signaalId: string | null;
  recordIds: string[];
  productCodes: string[];
  zoekadres: { type: string; waarde: string };
  fetchedAt: string;
  userId: string | null;
  pdf: ExtractedPdf;
}

export interface PdfPersistResult {
  ok: boolean;
  document_id: string | null;
  storage_path: string | null;
  bestandsnaam: string | null;
  bestandsgrootte_bytes: number | null;
  source_key: string | null;
  error: string | null;
}

export async function persistKadasterPdf(
  client: SupabaseClient,
  args: PdfPersistArgs,
): Promise<PdfPersistResult> {
  const empty: PdfPersistResult = {
    ok: false, document_id: null, storage_path: null,
    bestandsnaam: null, bestandsgrootte_bytes: null,
    source_key: args.pdf.source_key, error: null,
  };
  if (args.pdf.bytes > MAX_PDF_BYTES) {
    return { ...empty, error: `Kadasterbericht (${args.pdf.bytes} bytes) overschrijdt limiet.` };
  }
  if (!args.objectId && !args.signaalId) {
    return { ...empty, error: 'Geen object_id of signaal_id om PDF aan te koppelen.' };
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(args.pdf.base64);
  } catch (e) {
    return { ...empty, error: 'Kon Kadasterbericht/PDF niet decoderen.' };
  }

  const fileId = crypto.randomUUID();
  const { storagePath, bestandsnaam } = buildKadasterPdfPad({
    objectId: args.objectId,
    signaalId: args.signaalId,
    zoekadres: args.zoekadres.waarde || 'onbekend',
    producten: args.productCodes,
    fetchedAt: args.fetchedAt,
    fileId,
  });

  const uploadRes = await client.storage
    .from('bito-objecten')
    .upload(storagePath, bytes, {
      contentType: 'application/pdf',
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadRes.error) {
    return { ...empty, error: `Opslaan in storage mislukt: ${uploadRes.error.message}` };
  }

  const insertPayload: Record<string, unknown> = {
    object_id: args.objectId,
    signaal_id: args.signaalId,
    kadaster_data_record_id: args.recordIds[0] ?? null,
    source: 'kadaster_objectinformatie_api',
    product_codes: args.productCodes,
    zoekadres: args.zoekadres,
    fetched_at: args.fetchedAt,
    storage_bucket: 'bito-objecten',
    storage_path: storagePath,
    bestandsnaam,
    bestandsgrootte_bytes: bytes.byteLength,
    mime_type: 'application/pdf',
    intern_only: true,
    created_by: args.userId,
  };

  const ins = await client
    .from('kadaster_documenten')
    .insert(insertPayload)
    .select('id')
    .single();
  if (ins.error || !ins.data) {
    // Rollback storage-upload zodat we geen weespad krijgen.
    await client.storage.from('bito-objecten').remove([storagePath]).catch(() => {});
    return { ...empty, error: `Documentregistratie mislukt: ${ins.error?.message ?? 'onbekend'}` };
  }

  const documentId = (ins.data as { id: string }).id;
  if (args.recordIds.length > 0) {
    await client
      .from('kadaster_data_records')
      .update({ pdf_document_id: documentId })
      .in('id', args.recordIds)
      .then(() => undefined, () => undefined);
  }

  return {
    ok: true,
    document_id: documentId,
    storage_path: storagePath,
    bestandsnaam,
    bestandsgrootte_bytes: bytes.byteLength,
    source_key: args.pdf.source_key,
    error: null,
  };
}
