// Text extraction for an already stored/received Kadaster PDF.
// Uses unpdf's serverless PDF.js build; no OCR and no external API call.
// Full extracted text is kept in memory only and is never logged or persisted.

// @ts-nocheck — Deno runtime
import { extractText } from 'npm:unpdf@1.6.2';

const MAX_EXTRACT_BYTES = 30 * 1024 * 1024;
const MAX_TEXT_CHARS = 250_000;

export async function extractKadasterPdfText(bytes: Uint8Array): Promise<string> {
  if (!bytes?.byteLength) throw new Error('Kadasterbericht/PDF is leeg.');
  if (bytes.byteLength > MAX_EXTRACT_BYTES) throw new Error('Kadasterbericht/PDF is te groot voor tekstextractie.');

  const result = await extractText(bytes, { mergePages: true });
  const text = typeof result.text === 'string' ? result.text : result.text.join('\n');
  const cleaned = text.replace(/\u0000/g, '').slice(0, MAX_TEXT_CHARS).trim();
  if (!cleaned) throw new Error('Kadasterbericht bevat geen uitleesbare tekstlaag.');
  return cleaned;
}
