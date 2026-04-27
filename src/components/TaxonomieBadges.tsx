// src/components/TaxonomieBadges.tsx
// Herbruikbare badges voor de nieuwe vastgoedtaxonomie:
//   - Type vastgoed         (1 badge)
//   - Subcategorieën        (max N badges + "+X")
//   - Dealtype / Propositie (max N badges + "+X")
//
// Valt netjes terug naar de legacy AssetClass-label als er nog geen
// nieuwe property_type_id beschikbaar is, zodat oude records niet leeg
// ogen.

import { ReactNode } from 'react';
import { usePropertyTaxonomie } from '@/hooks/usePropertyTaxonomie';
import { ASSET_CLASS_LABELS } from '@/data/mock-data';
import type { AssetClass } from '@/data/mock-data';

type Variant = 'default' | 'compact';

function ChipBase({
  children,
  tone = 'neutral',
  variant = 'default',
}: {
  children: ReactNode;
  tone?: 'type' | 'sub' | 'deal' | 'neutral';
  variant?: Variant;
}) {
  const toneCls =
    tone === 'type'
      ? 'bg-accent/12 text-accent border-accent/30'
      : tone === 'sub'
      ? 'bg-secondary/15 text-foreground border-secondary/25'
      : tone === 'deal'
      ? 'bg-primary/10 text-primary border-primary/25'
      : 'bg-muted text-muted-foreground border-border';
  const sizeCls =
    variant === 'compact'
      ? 'text-[10px] px-1.5 py-0.5'
      : 'text-[11px] px-2 py-0.5';
  return (
    <span
      className={`inline-flex items-center font-medium border rounded-full whitespace-nowrap ${toneCls} ${sizeCls}`}
    >
      {children}
    </span>
  );
}

interface ListProps {
  ids: string[] | undefined;
  /** Max te tonen badges; rest gaat naar "+X". Default 3. */
  max?: number;
  variant?: Variant;
  emptyLabel?: string;
  /** Toon empty-label als helemaal leeg. Default true. */
  showEmpty?: boolean;
}

