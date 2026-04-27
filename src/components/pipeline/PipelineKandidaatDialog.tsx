import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useDataStore } from '@/hooks/useDataStore';
import {
  PIPELINE_FASES, INTERESSE_LABELS, VOLGENDE_ACTIE_LABELS,
  type PipelineKandidaat, type PipelineFase, type InteresseNiveau, type VolgendeActieType,
} from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kandidaat: PipelineKandidaat;
}

export default function PipelineKandidaatDialog({ open, onOpenChange, kandidaat }: Props) {
  const { updatePipelineKandidaat, getRelatieById } = useDataStore();
  const [form, setForm] = useState<PipelineKandidaat>(kandidaat);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(kandidaat); }, [open, kandidaat]);

  const relatie = getRelatieById(kandidaat.relatieId);
  const set = <K extends keyof PipelineKandidaat>(k: K, v: PipelineKandidaat[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePipelineKandidaat(kandidaat.id, form);
      toast.success('Pipeline bijgewerkt');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pipeline — {relatie?.bedrijfsnaam ?? 'Kandidaat'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="status" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="documenten">Documenten</TabsTrigger>
            <TabsTrigger value="bieding">Bieding</TabsTrigger>
            <TabsTrigger value="opvolging">Opvolging</TabsTrigger>
          </TabsList>

          <TabsContent value="status" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Pipeline-fase</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.pipelineFase}
                  onChange={e => set('pipelineFase', e.target.value as PipelineFase)}
                >
                  {PIPELINE_FASES.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Interesse-niveau</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.interesseNiveau}
                  onChange={e => set('interesseNiveau', e.target.value as InteresseNiveau)}
                >
                  {(Object.keys(INTERESSE_LABELS) as InteresseNiveau[]).map(n => (
                    <option key={n} value={n}>{INTERESSE_LABELS[n]}</option>
                  ))}
                </select>
              </div>
            </div>
            {form.pipelineFase === 'afgevallen' && (
              <div>
                <Label>Reden afgevallen</Label>
                <Textarea
                  rows={2}
                  value={form.redenAfgevallen ?? ''}
                  onChange={e => set('redenAfgevallen', e.target.value)}
                />
              </div>
            )}
            <div>
              <Label>Notities</Label>
              <Textarea
                rows={3}
                value={form.notities ?? ''}
                onChange={e => set('notities', e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="documenten" className="space-y-4 pt-4">
            {([
              ['teaserVerstuurd', 'teaserVerstuurdOp', 'Teaser verstuurd'],
              ['ndaVerstuurd', 'ndaVerstuurdOp', 'NDA verstuurd'],
              ['ndaGetekend', 'ndaGetekendOp', 'NDA getekend'],
              ['informatieGedeeld', 'informatieGedeeldOp', 'Informatie gedeeld'],
            ] as const).map(([flagKey, dateKey, label]) => (
              <div key={flagKey} className="grid grid-cols-[auto_1fr_180px] items-center gap-3">
                <Checkbox
                  checked={!!form[flagKey]}
                  onCheckedChange={v => set(flagKey, !!v as any)}
                />
                <Label className="cursor-default">{label}</Label>
                <Input
                  type="date"
                  disabled={!form[flagKey]}
                  value={(form[dateKey] as string) ?? ''}
                  onChange={e => set(dateKey, e.target.value as any)}
                />
              </div>
            ))}
          </TabsContent>

          <TabsContent value="bieding" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bezichtiging-datum</Label>
                <Input
                  type="date"
                  value={form.bezichtigingDatum ?? ''}
                  onChange={e => set('bezichtigingDatum', e.target.value)}
                />
              </div>
              <div>
                <Label>Bieding (€)</Label>
                <Input
                  type="number"
                  value={form.biedingBedrag ?? ''}
                  onChange={e => set('biedingBedrag', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>
            <div>
              <Label>Bieding voorwaarden</Label>
              <Textarea
                rows={2}
                value={form.biedingVoorwaarden ?? ''}
                onChange={e => set('biedingVoorwaarden', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  checked={!!form.financieringsvoorbehoud}
                  onCheckedChange={v => set('financieringsvoorbehoud', !!v)}
                />
                <Label className="cursor-default">Financieringsvoorbehoud</Label>
              </div>
              <div>
                <Label>Gewenste levering</Label>
                <Input
                  type="date"
                  value={form.gewensteLevering ?? ''}
                  onChange={e => set('gewensteLevering', e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={!!form.feeAkkoord}
                onCheckedChange={v => set('feeAkkoord', !!v)}
              />
              <Label className="cursor-default">Fee akkoord</Label>
            </div>
          </TabsContent>

          <TabsContent value="opvolging" className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Laatste contact</Label>
                <Input
                  type="date"
                  value={form.laatsteContactdatum ?? ''}
                  onChange={e => set('laatsteContactdatum', e.target.value)}
                />
              </div>
              <div>
                <Label>Volgende actie type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.volgendeActie ?? ''}
                  onChange={e => set('volgendeActie', (e.target.value || undefined) as VolgendeActieType | undefined)}
                >
                  <option value="">— Geen —</option>
                  {(Object.keys(VOLGENDE_ACTIE_LABELS) as VolgendeActieType[]).map(t => (
                    <option key={t} value={t}>{VOLGENDE_ACTIE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>Volgende actie omschrijving</Label>
              <Input
                value={form.volgendeActieOmschrijving ?? ''}
                onChange={e => set('volgendeActieOmschrijving', e.target.value)}
              />
            </div>
            <div>
              <Label>Volgende actie datum</Label>
              <Input
                type="date"
                value={form.volgendeActieDatum ?? ''}
                onChange={e => set('volgendeActieDatum', e.target.value)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Bezig…' : 'Opslaan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
