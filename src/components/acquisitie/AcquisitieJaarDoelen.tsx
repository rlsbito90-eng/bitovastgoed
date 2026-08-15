import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { AcquisitieJaarActuals } from '@/hooks/useAcquisitieTrackingPrestaties';
import { toast } from 'sonner';

interface JaarDoelRow {
  id: string;
  jaar: number;
  acquisitie_brieven_doel?: number | null;
  acquisitie_responspercentage_doel?: number | null;
  acquisitie_positieve_responspercentage_doel?: number | null;
  acquisitie_kadaster_aanvragen_doel?: number | null;
  acquisitie_kadaster_budget_doel?: number | null;
}

interface DoelForm {
  brieven: string;
  respons: string;
  positieveRespons: string;
  kadasterAanvragen: string;
  kadasterBudget: string;
}

const leegForm: DoelForm = {
  brieven: '',
  respons: '',
  positieveRespons: '',
  kadasterAanvragen: '',
  kadasterBudget: '',
};

const nummerOfNull = (value: string) => value.trim() === '' ? null : Number(value.replace(',', '.'));

const formUitDoel = (doel: JaarDoelRow | null): DoelForm => doel ? {
  brieven: doel.acquisitie_brieven_doel?.toString() ?? '',
  respons: doel.acquisitie_responspercentage_doel?.toString() ?? '',
  positieveRespons: doel.acquisitie_positieve_responspercentage_doel?.toString() ?? '',
  kadasterAanvragen: doel.acquisitie_kadaster_aanvragen_doel?.toString() ?? '',
  kadasterBudget: doel.acquisitie_kadaster_budget_doel?.toString() ?? '',
} : leegForm;

const euro = (value: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 2,
}).format(value);

const pct = (value: number) => `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value)}%`;

