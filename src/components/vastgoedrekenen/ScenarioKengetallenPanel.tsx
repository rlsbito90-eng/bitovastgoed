import { useMemo, useState } from 'react';
import { AlertTriangle, Camera, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useKengetallenregister, useScenarioKengetalSnapshots } from '@/hooks/useKengetallenregister';
import {
  KENGETAL_BETROUWBAARHEID_LABELS,
  KENGETAL_SCENARIOVELD_LABELS,
  buildScenarioPatchForKengetal,
  isKengetalExpired,
  isSnapshotOutdated,
  type KengetalBand,
  type VastgoedrekenenKengetal,
} from '@/lib/vastgoedrekenen/kengetallen';
import type { Scenario } from '@/lib/vastgoedrekenen/types';
import type { GuardedScenarioPatch } from '@/lib/vastgoedrekenen/saveGuards';
import { parseDutchNumber } from '@/lib/format/nl';

type Props = {
  scenario: Scenario;
  onUpdateScenario: (id: string, patch: GuardedScenarioPatch) => Promise<void>;
};

function valueText(value: number, unit: string): string {
  const formatted = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 }).format(value);
  return unit === '€' ? `€ ${formatted}` : `${formatted}${unit === '%' ? '%' : ` ${unit}`}`;
}

export default function ScenarioKengetallenPanel({ scenario, onUpdateScenario }: Props) {
  const { entries, loading: registerLoading } = useKengetallenregister();
  const { snapshots, loading: snapshotLoading, apply, remove } = useScenarioKengetalSnapshots(scenario.id);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<VastgoedrekenenKengetal | null>(null);
  const [manualRaw, setManualRaw] = useState('');
  const [manualReason, setManualReason] = useState('');

  const activeEntries = useMemo(() => entries.filter((entry) => entry.actief), [entries]);
  const snapshotByCode = useMemo(
    () => new Map(snapshots.map((snapshot) => [snapshot.kengetal_code, snapshot])),
    [snapshots],
  );
  const entryByCode = useMemo(
    () => new Map(entries.map((entry) => [entry.code, entry])),
    [entries],
  );

  async function applyBand(entry: VastgoedrekenenKengetal, band: KengetalBand, manualValue?: number, reason?: string) {
    setApplyingCode(entry.code);
    try {
      const snapshot = await apply({
        kengetal: entry,
        band,
        manualValue,
        overrideReason: reason,
      });
      if (!snapshot) return;

      const patch = buildScenarioPatchForKengetal(entry.scenario_veld, snapshot.gekozen_waarde);
      if (Object.keys(patch).length > 0) {
        await onUpdateScenario(scenario.id, patch as GuardedScenarioPatch);
      }
    } finally {
      setApplyingCode(null);
    }
  }

  async function submitManual() {
    if (!manualEntry) return;
    const value = parseDutchNumber(manualRaw);
    if (value == null) return;
    await applyBand(manualEntry, 'handmatig', value, manualReason);
    setManualEntry(null);
    setManualRaw('');
    setManualReason('');
  }

  return (
    <>
      <Card className="mb-4 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" /> Kengetallen en momentopnamen
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Toepassen legt bron, peildatum, bandbreedte en registerversie vast. Latere registerwijzigingen veranderen dit scenario niet automatisch.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {(registerLoading || snapshotLoading) && <p className="text-xs text-muted-foreground">Kengetallen laden…</p>}

          {!registerLoading && activeEntries.length === 0 && (
            <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Geen actieve kengetallen. Voeg eerst een kengetal toe in het centrale register.
            </p>
          )}

          {activeEntries.map((entry) => {
            const snapshot = snapshotByCode.get(entry.code);
            const expired = isKengetalExpired(entry);
            const applying = applyingCode === entry.code;
            return (
              <div key={entry.id} className="rounded-md border p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-sm">{entry.naam}</p>
                      <Badge variant={expired ? 'destructive' : 'outline'}>{expired ? 'Registerwaarde verlopen' : `v${entry.versie}`}</Badge>
                      <Badge variant="outline">{KENGETAL_BETROUWBAARHEID_LABELS[entry.betrouwbaarheid]}</Badge>
                    </div>
                    <p className="mt-1 font-mono-data text-xs">
                      Min {valueText(entry.minimum_waarde, entry.eenheid)} · Basis {valueText(entry.basis_waarde, entry.eenheid)} · Max {valueText(entry.maximum_waarde, entry.eenheid)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {entry.bron_naam} · peildatum {entry.bron_peildatum}
                      {entry.scenario_veld ? ` · vult ${KENGETAL_SCENARIOVELD_LABELS[entry.scenario_veld]}` : ' · alleen onderbouwing'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" disabled={applying || expired} onClick={() => void applyBand(entry, 'minimum')}>Minimum</Button>
                    <Button size="sm" disabled={applying || expired} onClick={() => void applyBand(entry, 'basis')}>Basis</Button>
                    <Button size="sm" variant="secondary" disabled={applying || expired} onClick={() => void applyBand(entry, 'maximum')}>Maximum</Button>
                    <Button size="sm" variant="ghost" disabled={applying} onClick={() => { setManualEntry(entry); setManualRaw(String(snapshot?.gekozen_waarde ?? entry.basis_waarde).replace('.', ',')); }}>Handmatig</Button>
                  </div>
                </div>

                {snapshot && (
                  <div className="mt-3 rounded-md border border-dashed bg-muted/30 p-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">Vastgelegd:</span>{' '}
                        <span className="font-mono-data">{valueText(snapshot.gekozen_waarde, snapshot.eenheid)}</span>{' '}
                        · {snapshot.gekozen_band} · register v{snapshot.register_versie} · snapshot {new Date(snapshot.snapshot_op).toLocaleString('nl-NL')}
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => void remove(snapshot.id)}>
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Verwijder snapshot
                      </Button>
                    </div>
                    {snapshot.overschreven && <p className="mt-1 text-amber-700 dark:text-amber-300">Handmatig overschreven: {snapshot.override_reden}</p>}
                    {isSnapshotOutdated(snapshot, entry) && (
                      <p className="mt-1 flex items-center gap-1 text-amber-700 dark:text-amber-300">
                        <RefreshCw className="h-3.5 w-3.5" /> Register is inmiddels v{entry.versie}; dit scenario blijft bewust op v{snapshot.register_versie} tot je opnieuw toepast.
                      </p>
                    )}
                    {isKengetalExpired(snapshot) && (
                      <p className="mt-1 flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" /> De bron van deze snapshot is verlopen. Herbeoordeel vóór gebruik als biedingsgrens.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {snapshots.filter((snapshot) => !entryByCode.has(snapshot.kengetal_code)).map((snapshot) => (
            <div key={snapshot.id} className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Gearchiveerde/verwijderde registerbron: <span className="font-medium text-foreground">{snapshot.kengetal_naam}</span> · momentopname {valueText(snapshot.gekozen_waarde, snapshot.eenheid)} blijft behouden.
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={manualEntry !== null} onOpenChange={(open) => !open && setManualEntry(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Handmatige kengetalwaarde</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Waarde {manualEntry ? `(${manualEntry.eenheid})` : ''}</Label>
              <Input inputMode="decimal" value={manualRaw} onChange={(event) => setManualRaw(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Reden van afwijking</Label>
              <Textarea rows={4} value={manualReason} onChange={(event) => setManualReason(event.target.value)} placeholder="Projectspecifieke onderbouwing, bron en reden van afwijking…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualEntry(null)}>Annuleren</Button>
            <Button disabled={!manualReason.trim() || parseDutchNumber(manualRaw) == null} onClick={() => void submitManual()}>Vastleggen en toepassen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
