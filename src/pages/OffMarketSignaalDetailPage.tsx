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
import ListNavigator from '@/components/ListNavigator';
import { getListNavigation } from '@/lib/listNavigation';
import {
  useOffMarketSignaal, useArchiveOffMarketSignaal, useOffMarketSignalen,
} from '@/hooks/useOffMarketSignalen';
import { Button } from '@/components/ui/button';

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

  return (
    <div className="space-y-5 px-4 sm:px-6 py-4 sm:py-6 max-w-5xl">
      <div className="flex items-center justify-end">
        <ListNavigator
          info={getListNavigation('off-market-signalen', signaal.id, alleSignalen.map(s => s.id))}
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
      <SignaalKoppelingenSectie signaal={signaal} />
      <SignaalTakenSectie signaalId={signaal.id} />
      <SignaalTijdlijnSectie signaalId={signaal.id} />

      <SignaalFormDialog open={editOpen} onOpenChange={setEditOpen} signaal={signaal} />
      <OffMarketArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} onConfirm={handleArchive} />
    </div>
  );
}
