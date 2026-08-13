import { useMemo, useState } from 'react';
import { CalendarPlus, Link2, MessageSquarePlus, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataStore } from '@/hooks/useDataStore';
import { useKadasterDataRecordsForVastgoedkans } from '@/hooks/useKadasterDataRecords';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import type { Relatie } from '@/data/mock-data';

interface Props { vastgoedkansId: string; }

const norm = (value: string | null | undefined) => String(value ?? '')
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL')
  .replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

export default function VastgoedkansEigenaarRelatieKaart({ vastgoedkansId }: Props) {
  const { relaties } = useDataStore();
  const { getKansById, updateEigenaarRelatie } = useVastgoedkansen();
  const records = useKadasterDataRecordsForVastgoedkans(vastgoedkansId);
  const kans = getKansById(vastgoedkansId);
  const gekoppeld = relaties.find((r) => r.id === kans?.eigenaarRelatieId) ?? null;

  const kadasterEigenaren = useMemo(() => {
    const map = new Map<string, { naam: string; type: string | null; bronnen: number }>();
    for (const record of records.data ?? []) {
      if (record.product_code !== 'rechten' || !record.rechthebbende_naam?.trim()) continue;
      if (record.status !== 'geleverd' && record.status !== 'gedeeltelijk') continue;
      const naam = record.rechthebbende_naam.trim();
      const sleutel = norm(naam);
      if (!sleutel) continue;
      const item = map.get(sleutel) ?? { naam, type: record.rechthebbende_type?.trim() || null, bronnen: 0 };
      item.bronnen += 1;
      map.set(sleutel, item);
    }
    return [...map.entries()].map(([sleutel, item]) => ({ sleutel, ...item }));
  }, [records.data]);

  const crmMatches = useMemo(() => {
    const sleutels = new Set(kadasterEigenaren.map((e) => e.sleutel));
    return relaties.filter((r) => [r.bedrijfsnaam, r.contactpersoon, getRelatieDropdownLabel(r)].some((v) => sleutels.has(norm(v))));
  }, [kadasterEigenaren, relaties]);

  const [zoekterm, setZoekterm] = useState('');
  const [taakOpen, setTaakOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [bezigId, setBezigId] = useState<string | null>(null);
  const effectieveZoekterm = zoekterm.trim();
  const matches = useMemo(() => {
    const q = norm(effectieveZoekterm);
    if (!q) return [];
    return relaties.filter((r) => norm(r.bedrijfsnaam).includes(q) || norm(r.contactpersoon).includes(q)).slice(0, 8);
  }, [effectieveZoekterm, relaties]);
  const kansContext = [kans?.kansnummer, kans?.adres, kans?.plaats].filter(Boolean).join(' · ');

  async function koppel(relatie: Relatie) {
    setBezigId(relatie.id);
    try { await updateEigenaarRelatie(vastgoedkansId, relatie.id); toast.success('Bestaande CRM-relatie gekoppeld.'); setZoekterm(''); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Relatie koppelen mislukt.'); }
    finally { setBezigId(null); }
  }

  async function ontkoppel() {
    setBezigId('ontkoppelen');
    try { await updateEigenaarRelatie(vastgoedkansId, null); toast.success('CRM-relatie ontkoppeld.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Relatie ontkoppelen mislukt.'); }
    finally { setBezigId(null); }
  }

  return <div id="vastgoedkans-relatiekoppeling" className="scroll-mt-24 rounded-md border bg-muted/10 p-3 sm:p-4 space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Link2 className="h-4 w-4" /><h3 className="font-medium">Eigenaar & CRM-match</h3></div><p className="mt-1 text-xs text-muted-foreground">Rechthebbenden uit Kadaster blijven acquisitiedata. Alleen wanneer dezelfde partij al in je CRM bestaat, kun je die bewust koppelen. Nieuwe Kadaster-eigenaren worden hier niet automatisch als Relatie aangemaakt.</p></div>{gekoppeld && <Badge variant="outline">CRM gekoppeld</Badge>}</div>

    {kadasterEigenaren.length > 0 ? <div className="space-y-2"><p className="text-xs font-medium">Eigenaarvoorstellen uit Kadaster ({kadasterEigenaren.length})</p>{kadasterEigenaren.map((e) => <div key={e.sleutel} className="flex items-center justify-between gap-3 rounded-md border bg-background p-3"><div><p className="text-sm font-medium">{e.naam}</p><p className="text-xs text-muted-foreground">{e.type || 'Rechthebbende volgens Kadaster'}{e.bronnen > 1 ? ` · ${e.bronnen} opvragen` : ''}</p></div><Button size="sm" variant="outline" onClick={() => setZoekterm(e.naam)}>Zoek in CRM</Button></div>)}</div> : <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Nog geen bruikbare rechthebbende uit opgeslagen Rechten-gegevens gevonden.</div>}

    {!gekoppeld && crmMatches.length > 0 && <div className="rounded-md border bg-background p-3 space-y-2"><p className="text-xs font-medium">Bestaande CRM-match gevonden</p>{crmMatches.map((r) => <div key={r.id} className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{getRelatieDropdownLabel(r)}</p><p className="text-xs text-muted-foreground capitalize">{r.type}</p></div><Button size="sm" disabled={bezigId === r.id} onClick={() => koppel(r)}>Koppel</Button></div>)}</div>}

    {gekoppeld ? <div className="rounded-md border bg-background p-3 space-y-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs text-muted-foreground">Gekoppelde CRM-relatie</p><p className="mt-1 text-sm font-medium">{getRelatieDropdownLabel(gekoppeld)}</p></div><div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><a href={`/relaties/${gekoppeld.id}`}>Open relatie</a></Button><Button size="sm" variant="outline" disabled={bezigId === 'ontkoppelen'} onClick={ontkoppel}><Unlink className="mr-1.5 h-3.5 w-3.5" />Ontkoppelen</Button></div></div><div className="border-t pt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setContactOpen(true)}><MessageSquarePlus className="mr-1.5 h-4 w-4" />Contactmoment loggen</Button><Button size="sm" variant="outline" onClick={() => setTaakOpen(true)}><CalendarPlus className="mr-1.5 h-4 w-4" />Taak aanmaken</Button></div></div> : <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Nog geen bestaande CRM-relatie gekoppeld. Dat blokkeert het eigenaaronderzoek niet.</div>}

    <div className="space-y-2"><p className="text-xs text-muted-foreground">Handmatig zoeken in bestaande Relaties</p><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} placeholder="Zoek bestaande relatie op naam of bedrijf…" className="pl-9 bg-background" /></div>{effectieveZoekterm && <div className="rounded-md border bg-background divide-y">{matches.length > 0 ? matches.map((r) => <div key={r.id} className="flex items-center justify-between gap-3 p-3"><div><p className="text-sm font-medium">{getRelatieDropdownLabel(r)}</p><p className="text-xs text-muted-foreground capitalize">{r.type}</p></div><Button size="sm" disabled={bezigId === r.id || gekoppeld?.id === r.id} onClick={() => koppel(r)}>{gekoppeld?.id === r.id ? 'Gekoppeld' : 'Koppel'}</Button></div>) : <p className="p-3 text-sm text-muted-foreground">Geen bestaande relatie gevonden. De Kadaster-eigenaar blijft acquisitiedata en wordt niet automatisch aan Relaties toegevoegd.</p>}</div>}</div>

    {gekoppeld && <><ContactMomentFormDialog open={contactOpen} onOpenChange={setContactOpen} defaultRelatieId={gekoppeld.id} defaultObjectId={kans?.objectId ?? undefined} /><TaakFormDialog open={taakOpen} onOpenChange={setTaakOpen} defaultRelatieId={gekoppeld.id} defaultObjectId={kans?.objectId ?? undefined} defaultTitel="Opvolgen eigenaar Vastgoedkans" defaultType="Follow-up" defaultNotities={kansContext ? `Vastgoedkans: ${kansContext}` : `Vastgoedkans-ID: ${vastgoedkansId}`} /></>}
  </div>;
}
