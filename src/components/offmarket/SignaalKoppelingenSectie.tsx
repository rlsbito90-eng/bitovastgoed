// Koppelingen-paneel voor een off-market signaal:
// - Eigenaar/relatie kiezen, ontkoppelen of nieuw aanmaken
// - Promoten naar object (idempotent via RPC) met optionele Kadaster-migratie
// - Doorklik naar gekoppeld object indien aanwezig
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowUpRight, Building2, Plus, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

const norm = (s: string | undefined | null) =>
  (s ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

interface Props {
  signaal: OffMarketSignaal;
}

export default function SignaalKoppelingenSectie({ signaal }: Props) {
  const navigate = useNavigate();
  const { relaties, contactpersonen, getObjectById } = useDataStore();
  const linkRelatie = useLinkRelatieToSignaal();
  const promote = usePromoteSignaalToObject();
  const [nieuwRelatieOpen, setNieuwRelatieOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [migrateKadaster, setMigrateKadaster] = useState(true);

  const kadasterRecords = useKadasterDataRecordsForSignaal(signaal.id);
  const heeftKadasterRecords = (kadasterRecords.data ?? []).length > 0;

  const relatieItems = useMemo<EntityPickerItem[]>(
    () =>
      relaties.map((r) => {
        const { primair, secundair } = getRelatieNamen(r, contactpersonen);
        const cps = contactpersonen.filter((c) => c.relatieId === r.id);
        const haystack = norm(
          [
            primair, secundair, r.bedrijfsnaam, r.contactpersoon, r.email,
            r.telefoon, r.vestigingsplaats,
            ...cps.flatMap((c) => [c.naam, c.email, c.telefoon, c.functie]),
          ].filter(Boolean).join(' '),
        );
        return { id: r.id, primair, secundair, searchHaystack: haystack };
      }),
    [relaties, contactpersonen],
  );

  const gekoppeldObject = signaal.gekoppeld_object_id ? getObjectById(signaal.gekoppeld_object_id) : null;

  const handleRelatieChange = async (id: string) => {
    try {
      await linkRelatie.mutateAsync({ signaalId: signaal.id, relatieId: id || null });
      toast.success(id ? 'Eigenaar gekoppeld' : 'Eigenaar ontkoppeld');
    } catch (e: any) {
      toast.error(e?.message ?? 'Koppelen mislukt');
    }
  };

  const openPromote = () => {
    setMigrateKadaster(true);
    setPromoteOpen(true);
  };

  const handlePromoteConfirm = async () => {
    try {
      const res = await promote.mutateAsync({
        signaalId: signaal.id,
        migrateKadaster: heeftKadasterRecords && migrateKadaster,
      });
      setPromoteOpen(false);
      toast.success(signaal.gekoppeld_object_id ? 'Object al gekoppeld' : 'Signaal omgezet naar object');
      if (heeftKadasterRecords && migrateKadaster) {
        if (res.kadasterMigrationError) {
          toast.warning(
            'Object is aangemaakt, maar Kadasterdata kon niet automatisch worden gekoppeld. ' +
            'De data staat nog bij het oorspronkelijke signaal.',
            { duration: 12_000 },
          );
        } else if (res.kadasterMigrated > 0) {
          toast.success('Kadasterdata meegenomen naar object.');
        }
      }
      navigate(`/objecten/${res.objectId}`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Promote mislukt');
    }
  };

  return (
    <section className="section-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground">Koppelingen</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setNieuwRelatieOpen(true)}>
            <UserPlus className="h-4 w-4" /> Nieuwe relatie
          </Button>
          {gekoppeldObject ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/objecten/${gekoppeldObject.id}`}>
                <Building2 className="h-4 w-4" /> Open object
                <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
              </Link>
            </Button>
          ) : (
            <Button size="sm" onClick={openPromote} disabled={promote.isPending}>
              <Plus className="h-4 w-4" /> {promote.isPending ? 'Bezig…' : 'Omzetten naar object'}
            </Button>
          )}
        </div>
      </div>

      <EntityPicker
        label="Eigenaar / relatie"
        pickerTitle="Kies relatie"
        searchPlaceholder="Zoek op bedrijf, contactpersoon, e-mail…"
        emptyLabel="Nog geen eigenaar gekoppeld"
        value={signaal.eigenaar_relatie_id ?? ''}
        onChange={handleRelatieChange}
        items={relatieItems}
      />

      {gekoppeldObject && (
        <p className="text-xs text-muted-foreground">
          Dit signaal is omgezet naar object{' '}
          <Link to={`/objecten/${gekoppeldObject.id}`} className="text-accent hover:underline">
            {gekoppeldObject.titel || gekoppeldObject.adres || 'object'}
          </Link>.
        </p>
      )}

      <RelatieFormDialog
        open={nieuwRelatieOpen}
        onOpenChange={setNieuwRelatieOpen}
        onCreated={(relatieId) => {
          handleRelatieChange(relatieId);
        }}
      />

      <AlertDialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Signaal omzetten naar object</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Hiermee wordt een nieuw object aangemaakt op basis van dit
                  signaal. Er worden geen relaties, eigenaren of verkopers
                  automatisch gekoppeld.
                </p>
                {heeftKadasterRecords && (
                  <div
                    data-testid="promote-kadaster-migratie"
                    className="rounded-md border border-border bg-muted/30 p-3 space-y-2"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <Checkbox
                        checked={migrateKadaster}
                        onCheckedChange={(v) => setMigrateKadaster(v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm font-medium text-foreground">
                        Kadasterdata meenemen naar object
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Reeds opgehaalde Kadasterdata wordt gekoppeld aan het
                      nieuwe object, zodat er geen nieuwe Kadasteraanvraag nodig
                      is. Er worden geen objectvelden, relaties of eigenaren
                      automatisch overschreven.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promote.isPending}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromoteConfirm} disabled={promote.isPending}>
              {promote.isPending ? 'Bezig…' : 'Omzetten naar object'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
