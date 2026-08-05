import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ExternalLink, Landmark, Link2, Mail, Search, Unlink, UserCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import { useDataStore } from '@/hooks/useDataStore';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { bouwAcquisitieRelatieMatchReadModel } from '@/lib/acquisitieRelatieMatching';
import type { AcquisitieEigenaarWerkstroomModel } from '@/lib/acquisitieEigenaarWerkstroom';

interface Props {
  model: AcquisitieEigenaarWerkstroomModel;
  onOpenOnderzoek?: () => void;
  onOpenEigenaarZoeken?: () => void;
  onOpenRelatieKoppelen?: () => void;
  onOpenBriefVoorbereiden?: () => void;
}

const STATUS_LABEL: Record<AcquisitieEigenaarWerkstroomModel['status'], string> = {
  niet_gestart: 'Niet gestart',
  onderzoek_lopend: 'Onderzoek loopt',
  gevonden: 'Eigenaar gevonden',
  benaderd: 'Eigenaar benaderd',
  onbekend: 'Onbekend',
};

const MATCH_LABEL = {
  exact: 'Exact',
  waarschijnlijk: 'Waarschijnlijk',
  mogelijk: 'Mogelijk',
} as const;

export default function AcquisitieEigenaarWerkstroomKaart({
  model,
  onOpenOnderzoek,
  onOpenEigenaarZoeken,
  onOpenRelatieKoppelen,
  onOpenBriefVoorbereiden,
}: Props) {
  const { relaties } = useDataStore();
  const { updateEigenaarRelatie } = useVastgoedkansen();
  const [relatieDialogOpen, setRelatieDialogOpen] = useState(false);
  const [bezigRelatieId, setBezigRelatieId] = useState<string | null>(null);
  const [nieuwRelatieId, setNieuwRelatieId] = useState<string | null>(null);

  const relatieMatchModel = useMemo(
    () => bouwAcquisitieRelatieMatchReadModel(
      { eigenaarNaam: model.eigenaarNaam, plaats: model.dossier.plaats },
      relaties.map((relatie) => ({
        id: relatie.id,
        bedrijfsnaam: relatie.bedrijfsnaam,
        contactpersoon: relatie.contactpersoon,
        vestigingsplaats: (relatie as any).vestigingsplaats ?? (relatie as any).plaats ?? null,
        softDeletedAt: (relatie as any).softDeletedAt ?? (relatie as any).deletedAt ?? null,
      })),
    ),
    [model.eigenaarNaam, model.dossier.plaats, relaties],
  );

  const gekoppeldeRelatie = useMemo(
    () => relaties.find((relatie) => relatie.id === model.dossier.eigenaarRelatieId) ?? null,
    [model.dossier.eigenaarRelatieId, relaties],
  );

  const koppelRelatie = async (relatieId: string) => {
    if (model.dossier.bronType !== 'vastgoedkans') return;
    setBezigRelatieId(relatieId);
    try {
      await updateEigenaarRelatie(model.dossier.bronId, relatieId);
      setNieuwRelatieId(null);
      toast.success('CRM-relatie gekoppeld aan de Vastgoedkans.');
    } catch (error: any) {
      toast.error(error.message ?? 'Relatie koppelen mislukt.');
    } finally {
      setBezigRelatieId(null);
    }
  };

  const ontkoppelRelatie = async () => {
    if (model.dossier.bronType !== 'vastgoedkans') return;
    setBezigRelatieId(model.dossier.eigenaarRelatieId ?? 'ontkoppelen');
    try {
      await updateEigenaarRelatie(model.dossier.bronId, null);
      toast.success('CRM-relatie ontkoppeld. De geregistreerde eigenaarnaam is behouden.');
    } catch (error: any) {
      toast.error(error.message ?? 'Relatie ontkoppelen mislukt.');
    } finally {
      setBezigRelatieId(null);
    }
  };

  const primaireActie = !model.heeftEigenaar
    ? {
        label: model.kanEigenaarZoeken ? 'Start eigenaarsonderzoek' : 'Vul eerst een adres in',
        onClick: onOpenOnderzoek,
        disabled: !model.kanEigenaarZoeken || !onOpenOnderzoek,
        Icon: Search,
      }
    : !model.heeftRelatiekoppeling
      ? {
          label: 'Beoordeel CRM-relaties',
          onClick: onOpenRelatieKoppelen,
          disabled: !model.kanRelatieKoppelen || !onOpenRelatieKoppelen,
          Icon: Link2,
        }
      : {
          label: 'Bereid brief voor',
          onClick: onOpenBriefVoorbereiden,
          disabled: !model.kanBriefVoorbereiden || !onOpenBriefVoorbereiden,
          Icon: Mail,
        };

  return (
    <section className="section-card p-4 sm:p-5" data-testid="acquisitie-eigenaar-werkstroom">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Kadaster & eigenaar</h2>
            <Badge variant="outline">{STATUS_LABEL[model.status]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Werk stap voor stap van pandonderzoek naar een gekoppelde eigenaar en gerichte benadering.
          </p>
        </div>
        <Button type="button" size="sm" onClick={primaireActie.onClick} disabled={primaireActie.disabled}>
          <primaireActie.Icon className="mr-1.5 h-4 w-4" />
          {primaireActie.label}
          {!primaireActie.disabled && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">1. Pandonderzoek</p>
          <p className="mt-1 text-sm font-medium">{model.kadastraleAanduiding ? 'Kadastrale context bekend' : 'Nog te onderzoeken'}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.laatstGecontroleerdOp ? `Laatst gecontroleerd: ${model.laatstGecontroleerdOp}` : 'Kadaster blijft handmatig; er wordt niets automatisch besteld.'}
          </p>
        </div>

        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">2. Eigenaar</p>
          <p className="mt-1 text-sm font-medium">{model.eigenaarNaam || (model.heeftRelatiekoppeling ? 'Via CRM-relatie bekend' : 'Nog niet gevonden')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{model.eigenaarBron ? `Bron: ${model.eigenaarBron}` : 'Leg bron en controleerdatum vast.'}</p>
        </div>

        <div className="rounded-md border border-border bg-muted/15 p-3">
          <p className="text-xs text-muted-foreground">3. CRM-koppeling</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
            <UserCheck className="h-4 w-4" />
            {model.heeftRelatiekoppeling ? 'Relatie gekoppeld' : 'Nog niet gekoppeld'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {model.heeftRelatiekoppeling ? 'Contactmomenten, taken en brieven kunnen in één dossier landen.' : 'Koppel pas nadat de eigenaar voldoende betrouwbaar is vastgesteld.'}
          </p>
        </div>
      </div>

      {model.heeftRelatiekoppeling && (
        <div className="mt-4 rounded-md border border-border bg-card/60 p-3" data-testid="acquisitie-gekoppelde-relatie">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Gekoppelde CRM-relatie</p>
              <p className="mt-1 truncate text-sm font-medium">{gekoppeldeRelatie?.bedrijfsnaam || gekoppeldeRelatie?.contactpersoon || model.dossier.eigenaarRelatieId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild type="button" size="sm" variant="outline">
                <Link to={`/relaties/${model.dossier.eigenaarRelatieId}`} target="_blank" rel="noreferrer">Open relatie<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={ontkoppelRelatie} disabled={Boolean(bezigRelatieId)}>
                <Unlink className="mr-1.5 h-4 w-4" />Ontkoppelen
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Ontkoppelen verwijdert alleen de CRM-koppeling; de handmatig geregistreerde eigenaargegevens blijven staan.</p>
        </div>
      )}

      {model.heeftEigenaar && !model.heeftRelatiekoppeling && (
        <div className="mt-4 rounded-md border border-border bg-card/60 p-3" data-testid="acquisitie-relatiekiezer">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Mogelijke CRM-relaties</p>
              <p className="mt-1 text-xs text-muted-foreground">{relatieMatchModel.primaireActie}</p>
            </div>
            <Badge variant="outline">Expliciete bevestiging</Badge>
          </div>

          {relatieMatchModel.matches.length === 0 ? (
            <p className="mt-3 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">Geen bestaande relatie gevonden voor “{model.eigenaarNaam}”. Er wordt niets automatisch aangemaakt of gekoppeld.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {relatieMatchModel.matches.slice(0, 5).map((match) => (
                <div key={match.relatieId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{match.label}</p>
                      <Badge variant={match.niveau === 'exact' ? 'secondary' : 'outline'}>{MATCH_LABEL[match.niveau]}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{match.redenen.join(' · ')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild type="button" size="sm" variant="outline">
                      <Link to={`/relaties/${match.relatieId}`} target="_blank" rel="noreferrer">Open<ExternalLink className="ml-1.5 h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button type="button" size="sm" onClick={() => koppelRelatie(match.relatieId)} disabled={Boolean(bezigRelatieId)}>
                      <Link2 className="mr-1.5 h-4 w-4" />{bezigRelatieId === match.relatieId ? 'Koppelen…' : 'Koppeling bevestigen'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {nieuwRelatieId && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Nieuwe relatie is aangemaakt</p>
                <p className="mt-1 text-xs text-muted-foreground">Controleer de relatie en bevestig daarna afzonderlijk de koppeling.</p>
              </div>
              <Button type="button" size="sm" onClick={() => koppelRelatie(nieuwRelatieId)} disabled={Boolean(bezigRelatieId)}>
                <Link2 className="mr-1.5 h-4 w-4" />Koppeling bevestigen
              </Button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setRelatieDialogOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" />Nieuwe relatie voorbereiden
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{relatieMatchModel.veiligheidsmelding}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {model.kanEigenaarZoeken && onOpenEigenaarZoeken && <Button type="button" size="sm" variant="outline" onClick={onOpenEigenaarZoeken}><Search className="mr-1.5 h-4 w-4" />Zoek eigenaar</Button>}
        {model.kanBriefVoorbereiden && onOpenBriefVoorbereiden && <Button type="button" size="sm" variant="outline" onClick={onOpenBriefVoorbereiden}><Mail className="mr-1.5 h-4 w-4" />Brief voorbereiden</Button>}
      </div>

      <RelatieFormDialog
        open={relatieDialogOpen}
        onOpenChange={setRelatieDialogOpen}
        initialValues={{
          bedrijfsnaam: model.eigenaarNaam ?? '',
          type: 'eigenaar',
          vestigingsplaats: model.dossier.plaats ?? undefined,
          bronRelatie: 'Vastgoedkans',
          leadStatus: 'lauw',
        }}
        onCreated={(relatieId) => {
          setNieuwRelatieId(relatieId);
          toast.success('Relatie aangemaakt. Bevestig nu afzonderlijk de koppeling.');
        }}
      />
    </section>
  );
}
