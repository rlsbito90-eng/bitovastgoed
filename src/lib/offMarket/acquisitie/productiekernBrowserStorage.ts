import { supabase } from '@/integrations/supabase/client';
import {
  PRODUCTIEKERN_STORAGE_BUCKET,
  type ProductiekernStorageUitvoerder,
} from './productiekernBatchArtifactOpslag';

/**
 * Smalle browseradapter voor de private Productiekern-bucket. De RLS-policy
 * bepaalt server-side of de ingelogde interne gebruiker het actor-eigen pad mag
 * schrijven. `upsert:false` bewaakt append-only gedrag ook client-side.
 */
export const productiekernBrowserStorage: ProductiekernStorageUitvoerder = {
  async upload({ bucket, pad, blob, contentType }) {
    if (bucket !== PRODUCTIEKERN_STORAGE_BUCKET) {
      return { error: { message: 'Onverwachte Productiekern Storage-bucket.' } };
    }
    const { error } = await supabase.storage.from(bucket).upload(pad, blob, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });
    return { error: error ? { message: error.message } : null };
  },
};

function valideerProductiekernStoragePad(pad: string): string {
  const schoon = pad.trim();
  if (!schoon || schoon.startsWith('/') || schoon.includes('..') || schoon.includes('\\')) {
    throw new Error('Ongeldig Productiekern Storage-pad.');
  }
  const segmenten = schoon.split('/').filter(Boolean);
  if (segmenten.length < 5) throw new Error('Onvolledig Productiekern Storage-pad.');
  return schoon;
}

/**
 * Downloadt uitsluitend uit de vaste private Productiekern-bucket. Geen
 * dynamische bucketkeuze of public URL; Storage-RLS blijft de autoriteit.
 */
export async function downloadProductiekernStorageObject(pad: string): Promise<Blob> {
  const veiligPad = valideerProductiekernStoragePad(pad);
  const { data, error } = await supabase.storage
    .from(PRODUCTIEKERN_STORAGE_BUCKET)
    .download(veiligPad);
  if (error) throw new Error(`Productiebestand downloaden mislukt: ${error.message}`);
  if (!data) throw new Error('Productiebestand ontbreekt in private Storage.');
  return data;
}

/**
 * Geeft een kortlevende HTTPS-downloadroute voor exact één reeds geregistreerd
 * private Storage-object. De URL wordt door Supabase ondertekend en verloopt
 * automatisch; er wordt geen object gekopieerd of gewijzigd.
 *
 * Dit is bewust een normale HTTPS-route in plaats van een browser-local `blob:`
 * URL, zodat in-app browsers/WebKit een expliciete linkklik als echte navigatie
 * naar een downloadresponse kunnen behandelen.
 */
export async function maakProductiekernSignedDownloadUrl(
  pad: string,
  verlooptNaSeconden = 300,
): Promise<string> {
  const veiligPad = valideerProductiekernStoragePad(pad);
  if (!Number.isInteger(verlooptNaSeconden) || verlooptNaSeconden < 30 || verlooptNaSeconden > 900) {
    throw new Error('Ongeldige geldigheidsduur voor Productiekern-downloadlink.');
  }

  const { data, error } = await supabase.storage
    .from(PRODUCTIEKERN_STORAGE_BUCKET)
    .createSignedUrl(veiligPad, verlooptNaSeconden, { download: true });

  if (error) throw new Error(`Productiebestand-link maken mislukt: ${error.message}`);
  if (!data?.signedUrl) throw new Error('Tijdelijke Productiekern-downloadlink ontbreekt.');
  return data.signedUrl;
}