/* ---------- Subcategorie ---------- */
export function SubtypeBadges({
  ids,
  max = 3,
  variant = 'default',
  emptyLabel = 'Geen subcategorie',
  showEmpty = true,
}: ListProps) {
  const { propertySubtypeById } = usePropertyTaxonomie();
  const list = (ids ?? [])
    .map(id => propertySubtypeById(id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  if (list.length === 0) {
    return showEmpty ? (
      <span className="text-[11px] italic text-muted-foreground">{emptyLabel}</span>
    ) : null;
  }

  const tonen = list.slice(0, max);
  const rest = list.length - tonen.length;
  return (
    <div className="flex flex-wrap gap-1">
      {tonen.map(s => (
        <ChipBase key={s.id} tone="sub" variant={variant}>
          {s.name}
        </ChipBase>
      ))}
      {rest > 0 && (
        <ChipBase tone="neutral" variant={variant}>
          +{rest}
        </ChipBase>
      )}
    </div>
  );
}

/* ---------- Dealtype ---------- */
export function DealtypeBadges({
  ids,
  max = 3,
  variant = 'default',
  emptyLabel = 'Geen dealtype',
  showEmpty = true,
}: ListProps) {
  const { dealTypeById } = usePropertyTaxonomie();
  const list = (ids ?? [])
    .map(id => dealTypeById(id))
    .filter((d): d is NonNullable<typeof d> => !!d);

  if (list.length === 0) {
    return showEmpty ? (
      <span className="text-[11px] italic text-muted-foreground">{emptyLabel}</span>
    ) : null;
  }

  const tonen = list.slice(0, max);
  const rest = list.length - tonen.length;
  return (
    <div className="flex flex-wrap gap-1">
      {tonen.map(d => (
        <ChipBase key={d.id} tone="deal" variant={variant}>
          {d.name}
        </ChipBase>
      ))}
      {rest > 0 && (
        <ChipBase tone="neutral" variant={variant}>
          +{rest}
        </ChipBase>
      )}
    </div>
  );
}

/* ---------- Property type (single) ---------- */
interface SingleTypeProps {
  id?: string | null;
  /** Legacy fallback wanneer er nog geen property_type_id is. */
  fallbackAssetClass?: AssetClass;
  variant?: Variant;
  emptyLabel?: string;
  showEmpty?: boolean;
}

export function PropertyTypeBadge({
  id,
  fallbackAssetClass,
  variant = 'default',
  emptyLabel = 'Geen type',
  showEmpty = true,
}: SingleTypeProps) {
  const { propertyTypeById } = usePropertyTaxonomie();
  const type = id ? propertyTypeById(id) : undefined;
  const label = type?.name ?? (fallbackAssetClass ? ASSET_CLASS_LABELS[fallbackAssetClass] : '');

  if (!label) {
    return showEmpty ? (
      <span className="text-[11px] italic text-muted-foreground">{emptyLabel}</span>
    ) : null;
  }

  return <ChipBase tone="type" variant={variant}>{label}</ChipBase>;
}

/* ---------- Property types (multi, voor zoekprofielen + relaties) ---------- */
interface MultiTypeProps {
  ids: string[] | undefined;
  /** Legacy fallback (asset_classes[]) wanneer er nog geen ids zijn. */
  fallbackAssetClasses?: AssetClass[];
  max?: number;
  variant?: Variant;
  emptyLabel?: string;
  showEmpty?: boolean;
}

export function PropertyTypeBadges({
  ids,
  fallbackAssetClasses,
  max = 3,
  variant = 'default',
  emptyLabel = 'Geen type vastgoed',
  showEmpty = true,
}: MultiTypeProps) {
  const { propertyTypeById } = usePropertyTaxonomie();

  let labels: string[] = (ids ?? [])
    .map(id => propertyTypeById(id)?.name)
    .filter((n): n is string => !!n);

  if (labels.length === 0 && fallbackAssetClasses && fallbackAssetClasses.length > 0) {
    labels = fallbackAssetClasses.map(ac => ASSET_CLASS_LABELS[ac]);
  }

  if (labels.length === 0) {
    return showEmpty ? (
      <span className="text-[11px] italic text-muted-foreground">{emptyLabel}</span>
    ) : null;
  }

  const tonen = labels.slice(0, max);
  const rest = labels.length - tonen.length;
  return (
    <div className="flex flex-wrap gap-1">
      {tonen.map((l, i) => (
        <ChipBase key={`${l}-${i}`} tone="type" variant={variant}>
          {l}
        </ChipBase>
      ))}
      {rest > 0 && (
        <ChipBase tone="neutral" variant={variant}>
          +{rest}
        </ChipBase>
      )}
    </div>
  );
}

/* ---------- Combinatieblok “Classificatie” voor detailpagina’s ---------- */
interface ClassificatieProps {
  propertyTypeId?: string | null;
  propertyTypeIds?: string[];
  fallbackAssetClass?: AssetClass;
  fallbackAssetClasses?: AssetClass[];
  subtypeIds?: string[];
  dealTypeIds?: string[];
  /** Single = object-detail (1 type), multi = relatie/zoekprofiel (n types). */
  mode?: 'single' | 'multi';
}

export function ClassificatieRij({
  propertyTypeId,
  propertyTypeIds,
  fallbackAssetClass,
  fallbackAssetClasses,
  subtypeIds,
  dealTypeIds,
  mode = 'single',
}: ClassificatieProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="field-label mb-1.5">Type vastgoed</p>
        {mode === 'single' ? (
          <PropertyTypeBadge id={propertyTypeId} fallbackAssetClass={fallbackAssetClass} />
        ) : (
          <PropertyTypeBadges
            ids={propertyTypeIds}
            fallbackAssetClasses={fallbackAssetClasses}
            max={6}
          />
        )}
      </div>
      <div>
        <p className="field-label mb-1.5">Subcategorieën</p>
        <SubtypeBadges ids={subtypeIds} max={6} />
      </div>
      <div>
        <p className="field-label mb-1.5">Dealtype / Propositie</p>
        <DealtypeBadges ids={dealTypeIds} max={6} />
      </div>
    </div>
  );
}
