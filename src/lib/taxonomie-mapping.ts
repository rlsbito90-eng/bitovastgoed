// src/lib/taxonomie-mapping.ts
// Helpers om de nieuwe property_types <-> de oude AssetClass enum
// te vertalen, zodat bestaande filters/matching/badges blijven werken
// terwijl alle invoer naar het nieuwe model gaat.

import type { AssetClass } from '@/data/mock-data';

/**
 * Map van property_type slug naar de meest passende legacy AssetClass.
 * Asset classes die niet 1:1 bestaan vallen terug op een dichtstbijzijnde keuze
 * (bv. 'leisure' -> 'hotels'). Onbekend -> 'wonen' (default).
 */
export const PROPERTY_TYPE_SLUG_NAAR_ASSET_CLASS: Record<string, AssetClass> = {
  residentieel: 'wonen',
  commercieel: 'kantoren',
  kantoor: 'kantoren',
  retail: 'winkels',
  bedrijfsruimte: 'bedrijfshallen',
  logistiek: 'logistiek',
  light_industrial: 'industrieel',
  zorg: 'zorgvastgoed',
  leisure: 'hotels',
  mixed_use: 'mixed_use',
  ontwikkellocatie: 'ontwikkellocatie',
  transformatie: 'ontwikkellocatie',
  maatschappelijk: 'mixed_use',
  agrarisch: 'ontwikkellocatie',
  parkeren: 'mixed_use',
  alternatief: 'mixed_use',
  portefeuille: 'wonen',
};

export function propertyTypeSlugNaarAssetClass(slug?: string | null): AssetClass {
  if (!slug) return 'wonen';
  return PROPERTY_TYPE_SLUG_NAAR_ASSET_CLASS[slug] ?? 'wonen';
}

/**
 * Reverse: vanuit een legacy AssetClass de meest waarschijnlijke property_type slug.
 * Wordt gebruikt om bij oude objecten een sensible default voor te stellen.
 */
export const ASSET_CLASS_NAAR_PROPERTY_TYPE_SLUG: Record<AssetClass, string> = {
  wonen: 'residentieel',
  winkels: 'retail',
  kantoren: 'kantoor',
  logistiek: 'logistiek',
  bedrijfshallen: 'bedrijfsruimte',
  industrieel: 'light_industrial',
  hotels: 'leisure',
  zorgvastgoed: 'zorg',
  mixed_use: 'mixed_use',
  ontwikkellocatie: 'ontwikkellocatie',
};
