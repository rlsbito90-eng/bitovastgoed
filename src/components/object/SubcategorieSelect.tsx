// src/components/object/SubcategorieSelect.tsx
// Dependent select: subcategorieën worden gefilterd op de gekozen asset class.
// Valt terug op "Geen specifieke subcategorie" als type nog niet gekozen is.

import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import type { AssetClass } from '@/data/mock-data';

interface Props {
  assetClass: AssetClass;
  value?: string;
  onChange: (id: string | undefined) => void;
}

export default function SubcategorieSelect({ assetClass, value, onChange }: Props) {
  const { forAssetClass, loading } = useSubcategorieen();
  const opties = forAssetClass(assetClass);

  return (
    <select
      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
      value={value ?? ''}
      onChange={e => onChange(e.target.value || undefined)}
      disabled={loading}
    >
      <option value="">— Geen specifieke subcategorie —</option>
      {opties.map(s => (
        <option key={s.id} value={s.id}>{s.label}</option>
      ))}
    </select>
  );
}
