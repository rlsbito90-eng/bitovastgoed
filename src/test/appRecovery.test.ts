import { describe, expect, it } from 'vitest';
import { isRecoverableAssetError } from '@/lib/appRecovery';

describe('isRecoverableAssetError', () => {
  it.each([
    'Failed to fetch dynamically imported module',
    'Importing a module script failed',
    'ChunkLoadError: Loading chunk 42 failed',
    'Error loading dynamically imported module',
    new Error('Load failed'),
  ])('herkent verouderde of ontbrekende frontend-assets: %s', (value) => {
    expect(isRecoverableAssetError(value)).toBe(true);
  });

  it.each([
    'Netwerkverzoek mislukt',
    'Onbekende databasefout',
    new Error('Cannot read properties of undefined'),
    null,
  ])('start geen cacheherstel voor algemene fouten: %s', (value) => {
    expect(isRecoverableAssetError(value)).toBe(false);
  });
});
