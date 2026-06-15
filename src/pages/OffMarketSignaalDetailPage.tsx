import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ChevronLeft, ChevronRight, BadgeCheck, FileText, Search, Landmark, Mail, CheckSquare, Server } from 'lucide-react';

import SignaalDetailHeader from '@/components/offmarket/SignaalDetailHeader';
import SignaalKpiBar from '@/components/offmarket/SignaalKpiBar';
import SignaalCockpit from '@/components/offmarket/SignaalCockpit';
import SignaalGebiedsindeling from '@/components/offmarket/SignaalGebiedsindeling';
import SignaalOnderzoeksacties from '@/components/offmarket/SignaalOnderzoeksacties';
import SignaalClassificatieBlok from '@/components/offmarket/SignaalClassificatieBlok';
import SignaalDossierNotities from '@/components/offmarket/SignaalDossierNotities';
import SignaalBrievenSectie from '@/components/offmarket/SignaalBrievenSectie';
import SignaalTechnischeDetails from '@/components/offmarket/SignaalTechnischeDetails';
import SignaalFormDialog from '@/components/offmarket/SignaalFormDialog';
import OffMarketArchiveDialog from '@/components/offmarket/OffMarketArchiveDialog';
import SignaalKoppelingenSectie from '@/components/offmarket/SignaalKoppelingenSectie';
import SignaalTakenSectie from '@/components/offmarket/SignaalTakenSectie';
import SignaalTijdlijnSectie from '@/components/offmarket/SignaalTijdlijnSectie';
import SignaalAiAnalyse from '@/components/offmarket/SignaalAiAnalyse';
import SignaalSnelleActiesBar from '@/components/offmarket/SignaalSnelleActiesBar';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import SignaalKadasterKaart from '@/components/offmarket/kadaster/SignaalKadasterKaart';
import TaakFormDialog from '@/components/forms/TaakFormDialog';
import ListNavigator from '@/components/ListNavigator';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { getListNavigation, updateListLastViewedId } from '@/lib/listNavigation';
import {
  useOffMarketSignaal, useArchiveOffMarketSignaal, useOffMarketSignalen,
} from '@/hooks/useOffMarketSignalen';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { bepaalBriefStatus } from '@/lib/offMarket/briefStatus';
import { bouwSignaalTaakContext } from '@/lib/offMarket/eigenaar';

const TABS: { value: string; label: string; Icon: any }[] = [
  { value: 'overzicht', label: 'Overzicht', Icon: BadgeCheck },
  { value: 'onderzoek', label: 'Onderzoek', Icon: Search },
  { value: 'kadaster', label: 'Kadaster & eigenaar', Icon: Landmark },
  { value: 'brieven', label: 'Brieven & opvolging', Icon: Mail },
  { value: 'taken', label: 'Taken & tijdlijn', Icon: CheckSquare },
  { value: 'technisch', label: 'Technisch', Icon: Server },
];

