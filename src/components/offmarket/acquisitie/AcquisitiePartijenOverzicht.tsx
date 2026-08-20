import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Building2, UserRound, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PartijOverzicht } from '@/lib/offMarket/acquisitie/partijOverzicht';

interface Props {
  partijen: readonly PartijOverzicht[];
  isLoading?: boolean;
  onOpenSignaal?: (signaalId: string) => void;
}

function datumKort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

const ADVIES_LABEL: Record<PartijOverzicht['advies'], string> = {
  normaal: 'Normaal',
  portefeuille: 'Portefeuille',
  recent_benaderd: 'Recent benaderd',
  warm_contact: 'Bestaand contact',
  niet_opnieuw: 'Niet opnieuw koud benaderen',
};

export default function AcquisitiePartijenOverzicht({ partijen, isLoading, onOpenSignaal }: Props) {
  const [open, setOpen] = useState(false);
  const [uitgeklapt, setUitgeklapt] = useState<Set<string>>(new Set());

  const statistiek = useMemo(() => ({
    totaal: partijen.length,
    meerdereObjecten: partijen.filter((p) => p.objecten.length > 1).length,
    eerderBenaderd: partijen.filter((p) => p.verstuurdAantal > 0).length,
    aandacht: partijen.filter((p) => ['recent_benaderd', 'warm_contact', 'niet_opnieuw'].includes(p.advies)).length,
  }), [partijen]);

  const toggle = (key: string) => setUitgeklapt((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <section className="section-card overflow-hidden" data-testid="acquisitie-partijen-overzicht">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Eigenaren &amp; portefeuilles</p>
          <p className="text-[11px] text-muted-foreground">
            {isLoading
              ? 'Partijhistorie laden…'
              : `${statistiek.totaal} partijen · ${statistiek.meerdereObjecten} met meerdere objecten · ${statistiek.eerderBenaderd} eerder benaderd`}
          </p>
        </div>
        {!isLoading && statistiek.aandacht > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900">
            <ShieldAlert className="h-3 w-3" /> {statistiek.aandacht} aandacht
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-border/70">
          {isLoading ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Partijen en contacthistorie laden…</p>
          ) : partijen.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Nog geen herkenbare eigenaren of geadresseerden.</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {partijen.map((partij) => {
                const expanded = uitgeklapt.has(partij.key);
                const aandacht = partij.advies !== 'normaal' && partij.advies !== 'portefeuille';
                return (
                  <li key={partij.key} className="px-3 py-2.5" data-testid="acquisitie-partij-rij">
                    <button
                      type="button"
                      onClick={() => toggle(partij.key)}
                      className="flex w-full items-start gap-2 text-left"
                      aria-expanded={expanded}
                    >
                      {expanded ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      {partij.soort === 'bedrijf'
                        ? <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        : <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground break-words">{partij.naam}</span>
                          <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {partij.objecten.length} object{partij.objecten.length === 1 ? '' : 'en'}
                          </span>
                          {partij.verstuurdAantal > 0 && (
                            <span className="rounded-full border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {partij.verstuurdAantal} verstuurd
                            </span>
                          )}
                          {partij.advies !== 'normaal' && (
                            <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                              aandacht ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-accent/10 text-accent border-accent/30'
                            }`}>
                              {ADVIES_LABEL[partij.advies]}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Laatste contact: {datumKort(partij.laatsteContactOp)}
                          {partij.laatsteRespons ? ` · reactie: ${partij.laatsteRespons.replaceAll('_', ' ')}` : ''}
                        </p>
                      </div>
                    </button>

                    {expanded && (
                      <div className="ml-9 mt-2 space-y-2 border-l border-border/70 pl-3">
                        {partij.verzendadres && (
                          <p className="whitespace-pre-line text-[11px] text-muted-foreground">
                            Correspondentieadres: {partij.verzendadres}
                          </p>
                        )}
                        <div>
                          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Objecten / signalen</p>
                          <ul className="space-y-1">
                            {partij.objecten.map((object) => (
                              <li key={object.signaalId} className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="min-w-0 flex-1 break-words">{object.adres}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() => onOpenSignaal?.(object.signaalId)}
                                >
                                  Open
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {partij.briefAantal} briefrecord{partij.briefAantal === 1 ? '' : 's'} · {partij.verstuurdAantal} daadwerkelijk verstuurd.
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
