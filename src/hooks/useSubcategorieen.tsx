// src/hooks/useSubcategorieen.tsx
// Laadt de object_subcategorieen lookup-tabel één keer en cached hem.
// Met filter-helpers per asset class.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AssetClass, ObjectSubcategorie } from '@/data/mock-data';

interface SubcategorieStore {
  all: ObjectSubcategorie[];
  loading: boolean;
  forAssetClass: (ac: AssetClass) => ObjectSubcategorie[];
  byId: (id: string) => ObjectSubcategorie | undefined;
  labelFor: (id?: string | null) => string;
}

const SubcategorieContext = createContext<SubcategorieStore | null>(null);

function fromDb(r: any): ObjectSubcategorie {
  return {
    id: r.id,
    assetClass: r.asset_class,
    subcategorieKey: r.subcategorie_key,
    label: r.label,
    beschrijving: r.beschrijving ?? undefined,
    volgorde: r.volgorde ?? 0,
    actief: r.actief ?? true,
  };
}

export function SubcategorieProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<ObjectSubcategorie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('object_subcategorieen')
        .select('*')
        .eq('actief', true)
        .order('asset_class', { ascending: true })
        .order('volgorde', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.warn('Subcategorieen konden niet worden geladen');
        setAll([]);
      } else {
        setAll((data ?? []).map(fromDb));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const store: SubcategorieStore = {
    all,
    loading,
    forAssetClass: (ac) => all.filter(s => s.assetClass === ac),
    byId: (id) => all.find(s => s.id === id),
    labelFor: (id) => (id ? all.find(s => s.id === id)?.label ?? id : ''),
  };

  return (
    <SubcategorieContext.Provider value={store}>
      {children}
    </SubcategorieContext.Provider>
  );
}

export function useSubcategorieen() {
  const ctx = useContext(SubcategorieContext);
  if (!ctx) throw new Error('useSubcategorieen moet binnen SubcategorieProvider staan');
  return ctx;
}
