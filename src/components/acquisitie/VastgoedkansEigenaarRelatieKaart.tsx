import { useMemo, useState } from 'react';
import { CalendarPlus, Database, Link2, MessageSquarePlus, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import ContactMomentFormDialog from '@/components/forms/ContactMomentFormDialog';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import VastgoedkansEigenaarActiviteitKaart from '@/components/acquisitie/VastgoedkansEigenaarActiviteitKaart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataStore } from '@/hooks/useDataStore';
import { useVastgoedkansEigenaarsregister, type EigenaarRegisterRecord } from '@/hooks/useEigenaarsregister';
import { useKadasterDataRecordsForVastgoedkans } from '@/hooks/useKadasterDataRecords';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { bouwKadasterEigenaarVoorstellen, normaliseerPartijNaam, vindCrmMatches } from '@/lib/kadaster/eigenaarInterpretatie';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import type { Relatie } from '@/data/mock-data';

interface Props { vastgoedkansId: string; }

const MATCH_LABEL: Record<string, string> = {
  kvk_exact: 'Exact KvK',
  naam_exact: 'Exacte naam',
  contact_exact: 'Exact contact',
  naam_deels: 'Sterke naamovereenkomst',
};

export default function VastgoedkansEigenaarRelatieKaart({ vastgoedkansId }: Props) {
  const { relaties } = useDataStore();
  const { getKansById, updateEigenaarRelatie } = useVastgoedkansen();
  const records = useKadasterDataRecordsForVastgoedkans(vastgoedkansId);
  const kans = getKansById(vastgoedkansId);
  const gekoppeld = relaties.find((r) => r.id === kans?.eigenaarRelatieId) ?? null;

  const eigenaarVoorstellen = useMemo(
    () => bouwKadasterEigenaarVoorstellen(records.data ?? []),
    [records.data],
  );
  const register = useVastgoedkansEigenaarsregister(vastgoedkansId, eigenaarVoorstellen);
  const centraleEigenaren = useMemo(
    () => register.koppelingen.map((k) => k.eigenaar).filter((e): e is EigenaarRegisterRecord => Boolean(e)),
    [register.koppelingen],
  );

  const crmMatches = useMemo(() => {
    const beste = new Map<string, ReturnType<typeof vindCrmMatches>[number]>();
    for (const voorstel of eigenaarVoorstellen) {
      for (const match of vindCrmMatches(voorstel, relaties)) {
        const bestaand = beste.get(match.relatie.id);
        if (!bestaand || match.score > bestaand.score) beste.set(match.relatie.id, match);
      }
    }
    return [...beste.values()].sort((a, b) => b.score - a.score).slice(0, 5);
  }, [eigenaarVoorstellen, relaties]);

  const [zoekterm, setZoekterm] = useState('');
  const [taakOpen, setTaakOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [bezigId, setBezigId] = useState<string | null>(null);
  const effectieveZoekterm = zoekterm.trim();
  const matches = useMemo(() => {
    const q = normaliseerPartijNaam(effectieveZoekterm);
    if (!q) return [];
    return relaties
      .filter((r) => normaliseerPartijNaam(r.bedrijfsnaam).includes(q) || normaliseerPartijNaam(r.contactpersoon).includes(q))
      .sort((a, b) => getRelatieDropdownLabel(a).localeCompare(getRelatieDropdownLabel(b), 'nl', { sensitivity: 'base' }))
      .slice(0, 8);
  }, [effectieveZoekterm, relaties]);
  const kansContext = [kans?.kansnummer, kans?.adres, kans?.plaats].filter(Boolean).join(' · ');

  async function koppel(relatie: Relatie) {
    setBezigId(relatie.id);
    try {
      await updateEigenaarRelatie(vastgoedkansId, relatie.id);
      toast.success('Bestaande CRM-relatie gekoppeld.');
      setZoekterm('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Relatie koppelen mislukt.');
    } finally {
      setBezigId(null);
    }
  }

  async function ontkoppel() {
    setBezigId('ontkoppelen');
    try {
      await updateEigenaarRelatie(vastgoedkansId, null);
      toast.success('CRM-relatie ontkoppeld.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Relatie ontkoppelen mislukt.');
    } finally {
      setBezigId(null);
    }
  }

  return (
    <div id="vastgoedkans-relatiekoppeling" className="scroll-mt-24 rounded-md border bg-muted/10 p-3 sm:p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <h3 className="font-medium">Eigenaar & CRM-match</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Kadaster-eigenaren blijven acquisitiedata en worden centraal opgeslagen. Bestaande CRM-relaties worden alleen als match voorgesteld; een nieuwe Kadaster-eigenaar wordt niet automatisch aan Relaties toegevoegd.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {register.koppelingen.length > 0 && <Badge variant="outline"><Database className="mr-1 h-3 w-3" />Eigenaarsregister {register.koppelingen.length}</Badge>}
          {gekoppeld && <Badge variant="outline">CRM gekoppeld</Badge>}
        </div>
      </div>

      {register.syncIsPending && (
        <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">Eigenaarsregister automatisch bijwerken…</div>
      )}
      {register.syncError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">Eigenaarsgegevens konden niet centraal worden opgeslagen. Er wordt geen nieuwe Kadasteraanvraag gedaan.</p>
          <Button size="sm" variant="outline" onClick={register.retrySync}>Opnieuw opslaan</Button>
        </div>
      )}

      {eigenaarVoorstellen.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Eigenaarvoorstellen uit Kadaster ({eigenaarVoorstellen.length})</p>
          {eigenaarVoorstellen.map((e) => {
            const adres = [...e.adresRegels, [e.postcode, e.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            const centraalOpgeslagen = register.koppelingen.some((k) => normaliseerPartijNaam(k.eigenaar?.bedrijfsnaam ?? k.eigenaar?.naam) === normaliseerPartijNaam(e.bedrijfsnaam ?? e.naam));
            return (
              <div key={e.sleutel} className="rounded-md border bg-background p-3 space-y-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{e.bedrijfsnaam ?? e.naam}</p>
                      {centraalOpgeslagen && <Badge variant="secondary" className="text-[10px]">Centraal opgeslagen</Badge>}
                    </div>
                    {e.persoonType === 'natuurlijk' && e.voorletters && <p className="text-xs text-muted-foreground">Voorletters: {e.voorletters}</p>}
                    <p className="text-xs text-muted-foreground">
                      {e.type || (e.persoonType === 'rechtspersoon' ? 'Rechtspersoon' : e.persoonType === 'natuurlijk' ? 'Natuurlijk persoon' : 'Rechthebbende volgens Kadaster')}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setZoekterm(e.bedrijfsnaam ?? e.naam)}>Zoek in CRM</Button>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {e.kvkNummer && <p>KvK: <span className="text-foreground">{e.kvkNummer}</span></p>}
                  {adres && <p>Adres: <span className="text-foreground">{adres}</span></p>}
                  {e.rechtsoort && <p>Recht: <span className="text-foreground">{e.rechtsoort}</span></p>}
                  {e.aandeel && <p>Aandeel: <span className="text-foreground">{e.aandeel}</span></p>}
                  {e.bronRecordIds.length > 1 && <p>Bronnen: <span className="text-foreground">{e.bronRecordIds.length} Kadasterrecords</span></p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">
          Nog geen bruikbare rechthebbende uit opgeslagen Rechten-gegevens gevonden.
        </div>
      )}

      <VastgoedkansEigenaarActiviteitKaart
        vastgoedkansId={vastgoedkansId}
        eigenaren={centraleEigenaren}
        objectId={kans?.objectId ?? null}
        contextLabel={kansContext}
      />

      {!gekoppeld && crmMatches.length > 0 && (
        <div className="rounded-md border bg-background p-3 space-y-2">
          <p className="text-xs font-medium">Bestaande CRM-match gevonden</p>
          {crmMatches.map((match) => (
            <div key={match.relatie.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{getRelatieDropdownLabel(match.relatie)}</p>
                <p className="text-xs text-muted-foreground">{MATCH_LABEL[match.reden] ?? match.reden} · {match.score}%</p>
              </div>
              <Button size="sm" disabled={bezigId === match.relatie.id} onClick={() => koppel(match.relatie)}>Koppel</Button>
            </div>
          ))}
        </div>
      )}

      {gekoppeld ? (
        <div className="rounded-md border bg-background p-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Gekoppelde CRM-relatie</p>
              <p className="mt-1 text-sm font-medium">{getRelatieDropdownLabel(gekoppeld)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><a href={`/relaties/${gekoppeld.id}`}>Open relatie</a></Button>
              <Button size="sm" variant="outline" disabled={bezigId === 'ontkoppelen'} onClick={ontkoppel}>
                <Unlink className="mr-1.5 h-3.5 w-3.5" />Ontkoppelen
              </Button>
            </div>
          </div>
          <div className="border-t pt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setContactOpen(true)}><MessageSquarePlus className="mr-1.5 h-4 w-4" />CRM-contactmoment</Button>
            <Button size="sm" variant="outline" onClick={() => setTaakOpen(true)}><CalendarPlus className="mr-1.5 h-4 w-4" />CRM-taak</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">
          Nog geen bestaande CRM-relatie gekoppeld. Dat blokkeert het eigenaaronderzoek, brieven of opvolging niet.
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Handmatig zoeken in bestaande Relaties</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} placeholder="Zoek bestaande relatie op naam of bedrijf…" className="pl-9 bg-background" />
        </div>
        {effectieveZoekterm && (
          <div className="rounded-md border bg-background divide-y">
            {matches.length > 0 ? matches.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium">{getRelatieDropdownLabel(r)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{r.type}</p>
                </div>
                <Button size="sm" disabled={bezigId === r.id || gekoppeld?.id === r.id} onClick={() => koppel(r)}>
                  {gekoppeld?.id === r.id ? 'Gekoppeld' : 'Koppel'}
                </Button>
              </div>
            )) : (
              <p className="p-3 text-sm text-muted-foreground">Geen bestaande relatie gevonden. De Kadaster-eigenaar blijft in het Eigenaarsregister en wordt niet automatisch aan Relaties toegevoegd.</p>
            )}
          </div>
        )}
      </div>

      {gekoppeld && (
        <>
          <ContactMomentFormDialog open={contactOpen} onOpenChange={setContactOpen} defaultRelatieId={gekoppeld.id} defaultObjectId={kans?.objectId ?? undefined} />
          <TaakFormDialog open={taakOpen} onOpenChange={setTaakOpen} defaultRelatieId={gekoppeld.id} defaultObjectId={kans?.objectId ?? undefined} defaultTitel="Opvolgen eigenaar Vastgoedkans" defaultType="Follow-up" defaultNotities={kansContext ? `Vastgoedkans: ${kansContext}` : `Vastgoedkans-ID: ${vastgoedkansId}`} />
        </>
      )}
    </div>
  );
}
