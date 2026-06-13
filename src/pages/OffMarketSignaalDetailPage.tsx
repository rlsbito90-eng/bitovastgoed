import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SignaalDetailHeader from '@/components/offmarket/SignaalDetailHeader';
import SignaalKerngegevens from '@/components/offmarket/SignaalKerngegevens';
import SignaalFormDialog from '@/components/offmarket/SignaalFormDialog';
import OffMarketArchiveDialog from '@/components/offmarket/OffMarketArchiveDialog';
import SignaalKoppelingenSectie from '@/components/offmarket/SignaalKoppelingenSectie';
import SignaalTakenSectie from '@/components/offmarket/SignaalTakenSectie';
import SignaalTijdlijnSectie from '@/components/offmarket/SignaalTijdlijnSectie';
import SignaalAiAnalyse from '@/components/offmarket/SignaalAiAnalyse';
import SignaalSnelleActiesBar from '@/components/offmarket/SignaalSnelleActiesBar';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import SignaalKadasterKaart from '@/components/offmarket/kadaster/SignaalKadasterKaart';
import ListNavigator from '@/components/ListNavigator';
import { getListNavigation } from '@/lib/listNavigation';
import {
  useOffMarketSignaal, useArchiveOffMarketSignaal, useOffMarketSignalen,
} from '@/hooks/useOffMarketSignalen';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

export default function OffMarketSignaalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: signaal, isLoading, error } = useOffMarketSignaal(id);
  const { data: alleSignalen = [] } = useOffMarketSignalen();
  const archive = useArchiveOffMarketSignaal();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  if (isLoading) {
    return <div className="px-4 sm:px-6 py-6"><p className="text-sm text-muted-foreground">Signaal laden…</p></div>;
  }
  if (error || !signaal) {
    return (
      <div className="px-4 sm:px-6 py-6 space-y-3">
        <p className="text-sm text-destructive">Signaal niet gevonden.</p>
        <Button variant="outline" onClick={() => navigate('/off-market')}>Terug naar overzicht</Button>
      </div>
    );
  }

  const handleArchive = async (reden: string) => {
    try {
      await archive.mutateAsync({ id: signaal.id, reden });
      toast.success('Signaal gearchiveerd.');
      navigate('/off-market');
    } catch (e: any) {
      toast.error(e?.message ?? 'Archiveren mislukt.');
    }
  };

  const navInfo = getListNavigation('off-market-signalen', signaal.id, alleSignalen.map(s => s.id));

  return (
    <div className="space-y-5 px-4 sm:px-6 py-4 sm:py-6 max-w-5xl">
      {/* Mobiele sticky navigatie — sluit strak aan op de mobiele app-header.
          Negatieve marges compenseren de page-shell padding (py-4/px-4 en
          sm:py-6/sm:px-6) zodat er geen visueel gat ontstaat. De app-header
          handelt safe-area zelf af, dus hier geen dubbele compensatie. */}
      <div
        className="md:hidden -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 sticky z-30 glass-topbar border-b border-border/60"
        style={{ top: 'var(--mobile-header-height, 3.5rem)' }}
      >
        <div className="flex items-center gap-1 px-2 py-1">
          <button
            type="button"
            onClick={() => navigate('/off-market')}
            className="inline-flex items-center gap-1 px-2 h-10 text-xs text-foreground hover:bg-muted rounded-md"
            aria-label="Terug"
          >
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <button
            type="button"
            onClick={() => navInfo.prevId && navigate(`/off-market/${navInfo.prevId}`)}
            disabled={!navInfo.prevId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Vorige signaal"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
            {navInfo.index >= 0 ? `${navInfo.index + 1} / ${navInfo.total}` : `— / ${navInfo.total}`}
          </span>
          <button
            type="button"
            onClick={() => navInfo.nextId && navigate(`/off-market/${navInfo.nextId}`)}
            disabled={!navInfo.nextId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Volgende signaal"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>


      <div className="hidden md:flex items-center justify-end">
        <ListNavigator
          info={navInfo}
          buildHref={(nid) => `/off-market/${nid}`}
          itemLabel="signaal"
        />
      </div>
      <SignaalDetailHeader
        signaal={signaal}
        onEdit={() => setEditOpen(true)}
        onArchive={() => setArchiveOpen(true)}
      />
      <SignaalSnelleActiesBar signaal={signaal} />
      <SignaalAiAnalyse signaal={signaal} />
      <SignaalKerngegevens signaal={signaal} />
      <SignaalEigenaarsonderzoekSectie signaal={signaal} />
      <SignaalKadasterKaart signaal={signaal} />
      <SignaalKoppelingenSectie signaal={signaal} />
      <SignaalTakenSectie signaalId={signaal.id} />
      <SignaalTijdlijnSectie signaalId={signaal.id} />

      <SignaalFormDialog open={editOpen} onOpenChange={setEditOpen} signaal={signaal} />
      <OffMarketArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} onConfirm={handleArchive} />
    </div>
  );
}
