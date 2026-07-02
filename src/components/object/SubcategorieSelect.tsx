// src/components/object/SubcategorieSelect.tsx
//
// Fase 1A.3 — Searchable Popover + Command i.p.v. native <select>.
// Props/interface ongewijzigd: { assetClass, value, onChange }.
// - Optioneel, single-select, asset-class-afhankelijk.
// - Bij wisselen van asset-class reset het component géén selectie zelf
//   (behoud bestaand gedrag); parent kan dat zoals voorheen sturen.
// - Toont "— Geen specifieke subcategorie —" als lege optie.

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import type { AssetClass } from '@/data/mock-data';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

interface Props {
  assetClass: AssetClass;
  value?: string;
  onChange: (id: string | undefined) => void;
}

const LEEG_LABEL = '— Geen specifieke subcategorie —';

export default function SubcategorieSelect({ assetClass, value, onChange }: Props) {
  const { forAssetClass, loading } = useSubcategorieen();
  const opties = forAssetClass(assetClass);
  const [open, setOpen] = useState(false);

  const gekozen = opties.find((o) => o.id === value);
  const triggerLabel = gekozen?.label ?? 'Kies subcategorie';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Subcategorie"
          disabled={loading}
          className={cn(
            'flex h-10 min-h-[44px] w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm font-normal',
            !gekozen && 'text-muted-foreground',
          )}
        >
          <span className="truncate text-left">{triggerLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
      >
        <Command>
          <CommandInput placeholder="Zoek subcategorie…" />
          <CommandList className="max-h-64">
            <CommandEmpty>Geen subcategorie gevonden.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__leeg__"
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                className="min-h-[44px]"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    !value ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <span className="text-muted-foreground">{LEEG_LABEL}</span>
              </CommandItem>
              {opties.map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.label}
                  onSelect={() => {
                    onChange(s.id);
                    setOpen(false);
                  }}
                  className="min-h-[44px]"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === s.id ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <span>{s.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
