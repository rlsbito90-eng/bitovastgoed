import { lazy, Suspense } from 'react';
import { Route, Routes, useParams } from 'react-router-dom';
import CrmDetailNavigationBoundary from '@/components/CrmDetailNavigationBoundary';
import CrmNavigationOriginTracker from '@/components/CrmNavigationOriginTracker';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppLayout from '@/components/AppLayout';
import { SubcategorieProvider } from '@/hooks/useSubcategorieen';
import { PropertyTaxonomieProvider } from '@/hooks/usePropertyTaxonomie';
import { DataStoreProvider, useDataStore } from '@/hooks/useDataStore';
import { AcquisitieProvider } from '@/hooks/useAcquisitie';
import { VastgoedkansenProvider } from '@/hooks/useVastgoedkansen';

const AcquisitiePage = lazy(() => import('@/pages/AcquisitiePage'));
const AcquisitieTargetDetailPage = lazy(() => import('@/pages/AcquisitieTargetDetailPage'));
const AcquisitieCampagneDetailPage = lazy(() => import('@/pages/AcquisitieCampagneDetailPage'));
const AcquisitieFunnelMetPrestatiesPage = lazy(() => import('@/pages/AcquisitieFunnelMetPrestatiesPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const RelatiesPage = lazy(() => import('@/pages/RelatiesPage'));
const RelatieDetailPage = lazy(() => import('@/pages/RelatieDetailPage'));
const ObjectenPage = lazy(() => import('@/pages/ObjectenPage'));
const ObjectDetailPage = lazy(() => import('@/pages/ObjectDetailPage'));
const DealsPage = lazy(() => import('@/pages/DealsPage'));
const DealDetailPage = lazy(() => import('@/pages/DealDetailPage'));
const ZoekprofielenPage = lazy(() => import('@/pages/ZoekprofielenPage'));
const PipelinePage = lazy(() => import('@/pages/PipelinePage'));
const TakenPage = lazy(() => import('@/pages/TakenPage'));
const TaakDetailPage = lazy(() => import('@/pages/TaakDetailPage'));
const RapportagePage = lazy(() => import('@/pages/RapportagePage'));
const KadasterKostenPage = lazy(() => import('@/pages/KadasterKostenPage'));
const ReferentieObjectenPage = lazy(() => import('@/pages/ReferentieObjectenPage'));
const AdminPage = lazy(() => import('@/pages/AdminPage'));
const VastgoedrekenenPage = lazy(() => import('@/pages/VastgoedrekenenPage'));
const OffMarketPage = lazy(() => import('@/pages/OffMarketPage'));
const VastgoedkansenPage = lazy(() => import('@/pages/VastgoedkansenPage'));
const VastgoedkansDetailPage = lazy(() => import('@/pages/VastgoedkansDetailPage'));
const VastgoedkansenVindenPage = lazy(() => import('@/pages/VastgoedkansenVindenPage'));
const SnellePandcheckPage = lazy(() => import('@/pages/SnellePandcheckPage'));
const OffMarketSignaalRoutePage = lazy(() => import('@/pages/OffMarketSignaalRoutePage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function RouteFallback() {
  return <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted-foreground">Laden…</div>;
}

function SafeObjectDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { loading, getObjectById } = useDataStore();
  const object = id ? getObjectById(id) : undefined;

  if (!object) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">{loading ? 'Object wordt geladen…' : 'Object wordt opgehaald…'}</p>
          <p className="mt-1 text-xs text-muted-foreground">De detailpagina opent zodra de objectdata beschikbaar is.</p>
        </div>
      </div>
    );
  }

  return <ObjectDetailPage />;
}

export default function CrmProtectedApp() {
  return (
    <SubcategorieProvider>
      <PropertyTaxonomieProvider>
        <DataStoreProvider>
          <AcquisitieProvider>
            <VastgoedkansenProvider>
              <Suspense fallback={<RouteFallback />}>
                <AppLayout>
                  <CrmNavigationOriginTracker />
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/relaties" element={<RelatiesPage />} />
                    <Route path="/relaties/:id" element={<CrmDetailNavigationBoundary fallbackPath="/relaties" fallbackLabel="Relaties" source="relatie-detail"><RelatieDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/objecten" element={<ObjectenPage />} />
                    <Route path="/objecten/:id" element={<CrmDetailNavigationBoundary fallbackPath="/objecten" fallbackLabel="Objecten" source="object-detail"><SafeObjectDetailRoute /></CrmDetailNavigationBoundary>} />
                    <Route path="/deals" element={<DealsPage />} />
                    <Route path="/deals/:id" element={<CrmDetailNavigationBoundary fallbackPath="/deals" fallbackLabel="Deals" source="deal-detail"><DealDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/zoekprofielen" element={<ZoekprofielenPage />} />
                    <Route path="/pipeline" element={<PipelinePage />} />
                    <Route path="/acquisitie" element={<AcquisitiePage />} />
                    <Route path="/acquisitie/funnel" element={<AcquisitieFunnelMetPrestatiesPage />} />
                    <Route path="/acquisitie/targets/:id" element={<CrmDetailNavigationBoundary fallbackPath="/acquisitie" fallbackLabel="Acquisitie" source="acquisitie-target-detail"><AcquisitieTargetDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/acquisitie/campagnes/:id" element={<CrmDetailNavigationBoundary fallbackPath="/acquisitie" fallbackLabel="Acquisitie" source="acquisitie-campagne-detail"><AcquisitieCampagneDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/vastgoedkansen" element={<VastgoedkansenPage />} />
                    <Route path="/vastgoedkansen/vinden" element={<VastgoedkansenVindenPage />} />
                    <Route path="/vastgoedkansen/pandcheck" element={<SnellePandcheckPage />} />
                    <Route path="/vastgoedkansen/:id" element={<CrmDetailNavigationBoundary fallbackPath="/vastgoedkansen" fallbackLabel="Vastgoedkansen" source="vastgoedkans-detail"><VastgoedkansDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/off-market" element={<OffMarketPage />} />
                    <Route path="/off-market/:id" element={<CrmDetailNavigationBoundary fallbackPath="/off-market" fallbackLabel="Off-Market Radar" source="off-market-detail"><OffMarketSignaalRoutePage /></CrmDetailNavigationBoundary>} />
                    <Route path="/referentieobjecten" element={<ReferentieObjectenPage />} />
                    <Route path="/taken" element={<TakenPage />} />
                    <Route path="/taken/:id" element={<CrmDetailNavigationBoundary fallbackPath="/taken" fallbackLabel="Taken" source="taak-detail"><TaakDetailPage /></CrmDetailNavigationBoundary>} />
                    <Route path="/vastgoedrekenen" element={<VastgoedrekenenPage />} />
                    <Route path="/rapportage" element={<RapportagePage />} />
                    <Route path="/rapportage/kadasterkosten" element={<KadasterKostenPage />} />
                    <Route path="/admin" element={<ProtectedRoute vereistAdmin><AdminPage /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AppLayout>
              </Suspense>
            </VastgoedkansenProvider>
          </AcquisitieProvider>
        </DataStoreProvider>
      </PropertyTaxonomieProvider>
    </SubcategorieProvider>
  );
}
