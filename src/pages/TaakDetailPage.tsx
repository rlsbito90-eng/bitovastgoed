// Taakdetail-scherm. Eigen route /taken/:id, met:
// - alle taakvelden (titel, type, prioriteit, status, deadline, notities)
// - gekoppelde relatie/object/deal/signaal met snelle openen-knoppen
// - acties: Bewerken, Voltooien/Heropenen, Verwijderen
// - terug naar /taken
//
// Bewust geen schemawijziging: 'voltooid' = status 'afgerond'.
import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Pencil, Trash2, CheckCircle2, RotateCcw, ExternalLink,
  Clock, Calendar, Briefcase, Building2, User, Radar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PrioriteitBadge, TaakStatusBadge } from '@/components/StatusBadges';
import { useDataStore } from '@/hooks/useDataStore';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import TaakAfrondenDialog from '@/components/forms/TaakAfrondenDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deadlineLabel, isTaakTeLaat } from '@/lib/taakHelpers';
import { getRelatieNaamCompact } from '@/lib/relatieNaam';
import { useOffMarketSignaal } from '@/hooks/useOffMarketSignalen';

export default function TaakDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    taken, getRelatieById, getDealById, getObjectById, updateTaak, deleteTaak, contactpersonen,
  } = useDataStore();

  const taak = useMemo(() => taken.find((t) => t.id === id) ?? null, [taken, id]);

  const [editOpen, setEditOpen] = useState(false);
  const [afrondenOpen, setAfrondenOpen] = useState(false);
  const [verwijderOpen, setVerwijderOpen] = useState(false);

  const signaal = useOffMarketSignaal(taak?.offMarketSignaalId ?? undefined).data;

  if (!taak) {
    return (
      <div className="page-shell space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/taken')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Terug naar taken
        </Button>
        <div className="section-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Taak niet gevonden.</p>
        </div>
      </div>
    );
  }

  const rel = taak.relatieId ? getRelatieById(taak.relatieId) : null;
  const deal = taak.dealId ? getDealById(taak.dealId) : null;
  const obj = taak.objectId ? getObjectById(taak.objectId) : (deal ? getObjectById(deal.objectId) : null);

  const isAfgerond = taak.status === 'afgerond';
  const teLaat = isTaakTeLaat(taak, new Date());

  const heropen = async () => {
    try {
      await updateTaak(taak.id, { status: 'open' });
      toast.success('Taak heropend');
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  };

  const verwijder = async () => {
    try {
      await deleteTaak(taak.id);
      toast.success('Taak verwijderd');
      navigate('/taken');
    } catch (e: any) {
      toast.error(e?.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div className="page-shell space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Terug
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          {!isAfgerond ? (
            <Button size="sm" onClick={() => setAfrondenOpen(true)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Voltooien
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={heropen}>
              <RotateCcw className="h-4 w-4 mr-1.5" /> Heropenen
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" /> Bewerken
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10"
            onClick={() => setVerwijderOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Verwijderen
          </Button>
        </div>
      </div>

      <section className="section-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h1 className={`text-lg sm:text-xl font-semibold leading-snug ${isAfgerond ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {taak.titel}
          </h1>
          <div className="flex items-center gap-1.5">
            <PrioriteitBadge prioriteit={taak.prioriteit} />
            <TaakStatusBadge status={taak.status} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className={teLaat ? 'text-destructive font-medium' : ''}>
              {taak.deadline ? deadlineLabel(taak, new Date()) : 'Zonder datum'}
              {teLaat ? ' · te laat' : ''}
            </span>
          </span>
          {taak.deadlineTijd && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />{taak.deadlineTijd.slice(0, 5)}
            </span>
          )}
          <span>Type: {taak.type}</span>
        </div>
      </section>

      {taak.notities && (
        <section className="section-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Notities & context</h2>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{taak.notities}</p>
        </section>
      )}

      <section className="section-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Koppelingen</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <KoppelingRow
            icon={<User className="h-4 w-4" />}
            label="Relatie"
            naam={rel ? getRelatieNaamCompact(rel, contactpersonen) : null}
            href={rel ? `/relaties/${rel.id}` : null}
          />
          <KoppelingRow
            icon={<Building2 className="h-4 w-4" />}
            label="Object"
            naam={obj?.titel ?? obj?.adres ?? null}
            href={obj ? `/objecten/${obj.id}` : null}
          />
          <KoppelingRow
            icon={<Briefcase className="h-4 w-4" />}
            label="Deal"
            naam={deal ? (getObjectById(deal.objectId)?.titel ?? 'Deal') : null}
            href={deal ? `/deals/${deal.id}` : null}
          />
          <KoppelingRow
            icon={<Radar className="h-4 w-4" />}
            label="Off Market signaal"
            naam={signaal ? (signaal.titel || signaal.adres || 'Signaal') : (taak.offMarketSignaalId ? '—' : null)}
            href={taak.offMarketSignaalId ? `/off-market/${taak.offMarketSignaalId}` : null}
          />
        </div>
      </section>

      <TaakFormDialog open={editOpen} onOpenChange={setEditOpen} taak={taak} />
      <TaakAfrondenDialog
        open={afrondenOpen}
        onOpenChange={setAfrondenOpen}
        taak={afrondenOpen ? taak : null}
      />
      <AlertDialog open={verwijderOpen} onOpenChange={setVerwijderOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={verwijder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KoppelingRow({
  icon, label, naam, href,
}: { icon: React.ReactNode; label: string; naam: string | null; href: string | null }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2.5 flex items-center justify-between gap-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground truncate">{naam ?? <span className="text-muted-foreground">—</span>}</p>
        </div>
      </div>
      {href && naam ? (
        <Link
          to={href}
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline shrink-0"
        >
          Open <ExternalLink className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}
