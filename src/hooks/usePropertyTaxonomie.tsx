// src/hooks/usePropertyTaxonomie.tsx
// Laadt en cachet de nieuwe vastgoedtaxonomie:
//   - property_types         (17 hoofdgroepen)
//   - property_subtypes      (afhankelijk van type)
//   - deal_types             (proposities, multi-select)
//
// Provider draait globaal in App.tsx zodat overal labels/optielijsten
// beschikbaar zijn zonder extra fetches.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PropertyType {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PropertySubtype {
  id: string;
  propertyTypeId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface DealType {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

interface TaxonomieStore {
  loading: boolean;
  propertyTypes: PropertyType[];
  propertySubtypes: PropertySubtype[];
  dealTypes: DealType[];
  subtypesForType: (typeId?: string | null) => PropertySubtype[];
  subtypesForTypes: (typeIds: string[]) => PropertySubtype[];
  propertyTypeById: (id?: string | null) => PropertyType | undefined;
  propertySubtypeById: (id?: string | null) => PropertySubtype | undefined;
  dealTypeById: (id?: string | null) => DealType | undefined;
  labelType: (id?: string | null) => string;
  labelSubtype: (id?: string | null) => string;
  labelDealtype: (id?: string | null) => string;
}

const TaxonomieContext = createContext<TaxonomieStore | null>(null);

const ptFromDb = (r: any): PropertyType => ({
  id: r.id, name: r.name, slug: r.slug, sortOrder: r.sort_order ?? 0, isActive: r.is_active !== false,
});
const psFromDb = (r: any): PropertySubtype => ({
  id: r.id, propertyTypeId: r.property_type_id, name: r.name, slug: r.slug,
  sortOrder: r.sort_order ?? 0, isActive: r.is_active !== false,
});
const dtFromDb = (r: any): DealType => ({
  id: r.id, name: r.name, slug: r.slug, sortOrder: r.sort_order ?? 0, isActive: r.is_active !== false,
});

export function PropertyTaxonomieProvider({ children }: { children: React.ReactNode }) {
  const [propertyTypes, setPropertyTypes] = useState<PropertyType[]>([]);
  const [propertySubtypes, setPropertySubtypes] = useState<PropertySubtype[]>([]);
  const [dealTypes, setDealTypes] = useState<DealType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ptRes, psRes, dtRes] = await Promise.all([
        supabase.from('property_types').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('property_subtypes').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('deal_types').select('*').eq('is_active', true).order('sort_order'),
      ]);
      if (cancelled) return;
      if (!ptRes.error && ptRes.data) setPropertyTypes(ptRes.data.map(ptFromDb));
      if (!psRes.error && psRes.data) setPropertySubtypes(psRes.data.map(psFromDb));
      if (!dtRes.error && dtRes.data) setDealTypes(dtRes.data.map(dtFromDb));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<TaxonomieStore>(() => {
    const ptById = new Map(propertyTypes.map(p => [p.id, p]));
    const psById = new Map(propertySubtypes.map(p => [p.id, p]));
    const dtById = new Map(dealTypes.map(p => [p.id, p]));
    return {
      loading,
      propertyTypes,
      propertySubtypes,
      dealTypes,
      subtypesForType: (typeId) => typeId ? propertySubtypes.filter(s => s.propertyTypeId === typeId) : [],
      subtypesForTypes: (typeIds) => typeIds.length === 0 ? [] : propertySubtypes.filter(s => typeIds.includes(s.propertyTypeId)),
      propertyTypeById: (id) => id ? ptById.get(id) : undefined,
      propertySubtypeById: (id) => id ? psById.get(id) : undefined,
      dealTypeById: (id) => id ? dtById.get(id) : undefined,
      labelType: (id) => id ? (ptById.get(id)?.name ?? '') : '',
      labelSubtype: (id) => id ? (psById.get(id)?.name ?? '') : '',
      labelDealtype: (id) => id ? (dtById.get(id)?.name ?? '') : '',
    };
  }, [propertyTypes, propertySubtypes, dealTypes, loading]);

  return (
    <TaxonomieContext.Provider value={value}>
      {children}
    </TaxonomieContext.Provider>
  );
}

export function usePropertyTaxonomie() {
  const ctx = useContext(TaxonomieContext);
  if (!ctx) throw new Error('usePropertyTaxonomie moet binnen PropertyTaxonomieProvider staan');
  return ctx;
}
