import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Building2, ExternalLink } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import { useDataStore } from '@/hooks/useDataStore';
import { targetTitel } from '@/lib/acquisitie';
import AcquisitieStatusBadge from '@/components/acquisitie/AcquisitieStatusBadge';
import AcquisitieTargetFormDialog from '@/components/forms/AcquisitieTargetFormDialog';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { toast } from 'sonner';

export default function AcquisitieTargetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { targets, campagnes, deleteTarget, converteerNaarObject } = useAcquisitie();
  const { getRelatieById, contactpersonen } = useDataStore();
  const [editOpen, setEditOpen] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const target = targets.find(t => t.id === id);
  if (!target) {
    return (
      <div className="px-6 py-10">
        <Link to="/acquisitie" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Terug naar acquisitie
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">Target niet gevonden.</p>
      </div>
    );
  }

  const relatie = target.relatieId ? getRelatieById(target.relatieId) : null;
  const campagne = target.campagneId ? campagnes.find(c => c.id === target.campagneId) : null;

  const maakObject = async () => {
    if (bezig) return;
    setBezig(true);
    try {
      const { objectId } = await converteerNaarObject(target.id);
      toast.success('Object aangemaakt vanuit target.');
      navigate(`/objecten/${objectId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Conversie mislukt.');
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async () => {
    try {
      await deleteTarget(target.id);
      toast.success('Target verwijderd.');
      navigate('/acquisitie');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt.');
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <Link to="/acquisitie" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Terug naar acquisitie
      </Link>

      <PageHeader
        title={targetTitel(target)}
        subtitle={<div className="flex gap-2 items-center flex-wrap"><AcquisitieStatusBadge status={target.status} /><span>Prio P{target.prioriteit}</span></div>}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1.5" /> Bewerken</Button>
            {target.status !== 'object_aangemaakt' ? (
              <Button onClick={maakObject} disabled={bezig}><Building2 className="h-4 w-4 mr-1.5" /> Maak Object</Button>
            ) : target.objectId ? (
              <Button variant="outline" asChild>
                <Link to={`/objecten/${target.objectId}`}><ExternalLink className="h-4 w-4 mr-1.5" /> Naar object</Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" onClick={() => setVerwijderOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="section-card p-5 space-y-3">
          <h2 className="section-title">Adres</h2>
          <Veld label="Adres" value={target.adres} />
          <Veld label="Postcode / plaats" value={[target.postcode, target.plaats].filter(Boolean).join(' · ') || null} />
          <Veld label="Wijk / buurt" value={target.wijk} />
          <Veld label="Type vastgoed" value={target.typeVastgoed} />
          <Veld label="Bron" value={target.bron} />
        </section>

        <section className="section-card p-5 space-y-3">
          <h2 className="section-title">Eigenaar & relatie</h2>
          <Veld label="Eigenaar bekend" value={target.eigenaarBekend} />
          <Veld label="Eigenaar woont op adres" value={target.eigenaarWoontOpAdres} />
          <Veld label="Relatie" value={relatie ? getRelatieNaamCompact(relatie, contactpersonen) : null}
            href={relatie ? `/relaties/${relatie.id}` : undefined} />
          <Veld label="Campagne" value={campagne?.naam ?? null}
            href={campagne ? `/acquisitie/campagnes/${campagne.id}` : undefined} />
        </section>

        <section className="section-card p-5 space-y-3 lg:col-span-2">
          <h2 className="section-title">Opvolging</h2>
          <Veld label="Reden interessant" value={target.redenInteressant} />
          <Veld label="Laatste actie" value={target.laatsteActieDatum ? new Date(target.laatsteActieDatum).toLocaleDateString('nl-NL') : null} />
          <Veld label="Volgende actie" value={
            target.volgendeActieDatum
              ? `${new Date(target.volgendeActieDatum).toLocaleDateString('nl-NL')}${target.volgendeActieOmschrijving ? ' — ' + target.volgendeActieOmschrijving : ''}`
              : target.volgendeActieOmschrijving || null
          } />
          <Veld label="Notities" value={target.notities} multiline />
        </section>
      </div>

      <AcquisitieTargetFormDialog open={editOpen} onOpenChange={setEditOpen} target={target} />

      <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Target verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Deze actie kan niet ongedaan gemaakt worden.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={verwijder}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Veld({ label, value, href, multiline }: { label: string; value: string | null; href?: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      {value ? (
        href ? (
          <Link to={href} className="text-sm text-accent hover:underline">{value}</Link>
        ) : (
          <p className={`text-sm text-foreground ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
        )
      ) : (
        <p className="text-sm text-muted-foreground/70">—</p>
      )}
    </div>
  );
}
