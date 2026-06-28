import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  BadgeCheck, Search, Landmark, Mail, CheckSquare, Server,
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
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import SignaalKadasterKaart from '@/components/offmarket/kadaster/SignaalKadasterKaart';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';

// Mobiel
import SignaalMobileHeader from '@/components/offmarket/mobile/SignaalMobileHeader';
import SignaalMobileCockpit from '@/components/offmarket/mobile/SignaalMobileCockpit';
import SignaalMobileActionBar from '@/components/offmarket/mobile/SignaalMobileActionBar';
import SignaalMobileBronregel from '@/components/offmarket/mobile/SignaalMobileBronregel';
import ClassificatieReadonlyCard from '@/components/offmarket/mobile/ClassificatieReadonlyCard';
import MobileTabbarScroller from '@/components/offmarket/mobile/MobileTabbarScroller';


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

// Mobiel: dezelfde 6 dossier-tabs als desktop, met korte labels voor smalle viewports.
const MOBILE_TABS: { value: string; label: string; Icon: any }[] = [
  { value: 'overzicht', label: 'Overzicht', Icon: BadgeCheck },
  { value: 'onderzoek', label: 'Onderzoek', Icon: Search },
  { value: 'kadaster', label: 'Kadaster', Icon: Landmark },
  { value: 'brieven', label: 'Brieven', Icon: Mail },
  { value: 'taken', label: 'Taken', Icon: CheckSquare },
  { value: 'technisch', label: 'Technisch', Icon: Server },
];

const VALID_TABS = new Set(['overzicht', 'onderzoek', 'kadaster', 'brieven', 'taken', 'technisch']);

