import { useMemo, useState } from 'react';
import { GEMEENTEN_2026_PER_PROVINCIE, normaliseerGemeenteNaam } from '@/lib/geo/gemeenten2026';
import { Input } from '@/components/ui/input';

interface Props {
  /** Backwards-compatible: a province is never required before selecting a municipality. */
  provincies?: readonly string[];
  gekozen: readonly string[];
  onChange: (gemeenten: string[]) => void;
}

const GEMEENTE_OPTIES = Object.entries(GEMEENTEN_2026_PER_PROVINCIE)
  .flatMap(([provincie, gemeenten]) => gemeenten.map(naam => ({ naam, provincie })))
  .sort((a, b) => a.naam.localeCompare(b.naam, 'nl-NL'));

const sleutel = (waarde: string) => normaliseerGemeenteNaam(waarde);

/** Zoekt in alle officiële gemeenten, volledig los van provincieselecties.
 * Een gekozen gemeente beperkt de zoekmatch; de provincie wordt niet
 * automatisch toegevoegd of ingevuld.
 */
export default function GemeentePicker({ gekozen, onChange }: Props) {
  const [zoek, setZoek] = useState('');
  const q = sleutel(zoek);
  const opties = useMemo(() =>
    q.length < 2 ? [] : GEMEENTE_OPTIES.filter(x => sleutel(x.naam).includes(q)).slice(0, 30),
    [q],
  );
  const isGekozen = (naam: string) => gekozen.some(x => sleutel(x) === sleutel(naam));
  const toggle = (naam: string) => {
    if (isGekozen(naam)) onChange(gekozen.filter(x => sleutel(x) !== sleutel(naam)));
    else {
      onChange([...gekozen, naam]);
      setZoek('');
    }
  };

  return <div className="space-y-2" aria-label="Gemeenten selecteren">
    <p className="text-xs text-muted-foreground">
      Zoek direct een gemeente in heel Nederland; een provincie kiezen is niet nodig.
      Gemeenten en woonplaatsen zijn afzonderlijke zoekcriteria.
    </p>
    {gekozen.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Geselecteerde gemeenten">
      {gekozen.map((g, i) => <button key={g+i} type="button" onClick={() => toggle(g)}
        className="rounded border px-2 py-1 text-xs hover:bg-muted" title={'Verwijder '+g}
        aria-label={'Verwijder gemeente '+g}>{g} ×</button>)}
    </div>}
    <Input value={zoek} onChange={e=>setZoek(e.target.value)}
      placeholder="Zoek bijv. Apeldoorn of Deventer" aria-label="Gemeente zoeken"/>
    {q.length > 0 && q.length < 2 && <p className="text-xs text-muted-foreground">
      Typ minimaal twee letters om gemeenten te vinden.
    </p>}
    {q.length >= 2 && <div className="max-h-44 overflow-y-auto border rounded-md p-2 space-y-1"
      role="group" aria-label="Gemeentezoekresultaten">
      {opties.map(g => <label key={g.provincie+':'+g.naam}
        className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer">
        <input type="checkbox" checked={isGekozen(g.naam)} onChange={() => toggle(g.naam)}/>
        <span>{g.naam}</span>
        <span className="ml-auto text-xs text-muted-foreground" aria-hidden="true">{g.provincie}</span>
      </label>)}
      {opties.length === 30 && <p className="text-xs text-muted-foreground px-2">
        Typ meer letters om gerichter te zoeken.
      </p>}
      {!opties.length && <p className="text-xs text-muted-foreground px-2">
        Geen officiële gemeente gevonden.
      </p>}
    </div>}
  </div>;
}
