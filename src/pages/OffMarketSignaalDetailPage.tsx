import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  BadgeCheck, FileText, Search, Landmark, Mail, CheckSquare, Server,
  UserSearch, MoreHorizontal,
} from 'lucide-react';

import SignaalDetailHeader from '@/components/offmarket/SignaalDetailHeader';
import SignaalKpiBar from '@/components/offmarket/SignaalKpiBar';
import SignaalCockpit from '@/components/offmarket/SignaalCockpit';
import SignaalGebiedsindeling from '@/components/offmarket/SignaalGebiedsindeling';
import SignaalMobileGebiedsindeling from '@/components/offmarket/mobile/SignaalMobileGebiedsindeling';
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

// Mobiel
import SignaalMobileHeader from '@/components/offmarket/mobile/SignaalMobileHeader';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import SignaalMobileBronregel from '@/components/offmarket/mobile/SignaalMobileBronregel';
import SignaalMobileEigenaarWorkflow from '@/components/offmarket/mobile/SignaalMobileEigenaarWorkflow';
import ClassificatieReadonlyCard from '@/components/offmarket/mobile/ClassificatieReadonlyCard';
import MeerOnderzoeksactiesDisclosure from '@/components/offmarket/mobile/MeerOnderzoeksactiesDisclosure';

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

const DESKTOP_TABS: { value: string; label: string; Icon: any }[] = [
  { value: 'overzicht', label: 'Overzicht', Icon: BadgeCheck },
  { value: 'onderzoek', label: 'Onderzoek', Icon: Search },
  { value: 'kadaster', label: 'Kadaster & eigenaar', Icon: Landmark },
  { value: 'brieven', label: 'Brieven & opvolging', Icon: Mail },
  { value: 'taken', label: 'Taken & tijdlijn', Icon: CheckSquare },
  { value: 'technisch', label: 'Technisch', Icon: Server },
];

const MOBILE_TABS: { value: string; label: string; Icon: any }[] = [
  { value: 'overzicht', label: 'Overzicht', Icon: BadgeCheck },
  { value: 'onderzoek', label: 'Onderzoek', Icon: Search },
  { value: 'eigenaar', label: 'Eigenaar', Icon: UserSearch },
  { value: 'opvolging', label: 'Opvolging', Icon: Mail },
  { value: 'meer', label: 'Meer', Icon: MoreHorizontal },
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
  const [desktopTab, setDesktopTab] = useState<string>('overzicht');
  const [mobileTab, setMobileTab] = useState<string>('overzicht');
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
    <div className="space-y-4 lg:space-y-5 px-4 sm:px-6 pb-4 sm:pb-6 pt-0 md:pt-6 max-w-7xl">
      {/* === Mobiel: sticky nav (Terug / vorige / teller / volgende) === */}
      <div className="lg:hidden -mx-4 sm:-mx-6 sticky top-0 z-30 glass-topbar border-b border-border/60">
        <div className="flex items-center gap-1 px-2 py-1">
          <button type="button" onClick={() => navigate('/off-market')}
            className="inline-flex items-center gap-1 px-2 h-10 text-xs text-foreground hover:bg-muted rounded-md">
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <button type="button" onClick={() => navInfo.prevId && navigate(`/off-market/${navInfo.prevId}`)}
            disabled={!navInfo.prevId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Vorige signaal">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
            {navInfo.index >= 0 ? `${navInfo.index + 1} / ${navInfo.total}` : `— / ${navInfo.total}`}
          </span>
          <button type="button" onClick={() => navInfo.nextId && navigate(`/off-market/${navInfo.nextId}`)}
            disabled={!navInfo.nextId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Volgende signaal">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* === Desktop nav === */}
      <div className="hidden lg:flex items-center justify-end">
        <ListNavigator info={navInfo} buildHref={(nid) => `/off-market/${nid}`} itemLabel="signaal" />
      </div>

      {/* === Desktop: ongewijzigd === */}
      <div className="hidden lg:block space-y-5">
        <SignaalDetailHeader
          signaal={signaal}
          onEdit={() => setEditOpen(true)}
          onArchive={() => setArchiveOpen(true)}
        />

        <SignaalKpiBar signaal={signaal} taken={taken} briefStatus={briefStatus} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="min-w-0">
            <Tabs value={desktopTab} onValueChange={setDesktopTab}>
              <TabsList className="flex w-full justify-start overflow-x-auto h-auto p-1">
                {DESKTOP_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">
                    <t.Icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

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

          <div>
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
      </div>

      {/* === Mobiel: compacte dossier-UX === */}
      <div className="lg:hidden space-y-3" data-testid="off-market-mobile-shell">
        <SignaalMobileHeader
          signaal={signaal}
          onEdit={() => setEditOpen(true)}
          onArchive={() => setArchiveOpen(true)}
        />
        <SignaalMobileCockpit signaal={signaal} taken={taken} briefStatus={briefStatus} />
        <SignaalMobileActionBar signaal={signaal} />

        <Tabs value={mobileTab} onValueChange={setMobileTab} className="pt-1">
          <div className="glass-mobile-tabbar px-1 py-1">
            <TabsList
              data-testid="signaal-mobile-tabs"
              className="tabs-scroll bg-transparent p-0 h-auto rounded-none gap-0.5"
            >
              {MOBILE_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="mobile-tab-pill data-[state=active]:!shadow-none"
                >
                  <t.Icon className="h-3.5 w-3.5 mr-1" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>


          <TabsContent value="overzicht" className="space-y-3 mt-3">
            <SignaalSnelleActiesBar signaal={signaal} />
            <SignaalAiAnalyse signaal={signaal} />
            <ClassificatieReadonlyCard
              signaal={signaal}
              onWijzig={() => setEditOpen(true)}
            />
            <SignaalDossierNotities signaal={signaal} />
          </TabsContent>

          <TabsContent value="onderzoek" className="space-y-3 mt-3">
            <SignaalGebiedsindeling signaal={signaal} />
            <SignaalMobileBronregel signaal={signaal} />
            <MeerOnderzoeksactiesDisclosure signaal={signaal} />
          </TabsContent>

          <TabsContent value="eigenaar" className="space-y-3 mt-3">
            <SignaalMobileEigenaarWorkflow signaal={signaal} />
          </TabsContent>

          <TabsContent value="opvolging" className="space-y-3 mt-3">
            <SignaalBrievenSectie signaal={signaal} />
            <SignaalTakenSectie signaalId={signaal.id} />
            <SignaalTijdlijnSectie signaalId={signaal.id} />
          </TabsContent>

          <TabsContent value="meer" className="space-y-3 mt-3">
            <SignaalTechnischeDetails signaal={signaal} />
          </TabsContent>
        </Tabs>
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
