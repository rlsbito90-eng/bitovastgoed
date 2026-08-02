import { useMemo, useState } from 'react';
import { Building2, ExternalLink, Link2, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import type { AcquisitieTarget } from '@/lib/acquisitie';
import { vindAcquisitieObjectKandidaten } from '@/lib/acquisitieObjectKoppeling';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: AcquisitieTarget;
}

export default function AcquisitieObjectPreflightDialog({ open, onOpenChange, target }: Props) {
  const navigate = useNavigate();
  const { objecten } = useDataStore();
  const { updateTarget, converteerNaarObject } = useAcquisitie();
  const [bezig, setBezig] = useState(false);

  const kandidaten = useMemo(
    () => vindAcquisitieObjectKandidaten(target, objecten ?? []),
    [target, objecten],
  );

  const openObject = (objectId: string) => {
    onOpenChange(false);
    navigate(`/objecten/${objectId}`);
  };

  const koppelBestaand = async (objectId: string) => {
    if (bezig) return;
    setBezig(true);
    try {
      await updateTarget(target.id, { objectId, status: 'object_aangemaakt' });
      toast.success('Acquisitietarget gekoppeld aan bestaand Object.');
      onOpenChange(false);
      navigate(`/objecten/${objectId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Koppelen mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const maakNieuw = async () => {
    if (bezig) return;
    setBezig(true);
    try {
      const { objectId } = await converteerNaarObject(target.id);
      toast.success('Nieuw Object aangemaakt vanuit acquisitietarget.');
      onOpenChange(false);
      navigate(`/objecten/${objectId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Object aanmaken mislukt.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Controleer eerst bestaande Objecten</DialogTitle>
          <DialogDescription>
            De koppeling wordt alleen uitgevoerd na jouw keuze. Er wordt niets automatisch samengevoegd of overschreven.
          </DialogDescription>
        </DialogHeader>

        {kandidaten.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p>Er {kandidaten.length === 1 ? 'is' : 'zijn'} {kandidaten.length} mogelijke bestaande {kandidaten.length === 1 ? 'match' : 'matches'} gevonden.</p>
            </div>
            {kandidaten.map(kandidaat => {
              const object = kandidaat.object;
              const locatie = [object.adres, object.postcode, object.plaats].filter(Boolean).join(', ');
              return (
                <div key={object.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{object.titel || locatie || 'Object'}</p>
                      {object.crmObjectnummer && <p className="mt-0.5 text-xs font-mono-data text-muted-foreground">{object.crmObjectnummer}</p>}
                      {locatie && <p className="mt-1 text-xs text-muted-foreground">{locatie}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground">{kandidaat.redenLabel} · zekerheid {kandidaat.score}%</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button type="button" size="sm" variant="ghost" onClick={() => openObject(object.id)} disabled={bezig}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" size="sm" onClick={() => koppelBestaand(object.id)} disabled={bezig}>
                        <Link2 className="mr-1.5 h-3.5 w-3.5" /> Koppelen
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Geen sterke bestaande Objectmatch gevonden. Je kunt gecontroleerd een nieuw Object aanmaken.</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={bezig}>Annuleren</Button>
          <Button type="button" variant={kandidaten.length > 0 ? 'outline' : 'default'} onClick={maakNieuw} disabled={bezig}>
            <Building2 className="mr-1.5 h-4 w-4" />
            {kandidaten.length > 0 ? 'Toch nieuw Object' : 'Nieuw Object aanmaken'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
