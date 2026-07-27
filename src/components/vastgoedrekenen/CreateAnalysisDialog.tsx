import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { PROPOSITION_DEFINITIONS, type PropositionType } from '@/lib/vastgoedrekenen/propositions';
import { createAnalysisWithInitialScenario } from '@/lib/vastgoedrekenen/analysis/persistence';
import type { PersistedCalculationAnalysis } from '@/lib/vastgoedrekenen/analysis/persistedTypes';

interface Props {
  objectId: string;
  onCreated: (analysis: PersistedCalculationAnalysis) => void | Promise<void>;
  triggerLabel?: string;
}

export default function CreateAnalysisDialog({ objectId, onCreated, triggerLabel = 'Nieuwe analyse' }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Nieuwe analyse');
  const [propositionType, setPropositionType] = useState<PropositionType>('legacy_generic');
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const analysis = await createAnalysisWithInitialScenario({ objectId, name, propositionType });
      await onCreated(analysis);
      toast.success('Analyse en eerste scenario aangemaakt');
      setOpen(false);
      setName('Nieuwe analyse');
      setPropositionType('legacy_generic');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Analyse aanmaken mislukt');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> {triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe financiële analyse</DialogTitle>
          <DialogDescription>De propositiekeuze is in deze fase uitsluitend classificatie en verandert geen berekeningen of invoer.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="analysis-name">Naam analyse</Label>
            <Input id="analysis-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Propositietype</Label>
            <Select value={propositionType} onValueChange={(value) => setPropositionType(value as PropositionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPOSITION_DEFINITIONS.map((definition) => (
                  <SelectItem key={definition.type} value={definition.type}>{definition.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuleren</Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>{saving ? 'Aanmaken…' : 'Analyse aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
