// src/components/object/SubcategorieSelect.tsx
//
// Fase 1A.3 + mobiele fix — Searchable selector voor object-subcategorieën.
// Props/interface ongewijzigd: { assetClass, value, onChange }.
//
// - Desktop/tablet: shadcn Popover + Command met verbeterde collision handling.
// - Mobiel (<768px): bottom Drawer met Command-search en scrollbare lijst,
//   zodat lange lijsten (bv. bedrijfshallen) niet worden afgekapt door de
//   modal, viewport of toetsenbord.
// - Single-select, optioneel, "Geen specifieke subcategorie", asset-class
//   afhankelijk. onChange/waarde-flow ongewijzigd.

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import type { AssetClass } from '@/data/mock-data';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
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
  const isMobile = useIsMobile();

  const gekozen = opties.find((o) => o.id === value);
  const triggerLabel = gekozen?.label ?? 'Kies subcategorie';

  const triggerButton = (
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
  );

  const commandList = (
    <Command>
      <CommandInput placeholder="Zoek subcategorie…" />
      <CommandList
        className={cn(
          'overflow-y-auto overscroll-contain',
          isMobile ? 'max-h-[55vh]' : 'max-h-64',
        )}
      >
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
              className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')}
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
                className={cn('mr-2 h-4 w-4', value === s.id ? 'opacity-100' : 'opacity-0')}
                aria-hidden
              />
              <span>{s.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-base">Subcategorie</DrawerTitle>
          </DrawerHeader>
          <div className="px-2 pb-4">{commandList}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={4}
        collisionPadding={16}
        avoidCollisions
        className="w-[--radix-popover-trigger-width] p-0"
      >
        {commandList}
      </PopoverContent>
    </Popover>
  );
}
