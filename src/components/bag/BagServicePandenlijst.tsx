import { useMemo, useState } from 'react';
import { Database, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  filterEnSorteerBagPanden,
  normaliseerBagServicePand,
  type BagServicePandRij,
  type BagVerkennerFilters,
  type BagVerkennerPand,
} from '@/lib/bag/pandenverkennerModel';
import { zoekPandenViaService } from '@/lib/bag/queryTransport';

const PAGE_SIZE = 100;
const FUNCTIES = ['woonfunctie', 'kantoorfunctie', 'industriefunctie', 'winkelfunctie'];

export default function BagServicePandenlijst({ scopeCode }: { scopeCode: string }) {
  const [panden, setPanden] = useState<BagVerkennerPand[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [heeftVolgende, setHeeftVolgende] = useState(true);
  const [laden, setLaden] = useState(false);
  const [filters, setFilters] = useState<BagVerkennerFilters>({
    zoekterm: '', gebruiksdoelen: [], alleenGemengd: false, sortering: 'identificatie',
  });
  const zichtbaar = useMemo(() => filterEnSorteerBagPanden(panden, filters), [panden, filters]);

  const laad = async (opnieuw = false) => {
    setLaden(true);
    try {
      const resultaat = await zoekPandenViaService<BagServicePandRij>({
        scopeCode, naIdentificatie: opnieuw ? null : cursor, limiet: PAGE_SIZE,
      });
      const nieuw = resultaat.rows.map(normaliseerBagServicePand);
      setPanden(previous => opnieuw ? nieuw : [...previous, ...nieuw]);
      setCursor(nieuw.at(-1)?.cursor ?? null);
      setHeeftVolgende(nieuw.length === PAGE_SIZE);
      if (!nieuw.length) toast.info('Geen verdere BAG-panden gevonden.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'BAG-lijst laden mislukt.');
    } finally {
      setLaden(false);
    }
  };

  const toggleFunctie = (functie: string) => setFilters(previous => ({
    ...previous,
    gebruiksdoelen: previous.gebruiksdoelen.includes(functie)
      ? previous.gebruiksdoelen.filter(value => value !== functie)
      : [...previous.gebruiksdoelen, functie],
  }));

  return <section className="section-card overflow-hidden">
    <div className="border-b p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><Database className="h-4 w-4"/><h2 className="text-sm font-medium">Private BAG-dataset</h2><Badge variant="outline">Lijst</Badge></div>
          <p className="mt-1 text-xs text-muted-foreground">Geauthenticeerde, begrensde serverquery voor scope {scopeCode}. Geen kaart en geen automatische opslag.</p>
        </div>
        <Button onClick={() => laad(true)} disabled={laden}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Search className="mr-2 h-4 w-4"/>}Eerste 100 laden</Button>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_190px_auto]">
        <Input value={filters.zoekterm} onChange={event => setFilters(previous => ({ ...previous, zoekterm: event.target.value }))} placeholder="Filter geladen pagina’s op adres, plaats, postcode, BAG-ID of functie" />
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.sortering} onChange={event => setFilters(previous => ({ ...previous, sortering: event.target.value as BagVerkennerFilters['sortering'] }))}>
          <option value="identificatie">BAG-identificatie</option><option value="adres">Adres</option><option value="bouwjaar">Oudste bouwjaar</option><option value="oppervlakte">Grootste oppervlakte</option>
        </select>
        <label className="flex items-center gap-2 rounded-md border px-3 text-xs"><Checkbox checked={filters.alleenGemengd} onCheckedChange={value => setFilters(previous => ({ ...previous, alleenGemengd: Boolean(value) }))}/>Alleen gemengd</label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{FUNCTIES.map(functie => <label key={functie} className="flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><Checkbox checked={filters.gebruiksdoelen.includes(functie)} onCheckedChange={() => toggleFunctie(functie)}/>{functie}</label>)}</div>
    </div>

    {!panden.length ? <div className="p-10 text-center text-sm text-muted-foreground">Laad de eerste begrensde pagina uit de actieve BAG-dataset.</div> : <div className="divide-y">{zichtbaar.map(pand => <div key={`${pand.datasetversieId}:${pand.bagPandId}:${pand.voorkomenSleutel}`} className="p-4">
      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{pand.adres}</p>{pand.gemengdGebruik&&<Badge>Gemengd</Badge>}{pand.status&&<Badge variant="outline">{pand.status}</Badge>}</div>
      <p className="mt-1 text-xs text-muted-foreground">{[pand.postcode,pand.plaats,pand.bouwjaar?`Bouwjaar ${pand.bouwjaar}`:null,pand.oppervlakte?`${Math.round(pand.oppervlakte)} m²`:null].filter(Boolean).join(' · ')}</p>
      <div className="mt-2 flex flex-wrap gap-1">{pand.gebruiksdoelen.map(doel => <Badge key={doel} variant="secondary" className="text-[10px]">{doel}</Badge>)}</div>
      <p className="mt-2 font-mono-data text-[11px] text-muted-foreground">BAG-pand {pand.bagPandId}</p>
    </div>)}</div>}
    {panden.length>0 && <div className="flex items-center justify-between gap-3 border-t p-4 text-xs text-muted-foreground"><span>{zichtbaar.length} zichtbaar van {panden.length} geladen</span><Button variant="outline" size="sm" disabled={laden || !heeftVolgende} onClick={() => laad(false)}>{laden?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:null}{heeftVolgende?'Volgende 100 laden':'Einde bereikt'}</Button></div>}
  </section>;
}