export default function AcquisitieJaarDoelen({
  jaar,
  actuals,
}: {
  jaar: number;
  actuals: AcquisitieJaarActuals;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<DoelForm>(leegForm);

  const doelQuery = useQuery({
    queryKey: ['acquisitie-jaardoel', jaar],
    queryFn: async (): Promise<JaarDoelRow | null> => {
      const { data, error } = await (supabase as any)
        .from('jaar_doelen')
        .select('*')
        .eq('jaar', jaar)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as JaarDoelRow | null;
    },
    staleTime: 60_000,
  });

  const doel = doelQuery.data ?? null;
  const heeftAcquisitieDoel = !!doel && [
    doel.acquisitie_brieven_doel,
    doel.acquisitie_responspercentage_doel,
    doel.acquisitie_positieve_responspercentage_doel,
    doel.acquisitie_kadaster_aanvragen_doel,
    doel.acquisitie_kadaster_budget_doel,
  ].some(value => value != null);

  const opslaan = useMutation({
    mutationFn: async (waarden: DoelForm) => {
      const payload = {
        acquisitie_brieven_doel: nummerOfNull(waarden.brieven),
        acquisitie_responspercentage_doel: nummerOfNull(waarden.respons),
        acquisitie_positieve_responspercentage_doel: nummerOfNull(waarden.positieveRespons),
        acquisitie_kadaster_aanvragen_doel: nummerOfNull(waarden.kadasterAanvragen),
        acquisitie_kadaster_budget_doel: nummerOfNull(waarden.kadasterBudget),
      };

      for (const [naam, value] of Object.entries(payload)) {
        if (value != null && (!Number.isFinite(value) || value < 0)) throw new Error(`${naam} moet 0 of hoger zijn.`);
      }
      if (payload.acquisitie_responspercentage_doel != null && payload.acquisitie_responspercentage_doel > 100) {
        throw new Error('Responsdoel moet tussen 0 en 100% liggen.');
      }
      if (payload.acquisitie_positieve_responspercentage_doel != null && payload.acquisitie_positieve_responspercentage_doel > 100) {
        throw new Error('Positief responsdoel moet tussen 0 en 100% liggen.');
      }

      if (doel?.id) {
        const { error } = await (supabase as any).from('jaar_doelen').update(payload).eq('id', doel.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await (supabase as any).from('jaar_doelen').insert({ jaar, ...payload });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['acquisitie-jaardoel', jaar] });
      setOpen(false);
      toast.success(`Acquisitiedoelen ${jaar} opgeslagen.`);
    },
    onError: (error: Error) => toast.error(error.message || 'Acquisitiedoelen opslaan mislukt.'),
  });

  const kaarten = useMemo(() => {
    if (!doel) return [];
    return [
      doel.acquisitie_brieven_doel != null ? {
        label: 'Verzonden brieven', actual: actuals.verzondenCommunicaties, doel: Number(doel.acquisitie_brieven_doel), format: String,
      } : null,
      doel.acquisitie_responspercentage_doel != null ? {
        label: 'Respons', actual: actuals.responspercentage, doel: Number(doel.acquisitie_responspercentage_doel), format: pct,
      } : null,
      doel.acquisitie_positieve_responspercentage_doel != null ? {
        label: 'Positieve respons', actual: actuals.positieveResponspercentage, doel: Number(doel.acquisitie_positieve_responspercentage_doel), format: pct,
      } : null,
      doel.acquisitie_kadaster_aanvragen_doel != null ? {
        label: 'Kadaster-aanvragen', actual: actuals.kadasterAanvragen, doel: Number(doel.acquisitie_kadaster_aanvragen_doel), format: String,
      } : null,
      doel.acquisitie_kadaster_budget_doel != null ? {
        label: 'Kadasterbudget', actual: actuals.kadasterKostenBesteBeschikbaar, doel: Number(doel.acquisitie_kadaster_budget_doel), format: euro, budget: true,
      } : null,
    ].filter(Boolean) as Array<{ label: string; actual: number; doel: number; format: (v: number) => string; budget?: boolean }>;
  }, [doel, actuals]);

  if (doelQuery.isError) return null;

  const openEditor = () => {
    setForm(formUitDoel(doel));
    setOpen(true);
  };

  return (
    <div className="border-t border-border pt-3" data-testid="acquisitie-jaardoelen">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Target className="h-3.5 w-3.5" /> Jaardoelen {jaar}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Actuals komen automatisch uit de acquisitie-meetlaag.</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={openEditor}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" /> {heeftAcquisitieDoel ? 'Doelen wijzigen' : 'Doelen instellen'}
        </Button>
      </div>

      {!heeftAcquisitieDoel ? (
        <div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          Nog geen acquisitiedoelen voor {jaar}. Stel alleen doelen in die je daadwerkelijk wilt sturen; registratie van actuals blijft automatisch.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {kaarten.map(kaart => <DoelKaart key={kaart.label} {...kaart} />)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Acquisitiedoelen {jaar}</DialogTitle>
            <DialogDescription>
              Deze waarden worden opgeslagen op het bestaande jaardoel. Laat een veld leeg als je er niet op wilt sturen.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DoelVeld label="Verzonden brieven" value={form.brieven} onChange={brieven => setForm(v => ({ ...v, brieven }))} />
            <DoelVeld label="Responsdoel (%)" value={form.respons} onChange={respons => setForm(v => ({ ...v, respons }))} step="0.1" />
            <DoelVeld label="Positieve respons (%)" value={form.positieveRespons} onChange={positieveRespons => setForm(v => ({ ...v, positieveRespons }))} step="0.1" />
            <DoelVeld label="Kadaster-aanvragen" value={form.kadasterAanvragen} onChange={kadasterAanvragen => setForm(v => ({ ...v, kadasterAanvragen }))} />
            <DoelVeld label="Kadasterbudget (€)" value={form.kadasterBudget} onChange={kadasterBudget => setForm(v => ({ ...v, kadasterBudget }))} step="0.01" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={opslaan.isPending}>Annuleren</Button>
            <Button type="button" onClick={() => opslaan.mutate(form)} disabled={opslaan.isPending}>
              {opslaan.isPending ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DoelVeld({ label, value, onChange, step = '1' }: { label: string; value: string; onChange: (value: string) => void; step?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type="number" min="0" step={step} value={value} onChange={event => onChange(event.target.value)} />
    </div>
  );
}

function DoelKaart({
  label, actual, doel, format, budget = false,
}: {
  label: string;
  actual: number;
  doel: number;
  format: (value: number) => string;
  budget?: boolean;
}) {
  const verhouding = doel > 0 ? actual / doel : 0;
  const breedte = Math.min(100, Math.max(0, verhouding * 100));
  const status = budget
    ? actual <= doel ? 'binnen budget' : 'boven budget'
    : verhouding >= 1 ? 'doel behaald' : `${Math.round(verhouding * 100)}%`;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold font-mono-data">{format(actual)}</div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">doel {format(doel)} · {status}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70" style={{ width: `${breedte}%` }} />
      </div>
    </div>
  );
}