export default function OffMarketSignaalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { data: signaal, isLoading, error } = useOffMarketSignaal(id);
  const { data: alleSignalen = [] } = useOffMarketSignalen();
  const { data: brieven = [] } = useOffMarketBrievenForSignaal(id);
  const { taken } = useDataStore();
  const archive = useArchiveOffMarketSignaal();

  // Initial tab uit query (?tab=brieven) — bv. vanuit Verwerk selectie /
  // Focusmodus die direct naar Brieven & opvolging willen springen.
  const initialTab = (() => {
    const t = searchParams.get('tab');
    return t && VALID_TABS.has(t) ? t : 'overzicht';
  })();
  const focusReturn = (location.state as {
    fromAcquisitieFocus?: boolean;
    focusIndex?: number;
    focusScopeIds?: string[] | null;
    selectedIds?: string[] | null;
  } | null) ?? null;
  const fromAcquisitieFocus = !!focusReturn?.fromAcquisitieFocus;
  const focusIndex = typeof focusReturn?.focusIndex === 'number' ? focusReturn.focusIndex : null;
  const focusScopeIds = Array.isArray(focusReturn?.focusScopeIds) ? focusReturn!.focusScopeIds : null;
  const selectedIds = Array.isArray(focusReturn?.selectedIds) ? focusReturn!.selectedIds : null;

  const handleBackToList = () => {
    if (fromAcquisitieFocus) {
      navigate('/off-market', {
        state: {
          resumeAcquisitieFocus: true,
          focusIndex,
          focusScopeIds,
          selectedIds,
        },
      });
    } else {
      navigate('/off-market');
    }
  };


  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [desktopTab, setDesktopTab] = useState<string>(initialTab);
  const [mobileTab, setMobileTab] = useState<string>(initialTab);
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


  const navigateInContext = (targetId: string) => {
    if (inFocusContext) {
      const nextIdx = focusScopeIds!.indexOf(targetId);
      navigate(`/off-market/${targetId}?tab=brieven`, {
        state: {
          fromAcquisitieFocus: true,
          focusScopeIds,
          selectedIds,
          focusIndex: nextIdx >= 0 ? nextIdx : 0,
        },
      });
    } else {
      navigate(`/off-market/${targetId}`);
    }
  };

  return (
    <div className="space-y-4 lg:space-y-5 px-4 sm:px-6 pb-4 sm:pb-6 pt-0 md:pt-6 max-w-7xl">
      {/* === Mobiel: sticky nav (Terug / vorige / teller / volgende) === */}
      <div className="lg:hidden -mx-4 sm:-mx-6 sticky top-0 z-30 glass-topbar border-b border-border/60">
        <div className="flex items-center gap-1 px-2 py-1">
          <button type="button" onClick={handleBackToList}
            data-testid="signaal-detail-mobile-terug"
            className="inline-flex items-center gap-1 px-2 h-10 text-xs text-foreground hover:bg-muted rounded-md">
            <ArrowLeft className="h-4 w-4" /> Terug
          </button>
          <button type="button" onClick={() => navInfo.prevId && navigateInContext(navInfo.prevId)}
            disabled={!navInfo.prevId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Vorige signaal">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="flex-1 text-center text-xs text-muted-foreground tabular-nums">
            {navInfo.index >= 0 ? `${navInfo.index + 1} / ${navInfo.total}` : `— / ${navInfo.total}`}
          </span>
          <button type="button" onClick={() => navInfo.nextId && navigateInContext(navInfo.nextId)}
            disabled={!navInfo.nextId}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Volgende signaal">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* === Desktop nav === */}
      <div className="hidden lg:flex items-center justify-end">
        {inFocusContext ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!navInfo.prevId}
              onClick={() => navInfo.prevId && navigateInContext(navInfo.prevId)}
              data-testid="signaal-detail-focus-vorige"
            >
              <ChevronLeft className="h-4 w-4" /> Vorige
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">
              Signaal {navInfo.index + 1} van {navInfo.total}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={!navInfo.nextId}
              onClick={() => navInfo.nextId && navigateInContext(navInfo.nextId)}
              data-testid="signaal-detail-focus-volgende"
            >
              Volgende <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <ListNavigator info={navInfo} buildHref={(nid) => `/off-market/${nid}`} itemLabel="signaal" />
        )}
      </div>


      {/* === Desktop: ongewijzigd === */}
      <div className="hidden lg:block space-y-5">
        <SignaalDetailHeader
          signaal={signaal}
          onEdit={() => setEditOpen(true)}
          onArchive={() => setArchiveOpen(true)}
          onTerugNaarLijst={handleBackToList}
        />

        <SignaalKpiBar signaal={signaal} taken={taken} briefStatus={briefStatus} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          <div className="min-w-0">
            <Tabs value={desktopTab} onValueChange={setDesktopTab}>
              <div className="glass-tabbar px-1.5 py-1 overflow-hidden">
                <TabsList
                  data-testid="signaal-desktop-tabs"
                  className="tabs-scroll bg-transparent p-0 h-auto rounded-none gap-1 flex w-full justify-start"
                >
                  {DESKTOP_TABS.map((t) => (
                    <TabsTrigger
                      key={t.value}
                      value={t.value}
                      className="glass-tab-pill data-[state=active]:!shadow-none"
                    >
                      <t.Icon className="h-3.5 w-3.5 mr-1.5" /> {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>


              <TabsContent value="overzicht" className="space-y-5 mt-4">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Snelle acties
                    </p>
                    <SignaalSnelleActiesBar signaal={signaal} />
                  </div>
                  <div className="shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Status wijzigen
                    </p>
                    <StatusWijzigDropdown signaal={signaal} variant="inline" />
                  </div>
                </div>
                <SignaalAiAnalyse signaal={signaal} />
                <SignaalClassificatieBlok signaal={signaal} onOpenFullForm={() => setEditOpen(true)} />
                <SignaalOnderzoeksacties signaal={signaal} />
                <SignaalBrievenSectie signaal={signaal} />
                <SignaalDossierNotities signaal={signaal} />
              </TabsContent>

              <TabsContent value="onderzoek" className="space-y-5 mt-4">
                <SignaalOnderzoeksacties signaal={signaal} />
                <SignaalGebiedsindeling signaal={signaal} />
                <BagOverzichtKaart signaal={signaal} onOpenKadaster={() => setDesktopTab('kadaster')} />
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
                onOpenTaken={() => setDesktopTab('taken')}
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
        <SignaalMobileCockpit
          signaal={signaal}
          taken={taken}
          briefStatus={briefStatus}
          onTaakAanmaken={() => setTaakOpen(true)}
          onOpenTaken={() => setMobileTab('taken')}
        />
        <SignaalMobileActionBar signaal={signaal} />

        <Tabs value={mobileTab} onValueChange={setMobileTab} className="pt-1">
          <div className="glass-tabbar px-1.5 py-1">
            <MobileTabbarScroller activeValue={mobileTab}>
              <TabsList
                data-testid="signaal-mobile-tabs"
                className="bg-transparent p-0 h-auto rounded-none gap-1 flex w-max justify-start"
              >
                {MOBILE_TABS.map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="glass-tab-pill data-[state=active]:!shadow-none whitespace-nowrap"
                  >
                    <t.Icon className="h-3.5 w-3.5 mr-1" />
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </MobileTabbarScroller>
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
            <SignaalOnderzoeksacties signaal={signaal} />
            <SignaalMobileGebiedsindeling signaal={signaal} />
            <SignaalMobileBronregel signaal={signaal} />
            <BagOverzichtKaart
              signaal={signaal}
              onOpenKadaster={() => setMobileTab('kadaster')}
            />
          </TabsContent>

          <TabsContent value="kadaster" className="space-y-3 mt-3">
            <SignaalKadasterKaart signaal={signaal} />
            <SignaalEigenaarsonderzoekSectie signaal={signaal} />
            <SignaalKoppelingenSectie signaal={signaal} />
          </TabsContent>

          <TabsContent value="brieven" className="space-y-3 mt-3">
            <SignaalBrievenSectie signaal={signaal} />
          </TabsContent>

          <TabsContent value="taken" className="space-y-3 mt-3">
            <SignaalTakenSectie signaalId={signaal.id} />
            <SignaalTijdlijnSectie signaalId={signaal.id} />
          </TabsContent>

          <TabsContent value="technisch" className="space-y-3 mt-3">
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
