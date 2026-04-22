// src/lib/storage.ts
// Helpers voor Supabase Storage — uploads, signed URLs, deletions.
// Bucket: 'bito-objecten' (privé, 50MB limiet, RLS = intern).
//
// Pad-conventie:
//   {object_id}/documenten/{uuid}_{originele_naam}
//   {object_id}/fotos/{uuid}_{originele_naam}

import { supabase } from '@/integrations/supabase/client';

export const BUCKET_OBJECTEN = 'bito-objecten';

// Afgeleide waarden die ook elders in UI gebruikt kunnen worden
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_FILE_SIZE_MB = 50;

const FOTO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

// ---------------------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------------------

function randomId(): string {
  // Korte base36 uuid-achtig id. Niet cryptografisch, alleen om collisions te vermijden.
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function sanitiseFilename(name: string): string {
  // Vervang niet-ASCII en speciale tekens door '_'. Behoud extensie.
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);
}

export function isFotoFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return FOTO_EXTENSIONS.includes(ext) || file.type.startsWith('image/');
}

export function formatFileSize(bytes?: number): string {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------
// PAD-GENERATIE
// ---------------------------------------------------------------------

export function buildDocumentPath(objectId: string, filename: string): string {
  return `${objectId}/documenten/${randomId()}_${sanitiseFilename(filename)}`;
}

export function buildFotoPath(objectId: string, filename: string): string {
  return `${objectId}/fotos/${randomId()}_${sanitiseFilename(filename)}`;
}

// ---------------------------------------------------------------------
// UPLOAD
// ---------------------------------------------------------------------

export interface UploadResult {
  storagePath: string;
  bestandsnaam: string;
  bestandsgrootteBytes: number;
  mimeType: string;
}

export async function uploadBestand(
  path: string,
  file: File,
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`Bestand is groter dan ${MAX_FILE_SIZE_MB} MB`);
  }

  const { error } = await supabase.storage
    .from(BUCKET_OBJECTEN)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    console.warn('Upload naar storage mislukt');
    throw new Error('Upload mislukt. Probeer het opnieuw.');
  }

  return {
    storagePath: path,
    bestandsnaam: file.name,
    bestandsgrootteBytes: file.size,
    mimeType: file.type || 'application/octet-stream',
  };
}

// ---------------------------------------------------------------------
// SIGNED URL (voor privé-bucket: tijdelijke download-URL)
// ---------------------------------------------------------------------

export async function getSignedUrl(
  storagePath: string,
  expiresInSec = 60 * 10, // 10 minuten
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_OBJECTEN)
    .createSignedUrl(storagePath, expiresInSec);

  if (error || !data?.signedUrl) {
    console.warn('Kon geen signed URL genereren');
    throw new Error('Bestand kon niet worden opgehaald.');
  }
  return data.signedUrl;
}

// Batch: handig voor foto's grids waar we tientallen urls nodig hebben
export async function getSignedUrls(
  paths: string[],
  expiresInSec = 60 * 10,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(BUCKET_OBJECTEN)
    .createSignedUrls(paths, expiresInSec);

  if (error) {
    console.warn('Kon signed URLs niet ophalen');
    return {};
  }
  const out: Record<string, string> = {};
  (data ?? []).forEach(r => {
    if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  });
  return out;
}

// ---------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------

export async function deleteBestand(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_OBJECTEN)
    .remove([storagePath]);
  if (error) {
    console.warn('Verwijderen uit storage mislukt');
    // Niet hard falen — meestal is de DB-rij belangrijker dan het bestand.
  }
}

export async function deleteBestanden(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) return;
  const { error } = await supabase.storage
    .from(BUCKET_OBJECTEN)
    .remove(storagePaths);
  if (error) {
    console.warn('Bulk verwijderen uit storage mislukt');
  }
}