export default function OffMarketSignaalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: signaal, isLoading, error } = useOffMarketSignaal(id);
  const { data: alleSignalen = [] } = useOffMarketSignalen();
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(id);
  const { taken } = useDataStore();
  const archive = useArchiveOffMarketSignaal();

  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [tab, setTab] = useState<string>('overzicht');
  const [taakOpen, setTaakOpen] = useState(false);

  useEffect(() => {
    if (signaal?.id) updateListLastViewedId('off-market-signalen', signaal.id);
  }, [signaal?.id]);

  const briefStatus = useMemo(
    () => signaal ? bepaalBriefStatus(brieven, taken, signaal.id) : 'geen',
    [brieven, taken, signaal],
  );

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

  const navInfo = getListNavigation('off-market-signalen', signaal.id, alleSignalen.map((s) => s.id));

  return (
    <div className="space-y-5 px-4 sm:px-6 pb-4 sm:pb-6 pt-0 md:pt-6 max-w-7xl">
      {/* Mobiele sticky terug + nav */}
      <div className="md:hidden -mx-4 sm:-mx-6 sticky top-0 z-30 glass-topbar border-b border-border/60">
        <div className="flex items-center gap-1 px-2 py-1">
          <button type="button" onClick={() => navigate('/off-market')}
            className="inline-flex items-center gap-1 px-2 h-10 text-xs text-foreground hover:bg-muted rounded-md">
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <button type="button" onClick={() => navInfo.prevId && navigate(`/off-market/${navInfo.prevId}`)}
            disabled={!navInfo.prevId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
            {navInfo.index >= 0 ? `${navInfo.index + 1} / ${navInfo.total}` : `— / ${navInfo.total}`}
          </span>
          <button type="button" onClick={() => navInfo.nextId && navigate(`/off-market/${navInfo.nextId}`)}
            disabled={!navInfo.nextId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-end">
        <ListNavigator info={navInfo} buildHref={(nid) => `/off-market/${nid}`} itemLabel="signaal" />
      </div>

      <SignaalDetailHeader
        signaal={signaal}
        onEdit={() => setEditOpen(true)}
        onArchive={() => setArchiveOpen(true)}
      />

      <SignaalKpiBar signaal={signaal} taken={taken} briefStatus={briefStatus} />

      {/* Mobiele cockpit-kaart bovenaan (verkort), desktop heeft sticky aside */}
      <div className="lg:hidden">
        <SignaalCockpit
          signaal={signaal}
          taken={taken}
          briefStatus={briefStatus}
          onBewerken={() => setEditOpen(true)}
          onTaakAanmaken={() => setTaakOpen(true)}
        />
      </div>

      {/* Mobiel: directe onderzoeksacties direct na de cockpit/KPI's */}
      <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6">
        <SignaalOnderzoeksacties signaal={signaal} variant="compact" withHeader={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* Hoofdkolom met tabs */}
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab}>
            {/* Desktop tablist */}
            <TabsList className="hidden sm:flex w-full justify-start overflow-x-auto h-auto p-1">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">
                  <t.Icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {/* Mobiele tab-select */}
            <div className="sm:hidden">
              <Select value={tab} onValueChange={setTab}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TABS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="overzicht" className="space-y-5 mt-4">
              <SignaalSnelleActiesBar signaal={signaal} />
              <SignaalAiAnalyse signaal={signaal} />
              <SignaalClassificatieBlok signaal={signaal} onOpenFullForm={() => setEditOpen(true)} />
              <SignaalOnderzoeksacties signaal={signaal} />
              <SignaalBrievenSectie signaal={signaal} />
              <SignaalDossierNotities signaal={signaal} />
            </TabsContent>

            <TabsContent value="onderzoek" className="space-y-5 mt-4">
              <SignaalOnderzoeksacties signaal={signaal} />
              <SignaalGebiedsindeling signaal={signaal} />
              <SignaalKadasterKaart signaal={signaal} />
            </TabsContent>

            <TabsContent value="kadaster" className="space-y-5 mt-4">
              <SignaalKadasterKaart signaal={signaal} />
              <SignaalEigenaarsonderzoekSectie signaal={signaal} />
              <SignaalKoppelingenSectie signaal={signaal} />
            </TabsContent>

            <TabsContent value="brieven" className="space-y-5 mt-4">
              <SignaalBrievenSectie signaal={signaal} />
            </TabsContent>

            <TabsContent value="taken" className="space-y-5 mt-4">
              <SignaalTakenSectie signaalId={signaal.id} />
              <SignaalTijdlijnSectie signaalId={signaal.id} />
            </TabsContent>

            <TabsContent value="technisch" className="space-y-5 mt-4">
              <SignaalTechnischeDetails signaal={signaal} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Desktop cockpit sticky */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <SignaalCockpit
              signaal={signaal}
              taken={taken}
              briefStatus={briefStatus}
              onBewerken={() => setEditOpen(true)}
              onTaakAanmaken={() => setTaakOpen(true)}
            />
          </div>
        </div>
      </div>

      <SignaalFormDialog open={editOpen} onOpenChange={setEditOpen} signaal={signaal} />
      <OffMarketArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} onConfirm={handleArchive} />
      <TaakFormDialog
        open={taakOpen}
        onOpenChange={setTaakOpen}
        taak={null}
        defaultOffMarketSignaalId={signaal.id}
        defaultNotities={bouwSignaalTaakContext(signaal, 'taak vanuit signaal')}
      />
    </div>
  );
}
