// Beperkte analyse-instellingen: propositietype wijzigen (metadata-only).
// Er worden geen invoervelden, aannames of uitkomsten gewijzigd of verwijderd.

import { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROPOSITION_DEFINITIONS, getPropositionLabel, type PropositionType } from '@/lib/vastgoedrekenen/propositions';
import { resolveAnalysisPropositionMetadata } from '@/lib/vastgoedrekenen/analysis';
import type { PersistedCalculationAnalysis } from '@/lib/vastgoedrekenen/types';

type Props = {
  analysis: PersistedCalculationAnalysis;
  onChangeType: (type: PropositionType) => Promise<unknown>;
};

export default function AnalysisPropositionSettings({ analysis, onChangeType }: Props) {
  const meta = resolveAnalysisPropositionMetadata(analysis as unknown as Record<string, unknown>);
  const [pending, setPending] = useState<PropositionType | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setPending(null); }, [analysis.id]);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await onChangeType(pending);
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-w-0 w-full space-y-1.5">
      <Label className="block text-xs font-medium leading-snug">Propositietype</Label>
      <Select
        value={meta.propositionType}
        onValueChange={(v) => { if (v !== meta.propositionType) setPending(v as PropositionType); }}
      >
        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {PROPOSITION_DEFINITIONS.map((definition) => (
            <SelectItem key={definition.type} value={definition.type}>{definition.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <AlertDialog open={pending !== null} onOpenChange={(open) => { if (!open) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Propositietype wijzigen?</AlertDialogTitle>
            <AlertDialogDescription>
              Het propositietype wijzigt van “{meta.propositionLabel}” naar “{pending ? getPropositionLabel(pending) : ''}”.
              Dit wijzigt uitsluitend de classificatie van deze analyse. Ingevoerde gegevens, aannames, scenario's en
              uitkomsten worden niet gewijzigd, herberekend of verwijderd.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); confirm(); }} disabled={busy}>
              {busy ? 'Wijzigen…' : 'Type wijzigen'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
