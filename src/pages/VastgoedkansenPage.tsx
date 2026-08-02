import { useMemo, useState } from 'react';
import { Plus, Search, Pencil, MapPin, Database } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import {
  STATUS_LABEL,
  STATUS_VOLGORDE,
  HERKOMST_LABEL,
  PRIORITEIT_LABEL,
  kansTitel,
  type Vastgoedkans,
  type VastgoedkansStatus,
} from '@/lib/vastgoedkansen';
import VastgoedkansFormDialog from '@/components/forms/VastgoedkansFormDialog';

export default function VastgoedkansenPage() {
  const { kansen, laden } = useVastgoedkansen();
  const [werkbak, setWerkbak] = useState<VastgoedkansStatus | 'alles'>('te_beoordelen');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<{ open: boolean; kans: Vastgoedkans | null }>({ open: false, kans: null });

  const counts = useMemo(
    () => Object.fromEntries(STATUS_VOLGORDE.map((status) => [status, kansen.filter((kans) => kans.status === status).length])),
    [kansen],
  );

  const list = useMemo(
    () => kansen.filter((kans) => {
      if (werkbak !== 'alles' && kans.status !== werkbak) return false;
      if (!q) return true;
      const zoektekst = [
        kans.korteOmschrijving,
        kans.adres,
        kans.postcode,
        kans.plaats,
        kans.typeVastgoed,
        kans.redenInteressant,
      ].filter(Boolean).join(' ').toLowerCase();
      return zoektekst.includes(q.toLowerCase());
    }),
    [kansen, werkbak, q],
  );

  return (
    <div className="page-shell-wide min-w-0 overflow-x-hidden">
      <PageHeader
        title="Vastgoedkansen"
        subtitle="Criteriagedreven pandenselectie en mailingfunnel — vóór een pand een CRM-Object wordt."
        actions={
          <Button onClick={() => setForm({ open: true, kans: null })}>
            <Plus className="mr-1.5 h-4 w-4" /> Nieuwe kans
          </Button>
        }
      />

      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {STATUS_VOLGORDE.map((status) => (
          <button
            key={status}
            onClick={() => setWerkbak(status)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === status ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}
          >
            {STATUS_LABEL[status]} <span className="ml-1 opacity-70">{counts[status]}</span>
          </button>
        ))}
        <button
          onClick={() => setWerkbak('alles')}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${werkbak === 'alles' ? 'bg-foreground text-background' : 'bg-card text-muted-foreground'}`}
        >
          Alles {kansen.length}
        </button>
      </div>

      <div className="relative max-w-xl min-w-0">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="min-w-0 pl-9" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Zoek adres, plaats, type of reden…" />
      </div>

      <section className="section-card min-w-0 overflow-hidden">
        {laden ? (
          <p className="p-8 text-sm text-muted-foreground">Laden…</p>
        ) : list.length === 0 ? (
          <div className="p-10 text-center">
            <Database className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">Geen vastgoedkansen in deze werkbak.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {list.map((kans) => (
              <div key={kans.id} className="flex min-w-0 items-start gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="min-w-0 break-words text-sm font-medium">{kansTitel(kans)}</p>
                    {kans.kansnummer && <span className="text-[11px] font-mono-data text-muted-foreground">{kans.kansnummer}</span>}
                    <Badge variant="outline" title={PRIORITEIT_LABEL[kans.prioriteit]}>{PRIORITEIT_LABEL[kans.prioriteit] ?? `P${kans.prioriteit}`}</Badge>
                    {kans.algoritmeScore != null && <Badge variant="secondary">Score {kans.algoritmeScore}</Badge>}
                  </div>
                  {kans.korteOmschrijving && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[kans.adres, kans.postcode, kans.plaats].filter(Boolean).join(', ')}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                    <span>{kans.typeVastgoed || 'Type onbekend'}</span>
                    <span>· {HERKOMST_LABEL[kans.herkomst]}</span>
                    <span>· Eigenaar: {kans.eigenaarStatus.replace('_', ' ')}</span>
                    <span>· Brief: {kans.briefStatus.replace('_', ' ')}</span>
                  </p>
                  {kans.redenInteressant && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{kans.redenInteressant}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, kans })} aria-label="Bewerken" className="shrink-0">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="flex min-w-0 gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0" />
        <p>Deze eerste versie ondersteunt handmatige invoer. BAG/PDOK-selectie, kaartselectie, CSV-import, scoring, eigenaarsonderzoek en brieven volgen als afzonderlijke gecontroleerde rondes.</p>
      </div>

      <VastgoedkansFormDialog
        open={form.open}
        onOpenChange={(open) => setForm({ open, kans: open ? form.kans : null })}
        kans={form.kans}
      />
    </div>
  );
}
