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
