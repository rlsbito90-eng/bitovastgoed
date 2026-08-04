import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Lightbulb, Radar, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalenAlle } from '@/hooks/useOffMarketSignalen';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import {
  controleerObjectCrmBreed,
  type ObjectControleBronrecord,
  type ObjectControleResultaat,
} from '@/lib/objectcontrole/objectControle';

export default function SnellePandcheckPage() {
  const { kansen } = useVastgoedkansen();
  const { objecten } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalenAlle();
  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [plaats, setPlaats] = useState('');
  const [bagPandId, setBagPandId] = useState('');
  const [bagVerblijfsobjectId, setBagVerblijfsobjectId] = useState('');
  const [resultaat, setResultaat] = useState<ObjectControleResultaat | null>(null);

  const records = useMemo<ObjectControleBronrecord[]>(() => [
    ...kansen.map(kans => ({
      bronType: 'vastgoedkans' as const,
      id: kans.id,
      adres: kans.adres,
      postcode: kans.postcode,
      plaats: kans.plaats,
      bagPandId: kans.bagPandId,
      bagVerblijfsobjectId: kans.bagVerblijfsobjectId,
      status: kans.status,
      titel: kans.korteOmschrijving ?? kans.adres,
    })),
    ...objecten.map(object => ({
      bronType: 'object' as const,
      id: object.id,
      adres: object.adres,
      postcode: object.postcode,
      plaats: object.plaats,
      bagPandId: 'bagPandId' in object ? String(object.bagPandId ?? '') : null,
      bagVerblijfsobjectId: 'bagVerblijfsobjectId' in object ? String(object.bagVerblijfsobjectId ?? '') : null,
      status: 'status' in object ? String(object.status ?? '') : null,
      titel: 'naam' in object ? String(object.naam ?? object.adres ?? '') : String(object.adres ?? ''),
    })),
    ...signalen.map(signaal => ({
      bronType: 'off_market_signaal' as const,
      id: signaal.id,
      adres: signaal.adres,
      postcode: signaal.postcode,
      plaats: signaal.plaats,
      bagPandId: 'bagPandId' in signaal ? String(signaal.bagPandId ?? '') : null,
      bagVerblijfsobjectId: 'bagVerblijfsobjectId' in signaal ? String(signaal.bagVerblijfsobjectId ?? '') : null,
      status: signaal.status,
      titel: signaal.adres,
    })),
  ], [kansen, objecten, signalen]);

  function controleer(event: FormEvent) {
    event.preventDefault();
    setResultaat(controleerObjectCrmBreed({
      adres: adres.trim() || null,
      postcode: postcode.trim() || null,
      plaats: plaats.trim() || null,
      bagPandId: bagPandId.trim() || null,
      bagVerblijfsobjectId: bagVerblijfsobjectId.trim() || null,
    }, records));
  }

  return <div className="page-shell-wide min-w-0 overflow-x-hidden">
    <PageHeader
      title="Snelle pandcheck"
      subtitle="Controleer onderweg of een pand al voorkomt in Vastgoedkansen, Aanbod of Off-Market Radar. Er wordt niets automatisch opgeslagen."
    />

    <form onSubmit={controleer} className="section-card p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2"><Label>Adres</Label><Input value={adres} onChange={e => setAdres(e.target.value)} placeholder="Straat en huisnummer" /></div>
        <div><Label>Postcode</Label><Input value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1234 AB" /></div>
        <div><Label>Plaats</Label><Input value={plaats} onChange={e => setPlaats(e.target.value)} placeholder="Amsterdam" /></div>
        <div><Label>BAG-pand-ID (optioneel)</Label><Input value={bagPandId} onChange={e => setBagPandId(e.target.value)} /></div>
        <div><Label>BAG-verblijfsobject-ID (optioneel)</Label><Input value={bagVerblijfsobjectId} onChange={e => setBagVerblijfsobjectId(e.target.value)} /></div>
      </div>
      <Button className="mt-4" type="submit" disabled={!adres.trim() && !bagPandId.trim() && !bagVerblijfsobjectId.trim()}><Search className="mr-2 h-4 w-4" />Controleer in CRM</Button>
    </form>

    {resultaat && <section className="section-card mt-4 overflow-hidden">
      <div className="border-b p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-medium">Resultaat</h2>
          <Badge variant={resultaat.bestaand ? 'secondary' : 'outline'}>{resultaat.bestaand ? 'Bekend in CRM' : 'Nog niet bekend'}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{resultaat.matches.length} koppeling{resultaat.matches.length === 1 ? '' : 'en'} gevonden. BAG-ID heeft voorrang boven adresmatching.</p>
      </div>
      {!resultaat.matches.length ? <div className="p-6">
        <p className="text-sm">Dit pand is nog niet aangetroffen in de operationele CRM-lagen.</p>
        <Button asChild className="mt-3"><Link to="/vastgoedkansen/vinden"><Lightbulb className="mr-2 h-4 w-4" />Zoek in Pandenverkenner</Link></Button>
      </div> : <div className="divide-y">{resultaat.matches.map(match => {
        const bestemming = match.bronType === 'vastgoedkans' ? `/vastgoedkansen/${match.bronId}` : match.bronType === 'object' ? `/objecten/${match.bronId}` : `/off-market/${match.bronId}`;
        const Icoon = match.bronType === 'vastgoedkans' ? Lightbulb : match.bronType === 'object' ? Building2 : Radar;
        const label = match.bronType === 'vastgoedkans' ? 'Vastgoedkans' : match.bronType === 'object' ? 'Aanbod/Object' : 'Off-Market-signaal';
        return <Link key={`${match.bronType}:${match.bronId}`} to={bestemming} className="flex items-center justify-between gap-3 p-4 hover:bg-muted/40">
          <div className="flex min-w-0 items-center gap-3"><Icoon className="h-4 w-4 shrink-0" /><div className="min-w-0"><p className="truncate text-sm font-medium">{match.titel || label}</p><p className="text-xs text-muted-foreground">{label} · match via {match.sterkte.replaceAll('_', ' ')}{match.status ? ` · ${match.status}` : ''}</p></div></div>
          <span className="text-xs text-muted-foreground">Open dossier</span>
        </Link>;
      })}</div>}
    </section>}
  </div>;
}
