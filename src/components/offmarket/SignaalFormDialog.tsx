import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { NumberField } from '@/components/ui/number-field';
import { toast } from 'sonner';
import { useFormDirtyGuard } from '@/hooks/useFormDirtyGuard';
import {
  ASSETTYPE_LABEL, BRON_TYPE_LABEL, SIGNAALTYPE_LABEL,
  STATUS_LABEL, STATUS_VOLGORDE, PRIORITEIT_LABEL, PRIORITEIT_VOLGORDE,
  PROVINCIES,
  type OffMarketAssettype, type OffMarketBronType, type OffMarketSignaaltype,
  type OffMarketStatus, type OffMarketPrioriteit, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import {
  SIGNAAL_LEEG, signaalToFormState, formStateToPayload, validateSignaal,
  type SignaalFormState,
} from '@/lib/offMarket/form';
import { useCreateOffMarketSignaal, useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  signaal?: OffMarketSignaal | null;
  onSaved?: (id: string) => void;
}

const selectCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm';

export default function SignaalFormDialog({ open, onOpenChange, signaal, onSaved }: Props) {
  const [form, setForm] = useState<SignaalFormState>(SIGNAAL_LEEG);
  const [errors, setErrors] = useState<Partial<Record<keyof SignaalFormState, string>>>({});
  const create = useCreateOffMarketSignaal();
  const update = useUpdateOffMarketSignaal();
  const isEdit = !!signaal;
  const bezig = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(signaal ? signaalToFormState(signaal) : SIGNAAL_LEEG);
    setErrors({});
  }, [open, signaal]);

  const upd = <K extends keyof SignaalFormState>(k: K, v: SignaalFormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateSignaal(form);
    if (!v.ok) { setErrors(v.errors); toast.error('Vul de verplichte velden in.'); return; }
    setErrors({});
    try {
      const payload = formStateToPayload(form);
      const row = isEdit && signaal
        ? await update.mutateAsync({ id: signaal.id, patch: payload })
        : await create.mutateAsync(payload);
      toast.success(isEdit ? 'Signaal bijgewerkt.' : 'Signaal aangemaakt.');
      onOpenChange(false);
      onSaved?.(row.id);
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt.');
    }
  };

  const { guardedOnOpenChange } = useFormDirtyGuard(open, form, onOpenChange);
  const err = (k: keyof SignaalFormState) => errors[k] && <p className="text-xs text-destructive mt-1">{errors[k]}</p>;

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Signaal bewerken' : 'Nieuw off-market signaal'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Titel <span className="text-destructive">*</span></Label>
            <Input value={form.titel} onChange={e => upd('titel', e.target.value)} placeholder="Bijv. Leegstaand kantoor Stationsweg" />
            {err('titel')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Assettype <span className="text-destructive">*</span></Label>
              <select className={selectCls} value={form.assettype} onChange={e => upd('assettype', e.target.value as OffMarketAssettype)}>
                {(Object.keys(ASSETTYPE_LABEL) as OffMarketAssettype[]).map(a => (
                  <option key={a} value={a}>{ASSETTYPE_LABEL[a]}</option>
                ))}
              </select>
              {err('assettype')}
            </div>
            <div>
              <Label>Type signaal <span className="text-destructive">*</span></Label>
              <select className={selectCls} value={form.type_signaal} onChange={e => upd('type_signaal', e.target.value as OffMarketSignaaltype)}>
                {(Object.keys(SIGNAALTYPE_LABEL) as OffMarketSignaaltype[]).map(t => (
                  <option key={t} value={t}>{SIGNAALTYPE_LABEL[t]}</option>
                ))}
              </select>
              {err('type_signaal')}
            </div>
            <div>
              <Label>Bron <span className="text-destructive">*</span></Label>
              <select className={selectCls} value={form.bron_type} onChange={e => upd('bron_type', e.target.value as OffMarketBronType)}>
                {(Object.keys(BRON_TYPE_LABEL) as OffMarketBronType[]).map(b => (
                  <option key={b} value={b}>{BRON_TYPE_LABEL[b]}</option>
                ))}
              </select>
              {err('bron_type')}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status <span className="text-destructive">*</span></Label>
              <select className={selectCls} value={form.status} onChange={e => upd('status', e.target.value as OffMarketStatus)}>
                {STATUS_VOLGORDE.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <Label>Prioriteit</Label>
              <select className={selectCls} value={form.prioriteit} onChange={e => upd('prioriteit', e.target.value as OffMarketPrioriteit)}>
                {PRIORITEIT_VOLGORDE.map(p => <option key={p} value={p}>{PRIORITEIT_LABEL[p]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><Label>Adres</Label><Input value={form.adres} onChange={e => upd('adres', e.target.value)} /></div>
            <div><Label>Postcode</Label><Input value={form.postcode} onChange={e => upd('postcode', e.target.value)} /></div>
            <div><Label>Plaats</Label><Input value={form.plaats} onChange={e => upd('plaats', e.target.value)} /></div>
            <div>
              <Label>Provincie</Label>
              <select className={selectCls} value={form.provincie} onChange={e => upd('provincie', e.target.value)}>
                <option value="">—</option>
                {PROVINCIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div><Label>Regio</Label><Input value={form.regio} onChange={e => upd('regio', e.target.value)} placeholder="Randstad, Brabant…" /></div>
          </div>

          <div>
            <Label>Omschrijving</Label>
            <Textarea rows={3} value={form.omschrijving} onChange={e => upd('omschrijving', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label>Bron-URL</Label>
              <Input value={form.bron_url} onChange={e => upd('bron_url', e.target.value)} placeholder="https://…" />
              {err('bron_url')}
            </div>
            <div>
              <Label>Brondatum</Label>
              <Input type="date" value={form.bron_datum} onChange={e => upd('bron_datum', e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <Label>Bron-referentie</Label>
              <Input value={form.bron_referentie} onChange={e => upd('bron_referentie', e.target.value)} placeholder="Dossiernr., publicatie…" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Indicatieve waarde (€)</Label>
              <NumberField integer value={form.indicatieve_waarde ?? undefined} onChange={v => upd('indicatieve_waarde', v ?? null)} />
            </div>
            <div>
              <Label>Mogelijke fee (€)</Label>
              <NumberField integer value={form.mogelijke_fee ?? undefined} onChange={v => upd('mogelijke_fee', v ?? null)} />
            </div>
          </div>

          <div>
            <Label>Potentiële strategie</Label>
            <Input value={form.potentiele_strategie} onChange={e => upd('potentiele_strategie', e.target.value)} placeholder="Aankoop, bemiddeling, transformatie…" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Volgende actie (datum)</Label>
              <Input type="date" value={form.volgende_actie_datum} onChange={e => upd('volgende_actie_datum', e.target.value)} />
            </div>
            <div>
              <Label>Volgende actie</Label>
              <Input value={form.volgende_actie_omschrijving} onChange={e => upd('volgende_actie_omschrijving', e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Interne notities</Label>
            <Textarea rows={3} value={form.notities} onChange={e => upd('notities', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
            <Button type="submit" disabled={bezig}>{bezig ? 'Opslaan…' : isEdit ? 'Bijwerken' : 'Aanmaken'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
