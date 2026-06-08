// Eén Kadaster-resultaatkaart met confidence-badge en overname-knop.
import { Button } from '@/components/ui/button';
import type { KadasterResultaat } from '@/lib/offMarket/kadaster/types';

interface Props {
  resultaat: KadasterResultaat;
  onOvernemen: () => void;
  onNietGebruiken?: () => void;
  disabled?: boolean;
  /** Bij true (lage confidence of complex adres) wordt overname-knop secondair. */
  vereistBevestiging?: boolean;
}

function confidenceTone(c: number): { label: string; cls: string } {
  if (c >= 0.8) return { label: 'Hoge match', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' };
  if (c >= 0.55) return { label: 'Gemiddelde match', cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' };
  return { label: 'Lage match', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
}

export default function KadasterResultaatKaart({ resultaat, onOvernemen, onNietGebruiken, disabled, vereistBevestiging }: Props) {
  const tone = confidenceTone(resultaat.confidence);
  return (
    <div className="rounded-md border border-border bg-card p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{resultaat.eigenaar_naam}</p>
          {resultaat.eigenaar_bedrijfsnaam && resultaat.eigenaar_bedrijfsnaam !== resultaat.eigenaar_naam && (
            <p className="text-xs text-muted-foreground">{resultaat.eigenaar_bedrijfsnaam}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{resultaat.adres}</p>
          <p className="text-[11px] font-mono-data text-muted-foreground mt-0.5">{resultaat.kadastrale_aanduiding}</p>
        </div>
        <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border ${tone.cls}`}>
          {tone.label} · {Math.round(resultaat.confidence * 100)}%
        </span>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        {onNietGebruiken && (
          <Button variant="ghost" size="sm" onClick={onNietGebruiken} disabled={disabled}>
            Niet gebruiken
          </Button>
        )}
        <Button
          size="sm"
          variant={vereistBevestiging ? 'outline' : 'default'}
          onClick={onOvernemen}
          disabled={disabled}
        >
          {vereistBevestiging ? 'Toch overnemen…' : 'Overnemen in eigenaarsonderzoek'}
        </Button>
      </div>
    </div>
  );
}
