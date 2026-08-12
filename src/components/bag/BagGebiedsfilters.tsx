import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { BagCbsGebiedsoptie } from '@/lib/bag/queryService';

interface Props {
  opties: BagCbsGebiedsoptie[];
  wijkCodes: string[];
  buurtCodes: string[];
  onWijkCodesChange: (codes: string[]) => void;
  onBuurtCodesChange: (codes: string[]) => void;
  laden?: boolean;
}

function norm(value: string): string {
  return value.trim().toLocaleLowerCase('nl-NL');
}

function toggle(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value];
}

export default function BagGebiedsfilters({
  opties, wijkCodes, buurtCodes, onWijkCodesChange, onBuurtCodesChange, laden = false,
}: Props) {
  const [wijkZoekterm, setWijkZoekterm] = useState('');
  const [buurtZoekterm, setBuurtZoekterm] = useState('');

  const wijken = useMemo(() => {
    const perCode = new Map<string, { code: string; naam: string }>();
    opties.forEach(optie => perCode.set(optie.wijk_code, { code: optie.wijk_code, naam: optie.wijk_naam }));
    return [...perCode.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl'));
  }, [opties]);

  const buurten = useMemo(() => opties
    .filter(optie => !wijkCodes.length || wijkCodes.includes(optie.wijk_code))
    .sort((a, b) => a.buurt_naam.localeCompare(b.buurt_naam, 'nl')),
  [opties, wijkCodes]);

  const zichtbareWijken = useMemo(() => {
    const zoek = norm(wijkZoekterm);
    if (!zoek) return wijken;
    return wijken.filter(wijk => norm(`${wijk.naam} ${wijk.code}`).includes(zoek));
  }, [wijken, wijkZoekterm]);

  const zichtbareBuurten = useMemo(() => {
    const zoek = norm(buurtZoekterm);
    if (!zoek) return buurten;
    return buurten.filter(buurt => norm(`${buurt.buurt_naam} ${buurt.buurt_code}`).includes(zoek));
  }, [buurten, buurtZoekterm]);

  const wijzigWijken = (code: string) => {
    const next = toggle(wijkCodes, code);
    onWijkCodesChange(next);
    if (next.length) {
      const geldigeBuurtCodes = new Set(opties.filter(optie => next.includes(optie.wijk_code)).map(optie => optie.buurt_code));
      onBuurtCodesChange(buurtCodes.filter(buurtCode => geldigeBuurtCodes.has(buurtCode)));
    }
  };

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <details className="rounded-md border bg-background">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium">
          <span className="flex items-center justify-between gap-2">
            <span>Wijk</span>
            <span className="flex items-center gap-2">
              {wijkCodes.length > 0 && <Badge variant="secondary">{wijkCodes.length}</Badge>}
              <span className="text-muted-foreground">{laden ? 'Laden…' : `${wijken.length} opties`}</span>
            </span>
          </span>
        </summary>
        <div className="border-t p-3">
          <Input value={wijkZoekterm} onChange={event => setWijkZoekterm(event.target.value)} placeholder="Zoek wijk…" className="mb-2 h-9" />
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {zichtbareWijken.map(wijk => (
              <label key={wijk.code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50">
                <Checkbox checked={wijkCodes.includes(wijk.code)} onCheckedChange={() => wijzigWijken(wijk.code)} />
                <span className="min-w-0 flex-1 truncate">{wijk.naam}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{wijk.code}</span>
              </label>
            ))}
            {!zichtbareWijken.length && <p className="px-2 py-2 text-xs text-muted-foreground">Geen wijken gevonden.</p>}
          </div>
        </div>
      </details>

      <details className="rounded-md border bg-background">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium">
          <span className="flex items-center justify-between gap-2">
            <span>Buurt</span>
            <span className="flex items-center gap-2">
              {buurtCodes.length > 0 && <Badge variant="secondary">{buurtCodes.length}</Badge>}
              <span className="text-muted-foreground">{laden ? 'Laden…' : `${buurten.length} opties`}</span>
            </span>
          </span>
        </summary>
        <div className="border-t p-3">
          <Input value={buurtZoekterm} onChange={event => setBuurtZoekterm(event.target.value)} placeholder="Zoek buurt…" className="mb-2 h-9" />
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {zichtbareBuurten.map(buurt => (
              <label key={buurt.buurt_code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-muted/50">
                <Checkbox checked={buurtCodes.includes(buurt.buurt_code)} onCheckedChange={() => onBuurtCodesChange(toggle(buurtCodes, buurt.buurt_code))} />
                <span className="min-w-0 flex-1 truncate">{buurt.buurt_naam}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{buurt.buurt_code}</span>
              </label>
            ))}
            {!zichtbareBuurten.length && <p className="px-2 py-2 text-xs text-muted-foreground">Geen buurten gevonden.</p>}
          </div>
          {wijkCodes.length > 0 && <p className="mt-2 text-[11px] text-muted-foreground">Alleen buurten binnen de geselecteerde wijk(en) worden getoond.</p>}
        </div>
      </details>
    </div>
  );
}
