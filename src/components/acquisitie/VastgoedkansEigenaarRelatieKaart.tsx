import { useMemo, useState } from 'react';
import { Database, Link2, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import VastgoedkansEigenaarActiviteitKaart from '@/components/acquisitie/VastgoedkansEigenaarActiviteitKaart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataStore } from '@/hooks/useDataStore';
import { useEigenaarCrmKoppeling } from '@/hooks/useEigenaarCrmKoppeling';
import { useVastgoedkansEigenaarsregister, type EigenaarRegisterRecord } from '@/hooks/useEigenaarsregister';
import { useKadasterDataRecordsForVastgoedkans } from '@/hooks/useKadasterDataRecords';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { bouwKadasterEigenaarVoorstellen, normaliseerPartijNaam, vindCrmMatches, type KadasterEigenaarVoorstel } from '@/lib/kadaster/eigenaarInterpretatie';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import type { Relatie } from '@/data/mock-data';

interface Props { vastgoedkansId: string; }

const MATCH_LABEL: Record<string, string> = {
  kvk_exact: 'Exact KvK',
  naam_exact: 'Exacte naam',
  contact_exact: 'Exact contact',
  naam_deels: 'Sterke naamovereenkomst',
};

function eigenaarLabel(eigenaar: EigenaarRegisterRecord) {
  return eigenaar.bedrijfsnaam || eigenaar.naam;
}

export default function VastgoedkansEigenaarRelatieKaart({ vastgoedkansId }: Props) {
  const { relaties } = useDataStore();
  const { getKansById, updateEigenaarRelatie } = useVastgoedkansen();
  const kans = getKansById(vastgoedkansId);
  const records = useKadasterDataRecordsForVastgoedkans(vastgoedkansId);
  const crmMutatie = useEigenaarCrmKoppeling(vastgoedkansId);

  const eigenaarVoorstellen = useMemo(
    () => bouwKadasterEigenaarVoorstellen(records.data ?? []),
    [records.data],
  );
  const register = useVastgoedkansEigenaarsregister(vastgoedkansId, eigenaarVoorstellen);
  const centraleEigenaren = useMemo(
    () => register.koppelingen.map((k) => k.eigenaar).filter((e): e is EigenaarRegisterRecord => Boolean(e)),
    [register.koppelingen],
  );
  const aantalCrmGekoppeld = centraleEigenaren.filter((e) => e.crm_relatie_id).length;

  const legacyRelatie = relaties.find((r) => r.id === kans?.eigenaarRelatieId) ?? null;
  const [zoekterm, setZoekterm] = useState('');
  const [zoekEigenaarId, setZoekEigenaarId] = useState<string | null>(null);
  const [bezigId, setBezigId] = useState<string | null>(null);
  const zoekEigenaar = centraleEigenaren.find((e) => e.id === zoekEigenaarId) ?? null;
  const effectieveZoekterm = zoekterm.trim();
  const handmatigeMatches = useMemo(() => {
    const q = normaliseerPartijNaam(effectieveZoekterm);
    if (!q || !zoekEigenaar) return [];
    return relaties
      .filter((r) => normaliseerPartijNaam(r.bedrijfsnaam).includes(q) || normaliseerPartijNaam(r.contactpersoon).includes(q))
      .sort((a, b) => getRelatieDropdownLabel(a).localeCompare(getRelatieDropdownLabel(b), 'nl', { sensitivity: 'base' }))
      .slice(0, 8);
  }, [effectieveZoekterm, relaties, zoekEigenaar]);
  const kansContext = [kans?.kansnummer, kans?.adres, kans?.plaats].filter(Boolean).join(' · ');

  function eigenaarBijVoorstel(voorstel: KadasterEigenaarVoorstel) {
    const norm = normaliseerPartijNaam(voorstel.bedrijfsnaam ?? voorstel.naam);
    return centraleEigenaren.find((e) => normaliseerPartijNaam(e.bedrijfsnaam ?? e.naam) === norm) ?? null;
  }

  function startZoeken(eigenaar: EigenaarRegisterRecord, voorstel?: KadasterEigenaarVoorstel) {
    setZoekEigenaarId(eigenaar.id);
    setZoekterm(voorstel?.bedrijfsnaam ?? voorstel?.naam ?? eigenaarLabel(eigenaar));
  }

  async function koppel(eigenaar: EigenaarRegisterRecord, relatie: Relatie) {
    setBezigId(`${eigenaar.id}:${relatie.id}`);
    try {
      await crmMutatie.mutateAsync({ eigenaarId: eigenaar.id, relatieId: relatie.id });
      toast.success(`${eigenaarLabel(eigenaar)} is gekoppeld aan de bestaande CRM-relatie.`);
      setZoekterm('');
      setZoekEigenaarId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CRM-relatie koppelen mislukt.');
    } finally {
      setBezigId(null);
    }
  }

  async function ontkoppel(eigenaar: EigenaarRegisterRecord) {
    setBezigId(`ontkoppel:${eigenaar.id}`);
    try {
      await crmMutatie.mutateAsync({ eigenaarId: eigenaar.id, relatieId: null });
      toast.success(`CRM-relatie van ${eigenaarLabel(eigenaar)} ontkoppeld.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CRM-relatie ontkoppelen mislukt.');
    } finally {
      setBezigId(null);
    }
  }

  async function zetLegacyOver() {
    if (!legacyRelatie || centraleEigenaren.length !== 1) return;
    const eigenaar = centraleEigenaren[0];
    setBezigId('legacy-overzetten');
    try {
      await crmMutatie.mutateAsync({ eigenaarId: eigenaar.id, relatieId: legacyRelatie.id });
      await updateEigenaarRelatie(vastgoedkansId, null);
      toast.success('Oude dossierkoppeling is overgezet naar de specifieke eigenaar.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Oude CRM-koppeling overzetten mislukt.');
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
            Een CRM-koppeling hoort bij een specifieke eigenaar, niet bij de Vastgoedkans als geheel. Kadaster-eigenaren blijven acquisitiedata en worden nooit automatisch als nieuwe CRM-relatie aangemaakt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {register.koppelingen.length > 0 && <Badge variant="outline"><Database className="mr-1 h-3 w-3" />Eigenaarsregister {register.koppelingen.length}</Badge>}
          {aantalCrmGekoppeld > 0 && <Badge variant="outline">CRM gekoppeld {aantalCrmGekoppeld}</Badge>}
        </div>
      </div>

      {register.syncIsPending && <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">Eigenaarsregister automatisch bijwerken…</div>}
      {register.syncError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-destructive">Eigenaarsgegevens konden niet centraal worden opgeslagen. Er wordt geen nieuwe Kadasteraanvraag gedaan.</p>
          <Button size="sm" variant="outline" onClick={register.retrySync}>Opnieuw opslaan</Button>
        </div>
      )}

      {eigenaarVoorstellen.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">Eigenaarvoorstellen uit Kadaster ({eigenaarVoorstellen.length})</p>
          {eigenaarVoorstellen.map((voorstel) => {
            const eigenaar = eigenaarBijVoorstel(voorstel);
            const gekoppeldeRelatie = eigenaar?.crm_relatie_id ? relaties.find((r) => r.id === eigenaar.crm_relatie_id) ?? null : null;
            const crmMatches = eigenaar && !gekoppeldeRelatie ? vindCrmMatches(voorstel, relaties).slice(0, 3) : [];
            const adres = [...voorstel.adresRegels, [voorstel.postcode, voorstel.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ');
            return (
              <div key={voorstel.sleutel} className="rounded-md border bg-background p-3 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{voorstel.bedrijfsnaam ?? voorstel.naam}</p>
                      {eigenaar && <Badge variant="secondary" className="text-[10px]">Centraal opgeslagen</Badge>}
                      {gekoppeldeRelatie && <Badge variant="outline" className="text-[10px]">CRM gekoppeld</Badge>}
                    </div>
                    {voorstel.persoonType === 'natuurlijk' && voorstel.voorletters && <p className="text-xs text-muted-foreground">Voorletters: {voorstel.voorletters}</p>}
                    <p className="text-xs text-muted-foreground">{voorstel.type || (voorstel.persoonType === 'rechtspersoon' ? 'Rechtspersoon' : voorstel.persoonType === 'natuurlijk' ? 'Natuurlijk persoon' : 'Rechthebbende volgens Kadaster')}</p>
                  </div>
                  {eigenaar && !gekoppeldeRelatie && <Button size="sm" variant="outline" onClick={() => startZoeken(eigenaar, voorstel)}>Zoek in CRM</Button>}
                </div>

                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  {voorstel.kvkNummer && <p>KvK: <span className="text-foreground">{voorstel.kvkNummer}</span></p>}
                  {adres && <p>Adres: <span className="text-foreground">{adres}</span></p>}
                  {voorstel.rechtsoort && <p>Recht: <span className="text-foreground">{voorstel.rechtsoort}</span></p>}
                  {voorstel.aandeel && <p>Aandeel: <span className="text-foreground">{voorstel.aandeel}</span></p>}
                </div>

                {eigenaar && gekoppeldeRelatie && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/10 p-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground">CRM-relatie van deze eigenaar</p>
                      <p className="text-sm font-medium">{getRelatieDropdownLabel(gekoppeldeRelatie)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><a href={`/relaties/${gekoppeldeRelatie.id}`}>Open relatie</a></Button>
                      <Button size="sm" variant="outline" disabled={bezigId === `ontkoppel:${eigenaar.id}`} onClick={() => ontkoppel(eigenaar)}><Unlink className="mr-1.5 h-3.5 w-3.5" />Ontkoppelen</Button>
                    </div>
                  </div>
                )}

                {eigenaar && !gekoppeldeRelatie && crmMatches.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium">Voorgestelde bestaande CRM-match</p>
                    {crmMatches.map((match) => (
                      <div key={match.relatie.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{getRelatieDropdownLabel(match.relatie)}</p>
                          <p className="text-xs text-muted-foreground">{MATCH_LABEL[match.reden] ?? match.reden} · {match.score}%</p>
                        </div>
                        <Button size="sm" disabled={bezigId === `${eigenaar.id}:${match.relatie.id}`} onClick={() => koppel(eigenaar, match.relatie)}>Koppel aan eigenaar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Nog geen bruikbare rechthebbende uit opgeslagen Rechten-gegevens gevonden.</div>
      )}

      <VastgoedkansEigenaarActiviteitKaart vastgoedkansId={vastgoedkansId} eigenaren={centraleEigenaren} objectId={kans?.objectId ?? null} contextLabel={kansContext} />

      {legacyRelatie && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <p className="text-xs font-medium">Oude dossierniveau CRM-koppeling</p>
          <p className="text-xs text-muted-foreground">{getRelatieDropdownLabel(legacyRelatie)} is nog volgens het oude model aan de hele Vastgoedkans gekoppeld. Nieuwe koppelingen worden eigenaar-specifiek opgeslagen.</p>
          {centraleEigenaren.length === 1 && !centraleEigenaren[0].crm_relatie_id && <Button size="sm" variant="outline" disabled={bezigId === 'legacy-overzetten'} onClick={zetLegacyOver}>Overzetten naar {eigenaarLabel(centraleEigenaren[0])}</Button>}
        </div>
      )}

      {zoekEigenaar && (
        <div className="space-y-2 rounded-md border bg-background p-3">
          <p className="text-xs font-medium">Handmatig zoeken voor {eigenaarLabel(zoekEigenaar)}</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} placeholder="Zoek bestaande relatie op naam of bedrijf…" className="pl-9 bg-background" />
          </div>
          {effectieveZoekterm && (
            <div className="rounded-md border divide-y">
              {handmatigeMatches.length > 0 ? handmatigeMatches.map((relatie) => (
                <div key={relatie.id} className="flex items-center justify-between gap-3 p-3">
                  <div><p className="text-sm font-medium">{getRelatieDropdownLabel(relatie)}</p><p className="text-xs text-muted-foreground capitalize">{relatie.type}</p></div>
                  <Button size="sm" disabled={bezigId === `${zoekEigenaar.id}:${relatie.id}`} onClick={() => koppel(zoekEigenaar, relatie)}>Koppel aan eigenaar</Button>
                </div>
              )) : <p className="p-3 text-sm text-muted-foreground">Geen bestaande relatie gevonden. Er wordt niet automatisch een nieuwe CRM-relatie aangemaakt.</p>}
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => { setZoekEigenaarId(null); setZoekterm(''); }}>Zoeken sluiten</Button>
        </div>
      )}

      {!legacyRelatie && aantalCrmGekoppeld === 0 && (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Nog geen bestaande CRM-relatie aan een eigenaar gekoppeld. Dat blokkeert eigenaaronderzoek, brieven of opvolging niet.</div>
      )}
    </div>
  );
}
