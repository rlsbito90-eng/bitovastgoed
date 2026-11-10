import { useEffect, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { zoekPdokWoonplaatsen, type BagAdresResultaat } from '@/lib/bag/pdokLookup';

interface Props {
  gekozen: readonly string[];
  onChange: (plaatsen: string[]) => void;
  id?: string;
  label?: string;
}

/** Officiële woonplaatsen uit PDOK selecteren; opslag blijft de bestaande string[]. */
export default function PlaatsenPicker({
  gekozen, onChange, id, label = 'Plaats of stad zoeken',
}: Props) {
  const [zoek, setZoek] = useState('');
  const [resultaten, setResultaten] = useState<BagAdresResultaat[]>([]);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [gezocht, setGezocht] = useState(false);

  useEffect(() => {
    const q = zoek.trim();
    if (q.length < 2) {
      setResultaten([]);
      setBezig(false);
      setFout(null);
      setGezocht(false);
      return;
    }
    const controller = new AbortController();
    setBezig(true);
    setFout(null);
    setGezocht(false);
    setResultaten([]);
    // Alleen de bewust getypte woonplaatszoekterm gaat naar de publieke PDOK-server.
    const timer = window.setTimeout(() => {
      void zoekPdokWoonplaatsen(q, { rows: 15, signal: controller.signal })
        .then(items => {
          if (controller.signal.aborted) return;
          const gezien = new Set<string>();
          setResultaten(items.filter(item => {
            const naam = (item.woonplaats ?? item.weergavenaam).trim();
            const sleutel = naam.toLocaleLowerCase('nl-NL');
            if (!naam || gezien.has(sleutel)) return false;
            gezien.add(sleutel);
            return true;
          }));
          setGezocht(true);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setFout('Woonplaatsen konden niet worden opgehaald. Probeer opnieuw.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setBezig(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [zoek]);

  const isGekozen = (naam: string) =>
    gekozen.some(x => x.toLocaleLowerCase('nl-NL') === naam.toLocaleLowerCase('nl-NL'));
  const toggle = (naam: string) => {
    if (isGekozen(naam)) onChange(gekozen.filter(x => x.toLocaleLowerCase('nl-NL') !== naam.toLocaleLowerCase('nl-NL')));
    else onChange([...gekozen, naam]);
  };

  return (
    <div className="space-y-2 min-w-0" aria-label="Plaatsen selecteren">
      {gekozen.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Geselecteerde plaatsen">
          {gekozen.map((naam, index) => (
            <button
              type="button" key={naam + index} onClick={() => toggle(naam)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              title={'Verwijder ' + naam}
              aria-label={'Verwijder plaats ' + naam}
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="break-words">{naam}</span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          ))}
        </div>
      )}
      <Input
        id={id} aria-label={label} autoComplete="off"
        value={zoek} onChange={e => setZoek(e.target.value)}
        placeholder="Zoek bijv. Apeldoorn of Deventer"
      />
      {bezig && <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Woonplaatsen zoeken…
      </p>}
      {fout && <p className="text-xs text-destructive" role="alert">{fout}</p>}
      {!fout && resultaten.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border p-2 space-y-1"
             role="group" aria-label="PDOK woonplaatsresultaten">
          {resultaten.map(item => {
            const naam = (item.woonplaats ?? item.weergavenaam).trim();
            return (
              <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                <input type="checkbox" checked={isGekozen(naam)} onChange={() => toggle(naam)} />
                <span>{naam}</span>
              </label>
            );
          })}
          {resultaten.length === 15 && (
            <p className="text-xs text-muted-foreground">Typ meer letters om de juiste woonplaats te vinden.</p>
          )}
        </div>
      )}
      {gezocht && !bezig && resultaten.length === 0 && (
        <p className="text-xs text-muted-foreground">Geen officiële woonplaats gevonden. Controleer de spelling.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Selecteer een of meer woonplaatsen. Vanaf twee letters zoekt de CRM in de publieke PDOK Locatieserver.
        Bestaande keuzes blijven bewaard totdat je ze verwijdert.
      </p>
    </div>
  );
}
