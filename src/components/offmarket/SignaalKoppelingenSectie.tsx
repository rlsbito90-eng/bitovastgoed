// Koppelingen-paneel voor een off-market signaal.
// Bestaande CRM-objecten worden eerst gecontroleerd en expliciet gekoppeld.
// Nieuwe objecten worden alleen na bevestiging aangemaakt; externe brondata
// wordt daarbij niet automatisch verplaatst of opnieuw opgehaald.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUpRight, Building2, Link2, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EntityPicker, { type EntityPickerItem } from '@/components/forms/EntityPicker';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import {
  useLinkRelatieToSignaal,
  usePromoteSignaalToObject,
} from '@/hooks/useOffMarketLinks';
import { useLinkObjectToSignaal } from '@/hooks/useLinkObjectToSignaal';
import { zoekBestaandeObjecten } from '@/lib/objectIdentity';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

interface Props {
  signaal: OffMarketSignaal;
}

export default function SignaalKoppelingenSectie({ signaal }: Props) {
  const navigate = useNavigate();
  const {
    relaties,
    contactpersonen,
    objecten,
    getObjectById,
    refresh: refreshDataStore,
  } = useDataStore();
  const linkRelatie = useLinkRelatieToSignaal();
  const linkObject = useLinkObjectToSignaal();
  const promote = usePromoteSignaalToObject();
  const [nieuwRelatieOpen, setNieuwRelatieOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const relatieItems = useMemo<EntityPickerItem[]>(
    () => relaties.map((r) => {
      const { primair, secundair } = getRelatieNamen(r, contactpersonen);
      const cps = contactpersonen.filter((c) => c.relatieId === r.id);
      const haystack = norm([
        primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email,
        r.telefoon, r.vestigingsplaats,
        ...cps.flatMap((c) => [c.naam, c.email, c.telefoon, c.functie]),
      ].filter(Boolean).join(' '));
      return { id: r.id, primair, secundair, searchHaystack: haystack };
    }),
    [relaties, contactpersonen],
  );

  const gekoppeldObject = signaal.gekoppeld_object_id
    ? getObjectById(signaal.gekoppeld_object_id)
    : null;

  const objectMatches = useMemo(() => {
    if (gekoppeldObject) return [];
    return zoekBestaandeObjecten({
      adres: signaal.adres,
      postcode: signaal.postcode,
      plaats: signaal.plaats,
      bagVerblijfsobjectId: (signaal as any).bag_verblijfsobject_id ?? null,
    }, objecten.map((object) => ({
      ...object,
      bagVerblijfsobjectId: (object as any).bagVerblijfsobjectId ?? null,
    }))).slice(0, 5);
  }, [gekoppeldObject, objecten, signaal]);

  const handleRelatieChange = async (id: string) => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId: id || null });
      toast.success(id ? 'Eigenaar gekoppeld' : 'Eigenaar ontkoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  const handleObjectKoppelen = async (objectId: string) => {
    try {
      await linkObject.mutateAsync({ signaalId: signaal.id, objectId });
      toast.success('Bestaand object gekoppeld');
      await refreshDataStore();
      navigate(`/objecten/${objectId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Object koppelen mislukt');
    }
  };

  const handlePromoteConfirm = async () => {
    try {
      const res = await promote.mutateAsync({
        signaalId: signaal.id,
        migrateKadaster: false,
      });
      setPromoteOpen(false);
      toast.success(signaal.gekoppeld_object_id
        ? 'Object was al gekoppeld'
        : 'Nieuw CRM-object aangemaakt');
      await refreshDataStore();
      navigate(`/objecten/${res.objectId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Object aanmaken mislukt');
    }
  };

  return (
    <section className="section-card p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:flex-wrap">
        <h2 className="text-sm font-semibold text-foreground">Koppelingen</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNieuwRelatieOpen(true)}
            className="w-full sm:w-auto justify-center"
          >
            <UserPlus className="h-4 w-4" /> Nieuwe relatie
          </Button>
          {gekoppeldObject ? (
            <Button variant="outline" size="sm" asChild className="w-full sm:w-auto justify-center">
              <Link to={`/objecten/${gekoppeldObject.id}`}>
                <Building2 className="h-4 w-4" /> Open object
                <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
              </Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant={objectMatches.length > 0 ? 'outline' : 'default'}
              onClick={() => setPromoteOpen(true)}
              disabled={promote.isPending || linkObject.isPending}
              className="w-full sm:w-auto justify-center"
            >
              <Plus className="h-4 w-4" />
              {promote.isPending ? 'Bezig…' : objectMatches.length > 0 ? 'Toch nieuw object' : 'Nieuw object aanmaken'}
            </Button>
          )}
        </div>
      </div>

      <EntityPicker
        label="CRM-relatie"
        pickerTitle="Kies relatie"
        searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
        emptyLabel="CRM-relatie nog niet gekoppeld"
        value={signaal.eigenaar_relatie_id ?? ''}
        onChange={handleRelatieChange}
        items={relatieItems}
      />

      {!gekoppeldObject && objectMatches.length > 0 && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-3"
          data-testid="signaal-objectmatches"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Mogelijk bestaand CRM-object gevonden</p>
            <p className="text-xs text-muted-foreground">
              Koppel bij voorkeur een bestaand object. Zo blijven signalen, kansen en contacthistorie bij één object-ID.
            </p>
          </div>
          <ul className="space-y-2">
            {objectMatches.map((match) => (
              <li
                key={match.object.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-background/80 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {match.object.titel || match.object.adres || 'Object'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[match.object.adres, match.object.postcode, match.object.plaats].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{match.reden}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleObjectKoppelen(match.object.id!)}
                  disabled={linkObject.isPending}
                >
                  <Link2 className="h-3.5 w-3.5" /> Koppel object
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {gekoppeldObject && (
        <p className="text-xs text-muted-foreground">
          Dit signaal is gekoppeld aan CRM-object{' '}
          <Link to={`/objecten/${gekoppeldObject.id}`} className="text-accent hover:underline">
            {gekoppeldObject.titel || gekoppeldObject.adres || 'object'}
          </Link>.
        </p>
      )}

      <RelatieFormDialog
        open={nieuwRelatieOpen}
        onOpenChange={setNieuwRelatieOpen}
        onCreated={(relatieId) => handleRelatieChange(relatieId)}
      />

      <AlertDialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nieuw CRM-object aanmaken</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Hiermee wordt een nieuw object aangemaakt op basis van dit signaal en wordt het signaal aan dat object-ID gekoppeld.
                </p>
                {objectMatches.length > 0 && (
                  <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-foreground">
                    Er zijn al {objectMatches.length} mogelijke objectmatch{objectMatches.length === 1 ? '' : 'es'} gevonden. Maak alleen een nieuw object aan wanneer dit aantoonbaar een ander object is.
                  </p>
                )}
                <p>
                  Eigenaren, relaties en externe brongegevens worden niet automatisch gekoppeld, verplaatst of opnieuw opgehaald.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promote.isPending}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteConfirm} disabled={promote.isPending}>
              {promote.isPending ? 'Bezig…' : 'Nieuw object aanmaken'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
