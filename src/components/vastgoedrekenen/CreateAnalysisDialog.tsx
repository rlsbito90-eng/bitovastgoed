// Kleine herbruikbare dialoog om een nieuwe analyse aan te maken.
// Legt uitsluitend naam + rekenpropositie vast; er worden geen scenario-classificaties,
// aannames of financiële formules geselecteerd.

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROPOSITION_DEFINITIONS, type PropositionType } from '@/lib/vastgoedrekenen/propositions';
import { DEFAULT_PROPOSITION_TYPE } from '@/lib/vastgoedrekenen/analysis';

export const DEFAULT_ANALYSIS_NAME = 'Nieuwe analyse';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onCreate: (input: { calculation_name: string; propositionType: PropositionType }) => Promise<unknown>;
};

export default function CreateAnalysisDialog({ open, onOpenChange, defaultName, onCreate }: Props) {
  const [naam, setNaam] = useState(defaultName ?? DEFAULT_ANALYSIS_NAME);
  const [type, setType] = useState<PropositionType>(DEFAULT_PROPOSITION_TYPE);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNaam(defaultName ?? DEFAULT_ANALYSIS_NAME);
      setType(DEFAULT_PROPOSITION_TYPE);
      setBusy(false);
    }
  }, [open, defaultName]);

  async function submit() {
    setBusy(true);
    try {
      await onCreate({ calculation_name: naam.trim() || DEFAULT_ANALYSIS_NAME, propositionType: type });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nieuwe analyse</DialogTitle>
          <DialogDescription>
            Er wordt direct één generiek scenario aangemaakt. De rekenpropositie bepaalt alleen welke gespecialiseerde modules beschikbaar zijn; de businesscase en exit kies je daarna per scenario.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="analyse-naam">Naam analyse</Label>
            <Input
              id="analyse-naam"
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder={DEFAULT_ANALYSIS_NAME}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analyse-propositietype">Rekenpropositie (modules)</Label>
            <Select value={type} onValueChange={(v) => setType(v as PropositionType)}>
              <SelectTrigger id="analyse-propositietype" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROPOSITION_DEFINITIONS.map((definition) => (
                  <SelectItem key={definition.type} value={definition.type}>{definition.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Dit is niet de strategie of businesscase van het scenario.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuleren</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Aanmaken…' : 'Analyse aanmaken'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
