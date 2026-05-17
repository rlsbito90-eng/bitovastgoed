import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAcquisitie } from '@/hooks/useAcquisitie';
import {
  CAMPAGNE_KANAAL_LABEL, CAMPAGNE_STATUS_LABEL, targetTitel,
} from '@/lib/acquisitie';
import AcquisitieStatusBadge from '@/components/acquisitie/AcquisitieStatusBadge';
import AcquisitieCampagneFormDialog from '@/components/forms/AcquisitieCampagneFormDialog';
import AcquisitieTargetFormDialog from '@/components/forms/AcquisitieTargetFormDialog';
import { toast } from 'sonner';
import ListNavigator from '@/components/ListNavigator';
import { getListNavigation } from '@/lib/listNavigation';

export default function AcquisitieCampagneDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campagnes, targets, deleteCampagne } = useAcquisitie();
  const [editOpen, setEditOpen] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const campagne = campagnes.find(c => c.id === id);
  const gekoppeld = useMemo(() => targets.filter(t => t.campagneId === id), [targets, id]);
  const stats = useMemo(() => ({
    total: gekoppeld.length,
    reacties: gekoppeld.filter(t => t.status === 'reactie_ontvangen').length,
    warm: gekoppeld.filter(t => t.status === 'verkoopbereidheid_peilen' || t.status === 'potentiele_verkooppositie').length,
    objecten: gekoppeld.filter(t => t.status === 'object_aangemaakt').length,
  }), [gekoppeld]);

  if (!campagne) {
    return (
      <div className="px-6 py-10">
        <Link to="/acquisitie" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Terug
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">Campagne niet gevonden.</p>
      </div>
    );
  }

  const verwijder = async () => {
    try {
      await deleteCampagne(campagne.id);
      toast.success('Campagne verwijderd.');
      navigate('/acquisitie');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt.');
    }
  };

  return (
    <div className="page-shell-detail">
      <Link to="/acquisitie" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Terug naar acquisitie
      </Link>

      <PageHeader
        title={campagne.naam}
        subtitle={`${CAMPAGNE_KANAAL_LABEL[campagne.kanaal]} · ${CAMPAGNE_STATUS_LABEL[campagne.status]}${campagne.gebied ? ' · ' + campagne.gebied : ''}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-1.5" /> Bewerken</Button>
            <Button onClick={() => setTargetOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> Target toevoegen</Button>
            <Button variant="ghost" size="icon" onClick={() => setVerwijderOpen(true)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Targets" value={stats.total} />
        <Stat label="Reacties" value={stats.reacties} />
        <Stat label="Warme leads" value={stats.warm} />
        <Stat label="Objecten" value={stats.objecten} />
      </div>

      {campagne.notities && (
        <section className="section-card p-5">
          <h2 className="section-title mb-2">Notities</h2>
          <p className="text-sm whitespace-pre-wrap text-foreground">{campagne.notities}</p>
        </section>
      )}

      <section className="section-card overflow-hidden">
        <header className="section-header"><h2 className="section-title">Gekoppelde targets ({gekoppeld.length})</h2></header>
        {gekoppeld.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground">Nog geen targets aan deze campagne gekoppeld.</p>
        ) : (
          <div className="divide-y divide-border/70">
            {gekoppeld.map(t => (
              <Link key={t.id} to={`/acquisitie/targets/${t.id}`} className="block px-5 py-3 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{targetTitel(t)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.typeVastgoed ?? '—'} · P{t.prioriteit}</p>
                  </div>
                  <AcquisitieStatusBadge status={t.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <AcquisitieCampagneFormDialog open={editOpen} onOpenChange={setEditOpen} campagne={campagne} />
      <AcquisitieTargetFormDialog open={targetOpen} onOpenChange={setTargetOpen} defaultCampagneId={campagne.id} />

      <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Campagne verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>Gekoppelde targets blijven bestaan, maar verliezen hun campagne-link.</AlertDialogDescription>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="section-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold font-mono-data mt-1">{value}</p>
    </div>
  );
}
