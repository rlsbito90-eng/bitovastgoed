import { useMemo, useState } from 'react';
import { Link2, Plus, Search, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { QuickCreateRelationDialog } from '@/components/forms/QuickCreateRelationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDataStore } from '@/hooks/useDataStore';
import { useKadasterDataRecordsForVastgoedkans, laatsteRecordsPerProduct } from '@/hooks/useKadasterDataRecords';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { getRelatieDropdownLabel } from '@/lib/relatieNaam';
import type { Relatie } from '@/data/mock-data';

interface Props {
  vastgoedkansId: string;
}

const norm = (value: string | null | undefined) => (value ?? '').trim().toLocaleLowerCase('nl-NL');

export default function VastgoedkansEigenaarRelatieKaart({ vastgoedkansId }: Props) {
  const { relaties } = useDataStore();
  const { getKansById, updateEigenaarRelatie } = useVastgoedkansen();
  const records = useKadasterDataRecordsForVastgoedkans(vastgoedkansId);
  const laatste = useMemo(() => laatsteRecordsPerProduct(records.data ?? []), [records.data]);
  const kadasterNaam = laatste.get('rechten')?.rechthebbende_naam?.trim() ?? '';
  const kans = getKansById(vastgoedkansId);
  const gekoppeld = relaties.find((r) => r.id === kans?.eigenaarRelatieId) ?? null;

  const [zoekterm, setZoekterm] = useState('');
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [bezigId, setBezigId] = useState<string | null>(null);

  const effectieveZoekterm = zoekterm.trim();
  const matches = useMemo(() => {
    const q = norm(effectieveZoekterm);
    if (!q) return [];
    return relaties
      .filter((r) => norm(r.bedrijfsnaam).includes(q) || norm(r.contactpersoon).includes(q))
      .sort((a, b) => getRelatieDropdownLabel(a).localeCompare(getRelatieDropdownLabel(b), 'nl', { sensitivity: 'base' }))
      .slice(0, 8);
  }, [effectieveZoekterm, relaties]);

  async function koppel(relatie: Relatie) {
    setBezigId(relatie.id);
    try {
      await updateEigenaarRelatie(vastgoedkansId, relatie.id);
      toast.success('CRM-relatie gekoppeld aan deze Vastgoedkans.');
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

  function gebruikKadasterNaam() {
    if (!kadasterNaam) return;
    setZoekterm(kadasterNaam);
  }

  return (
    <div id="vastgoedkans-relatiekoppeling" className="scroll-mt-24 rounded-md border bg-muted/10 p-3 sm:p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <h3 className="font-medium">CRM-relatie eigenaar</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Koppel bewust een bestaande CRM-relatie of maak er expliciet één aan. Een Kadasternaam is alleen een zoeksuggestie en wordt nooit automatisch gekoppeld of aangemaakt.
          </p>
        </div>
        {gekoppeld && <Badge variant="outline">Gekoppeld</Badge>}
      </div>

      {gekoppeld ? (
        <div className="rounded-md border bg-background p-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gekoppelde relatie</p>
            <p className="mt-1 truncate text-sm font-medium">{getRelatieDropdownLabel(gekoppeld)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground capitalize">{gekoppeld.type}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><a href={`/relaties/${gekoppeld.id}`}>Open relatie</a></Button>
            <Button size="sm" variant="outline" disabled={bezigId === 'ontkoppelen'} onClick={ontkoppel}>
              <Unlink className="mr-1.5 h-3.5 w-3.5" />Ontkoppelen
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-dashed bg-background p-3 text-sm text-muted-foreground">Nog geen CRM-relatie gekoppeld.</div>
      )}

      {kadasterNaam && (
        <div className="rounded-md border bg-background p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Naam uit opgeslagen Kadasterrecord</p>
            <p className="mt-1 truncate text-sm">{kadasterNaam}</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={gebruikKadasterNaam}>Gebruik als zoekterm</Button>
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek bestaande relatie op naam of bedrijf…"
            className="pl-9 bg-background"
          />
        </div>

        {effectieveZoekterm && (
          <div className="rounded-md border bg-background divide-y">
            {matches.length > 0 ? matches.map((relatie) => (
              <div key={relatie.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{getRelatieDropdownLabel(relatie)}</p>
                  <p className="text-xs text-muted-foreground capitalize">{relatie.type}</p>
                </div>
                <Button size="sm" disabled={bezigId === relatie.id || gekoppeld?.id === relatie.id} onClick={() => koppel(relatie)}>
                  {gekoppeld?.id === relatie.id ? 'Gekoppeld' : 'Koppel'}
                </Button>
              </div>
            )) : (
              <p className="p-3 text-sm text-muted-foreground">Geen bestaande relatie gevonden.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setNieuwOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />Nieuwe relatie aanmaken
        </Button>
      </div>

      <QuickCreateRelationDialog
        open={nieuwOpen}
        onOpenChange={setNieuwOpen}
        context="verkoper"
        defaultValues={{ naam: kadasterNaam || effectieveZoekterm, type: 'eigenaar' }}
        onCreated={async (relatie) => {
          await koppel(relatie);
        }}
      />
    </div>
  );
}
