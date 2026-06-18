// Dialog voor het veilig opschonen van testconcepten.
// Toont preview + telkens expliciete bevestiging. Verstuurde brieven
// worden nooit geraakt.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { CAMPAGNE_STAP_LABEL } from '@/lib/offMarket/brieven/groepering';
import { useArchiveerBrief } from '@/hooks/useOffMarketBrieven';
import type { OpschoonKandidaat } from '@/lib/offMarket/brieven/opschoon';

function formatDateNL(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return d; }
}

const REDENEN = [
  'testconcept opgeschoond',
  'dubbel concept',
  'verkeerd adres',
  'overig',
] as const;

export default function OpschoonConceptenDialog({
  open, onOpenChange, kandidaten,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kandidaten: OpschoonKandidaat[];
}) {
  const archiveer = useArchiveerBrief();
  const [bevestigd, setBevestigd] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [reden, setReden] = useState<typeof REDENEN[number]>('testconcept opgeschoond');
  const aantal = useMemo(() => kandidaten.length, [kandidaten]);

  const uitvoeren = async () => {
    setBezig(true);
    let ok = 0, fout = 0;
    for (const k of kandidaten) {
      try {
        await archiveer.mutateAsync({ id: k.brief.id, reden });
        ok += 1;
      } catch (e) {
        console.warn('Archiveren mislukt', e);
        fout += 1;
      }
    }
    setBezig(false);
    if (ok > 0) toast.success(`${ok} concept${ok === 1 ? '' : 'en'} gearchiveerd`);
    if (fout > 0) toast.error(`${fout} concept${fout === 1 ? '' : 'en'} kon niet worden gearchiveerd`);
    onOpenChange(false);
    setBevestigd(false);
  };


  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setBevestigd(false); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Concepten opschonen
          </DialogTitle>
          <DialogDescription>
            Alleen oudere conceptversies worden gearchiveerd. Verstuurde brieven en
            de meest recente actieve conceptversie per stap blijven altijd staan.
          </DialogDescription>
        </DialogHeader>

        {aantal === 0 ? (
          <p className="text-sm text-muted-foreground">
            Geen veilige opschoonkandidaten gevonden.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              {aantal} concept{aantal === 1 ? '' : 'en'} worden gearchiveerd:
            </p>
            <ul
              data-testid="opschoon-preview"
              className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border/60"
            >
              {kandidaten.map((k) => (
                <li key={k.brief.id} className="px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{k.geadresseerdeNaam}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {CAMPAGNE_STAP_LABEL[k.campagneStap]} · aangemaakt {formatDateNL(k.brief.created_at)}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground italic max-w-[60%] text-right">
                      {k.reden}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="opschoon-reden">Reden</Label>
              <Select value={reden} onValueChange={(v) => setReden(v as typeof REDENEN[number])}>
                <SelectTrigger id="opschoon-reden" data-testid="opschoon-reden-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REDENEN.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={bevestigd}
                onChange={(e) => setBevestigd(e.target.checked)}
                className="mt-0.5"
                data-testid="opschoon-bevestig"
              />
              Ik bevestig dat deze conceptversies veilig kunnen worden gearchiveerd.
            </label>
          </div>
        )}


        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>
            Annuleren
          </Button>
          <Button
            data-testid="opschoon-uitvoeren"
            onClick={uitvoeren}
            disabled={aantal === 0 || !bevestigd || bezig}
          >
            <Trash2 className="h-4 w-4" /> Archiveer concepten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
