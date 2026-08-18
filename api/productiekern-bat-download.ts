import { bouwProductiekernZip } from '../src/lib/offMarket/acquisitie/productiekernZip.js';

interface DownloadBestand {
  naam: string;
  url: string;
}

interface DownloadManifest {
  pakketNaam: string;
  bestanden: DownloadBestand[];
}

const PAKKET_NAAM = /^BAT\d+-v\d+-productiebestanden\.zip$/;
const BESTANDS_NAAM = /^BAT\d+-v\d+-(?:voorblad|controlelijst|brieven|adreslabels)\.(?:pdf|csv)$/;
const MAX_BESTAND_BYTES = 20 * 1024 * 1024;
const MAX_PAKKET_BYTES = 40 * 1024 * 1024;

function bodyManifest(body: unknown): string | null {
  if (typeof body === 'string') return new URLSearchParams(body).get('manifest');
  if (body instanceof Uint8Array) return new URLSearchParams(new TextDecoder().decode(body)).get('manifest');
  if (body && typeof body === 'object') {
    const waarde = (body as { manifest?: unknown }).manifest;
    return typeof waarde === 'string' ? waarde : null;
  }
  return null;
}

function valideerDownloadUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error('Alleen HTTPS-downloadlinks zijn toegestaan.');

  const geconfigureerdeSupabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  if (geconfigureerdeSupabaseUrl) {
    const verwachteOrigin = new URL(geconfigureerdeSupabaseUrl).origin;
    if (url.origin !== verwachteOrigin) throw new Error('Downloadlink hoort niet bij de geconfigureerde Supabase-omgeving.');
  } else if (!/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) {
    throw new Error('Downloadlink hoort niet bij Supabase Storage.');
  }

  const pad = decodeURIComponent(url.pathname);
  if (!pad.startsWith('/storage/v1/object/sign/off-market-productie/')) {
    throw new Error('Downloadlink hoort niet bij de formele productiebucket.');
  }
  if (!url.searchParams.get('token')) throw new Error('Downloadlink mist een kortlevend Storage-token.');
  return url;
}

function valideerManifest(raw: string): DownloadManifest {
  const parsed = JSON.parse(raw) as Partial<DownloadManifest>;
  if (!parsed || typeof parsed !== 'object') throw new Error('Downloadmanifest ontbreekt.');
  if (typeof parsed.pakketNaam !== 'string' || !PAKKET_NAAM.test(parsed.pakketNaam)) {
    throw new Error('Ongeldige BAT-pakketnaam.');
  }
  if (!Array.isArray(parsed.bestanden) || parsed.bestanden.length !== 4) {
    throw new Error('Een BAT-pakket moet exact vier bestanden bevatten.');
  }

  const prefix = parsed.pakketNaam.replace(/-productiebestanden\.zip$/, '');
  const namen = new Set<string>();
  const bestanden = parsed.bestanden.map((bestand) => {
    if (!bestand || typeof bestand !== 'object') throw new Error('Ongeldig BAT-bestand.');
    if (typeof bestand.naam !== 'string' || !BESTANDS_NAAM.test(bestand.naam)) {
      throw new Error('Ongeldige BAT-bestandsnaam.');
    }
    if (!bestand.naam.startsWith(`${prefix}-`)) throw new Error('BAT-bestand hoort bij een ander pakket.');
    if (namen.has(bestand.naam)) throw new Error('BAT-pakket bevat dubbele bestandsnamen.');
    namen.add(bestand.naam);
    if (typeof bestand.url !== 'string') throw new Error('BAT-bestand mist downloadlink.');
    const url = valideerDownloadUrl(bestand.url);
    return { naam: bestand.naam, url: url.toString() };
  });

  const vereisteSuffixen = [
    '-voorblad.pdf',
    '-controlelijst.pdf',
    '-brieven.pdf',
    '-adreslabels.csv',
  ];
  for (const suffix of vereisteSuffixen) {
    if (!bestanden.some((bestand) => bestand.naam.endsWith(suffix))) {
      throw new Error(`BAT-pakket mist ${suffix.slice(1)}.`);
    }
  }

  return { pakketNaam: parsed.pakketNaam, bestanden };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const rawManifest = bodyManifest(req.body);
    if (!rawManifest) throw new Error('Downloadmanifest ontbreekt.');
    const manifest = valideerManifest(rawManifest);

    let totaalBytes = 0;
    const zipBestanden = [] as Array<{ naam: string; bytes: Uint8Array }>;
    for (const bestand of manifest.bestanden) {
      const response = await fetch(bestand.url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Storage-download van ${bestand.naam} is mislukt.`);
      const lengteHeader = Number(response.headers.get('content-length') ?? 0);
      if (Number.isFinite(lengteHeader) && lengteHeader > MAX_BESTAND_BYTES) {
        throw new Error(`${bestand.naam} is groter dan de toegestane downloadlimiet.`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BESTAND_BYTES) {
        throw new Error(`${bestand.naam} is groter dan de toegestane downloadlimiet.`);
      }
      totaalBytes += bytes.byteLength;
      if (totaalBytes > MAX_PAKKET_BYTES) throw new Error('BAT-pakket is groter dan de toegestane downloadlimiet.');
      zipBestanden.push({ naam: bestand.naam, bytes });
    }

    const zipBlob = bouwProductiekernZip(zipBestanden);
    const zipBuffer = Buffer.from(await zipBlob.arrayBuffer());

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${manifest.pakketNaam}"`);
    res.setHeader('Content-Length', String(zipBuffer.byteLength));
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(zipBuffer);
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(400).json({
      fout: error instanceof Error ? error.message : 'BAT-pakket kon niet worden gedownload.',
    });
  }
}
