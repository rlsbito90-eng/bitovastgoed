import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import DynamicSectionNavigator from "@/components/DynamicSectionNavigator";
import CrmDetailNavigationBoundary from "@/components/CrmDetailNavigationBoundary";
import { AuthProvider } from "@/hooks/useAuth";
import { DataStoreProvider, useDataStore } from "@/hooks/useDataStore";
import { SubcategorieProvider } from "@/hooks/useSubcategorieen";
import { PropertyTaxonomieProvider } from "@/hooks/usePropertyTaxonomie";
import { AcquisitieProvider } from "@/hooks/useAcquisitie";
import { VastgoedkansenProvider } from "@/hooks/useVastgoedkansen";
import { queryClient } from "@/lib/queryClient";
import AcquisitiePage from "@/pages/AcquisitiePage";
import AcquisitieTargetDetailPage from "@/pages/AcquisitieTargetDetailPage";
import AcquisitieCampagneDetailPage from "@/pages/AcquisitieCampagneDetailPage";
import AcquisitieFunnelPage from "@/pages/AcquisitieFunnelPage";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import DashboardPage from "@/pages/DashboardPage";
import RelatiesPage from "@/pages/RelatiesPage";
import RelatieDetailPage from "@/pages/RelatieDetailPage";
import ObjectenPage from "@/pages/ObjectenPage";
import ObjectDetailPage from "@/pages/ObjectDetailPage";
import DealsPage from "@/pages/DealsPage";
import DealDetailPage from "@/pages/DealDetailPage";
import ZoekprofielenPage from "@/pages/ZoekprofielenPage";
import PipelinePage from "@/pages/PipelinePage";
import TakenPage from "@/pages/TakenPage";
import TaakDetailPage from "@/pages/TaakDetailPage";
import RapportagePage from "@/pages/RapportagePage";
import KadasterKostenPage from "@/pages/KadasterKostenPage";
import ReferentieObjectenPage from "@/pages/ReferentieObjectenPage";
import AdminPage from "@/pages/AdminPage";
import VastgoedrekenenPage from "@/pages/VastgoedrekenenPage";
import OffMarketPage from "@/pages/OffMarketPage";
import VastgoedkansenPage from "@/pages/VastgoedkansenPage";
import VastgoedkansDetailPage from "@/pages/VastgoedkansDetailPage";
import VastgoedkansenVindenPage from "@/pages/VastgoedkansenVindenPage";
import SnellePandcheckPage from "@/pages/SnellePandcheckPage";
import OffMarketSignaalRoutePage from "@/pages/OffMarketSignaalRoutePage";
import OAuthConsentPage from "@/pages/OAuthConsentPage";
import NotFound from "@/pages/NotFound";

function SafeObjectDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const { loading, getObjectById } = useDataStore();
  const object = id ? getObjectById(id) : undefined;

  if (!object) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">
            {loading ? "Object wordt geladen…" : "Object wordt opgehaald…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            De detailpagina opent zodra de objectdata beschikbaar is.
          </p>
        </div>
      </div>
    );
  }

  return <ObjectDetailPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <DynamicSectionNavigator />
        <AuthProvider>
          <SubcategorieProvider>
            <PropertyTaxonomieProvider>
            <DataStoreProvider>
              <AcquisitieProvider>
              <VastgoedkansenProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/relaties" element={<RelatiesPage />} />
                          <Route
                            path="/relaties/:id"
                            element={
                              <CrmDetailNavigationBoundary fallbackPath="/relaties" fallbackLabel="Relaties" source="relatie-detail">
                                <RelatieDetailPage />
                              </CrmDetailNavigationBoundary>
                            }
                          />
                          <Route path="/objecten" element={<ObjectenPage />} />
                          <Route
                            path="/objecten/:id"
                            element={
                              <CrmDetailNavigationBoundary fallbackPath="/objecten" fallbackLabel="Objecten" source="object-detail">
                                <SafeObjectDetailRoute />
                              </CrmDetailNavigationBoundary>
                            }
                          />
                          <Route path="/deals" element={<DealsPage />} />
                          <Route
                            path="/deals/:id"
                            element={
                              <CrmDetailNavigationBoundary fallbackPath="/deals" fallbackLabel="Deals" source="deal-detail">
                                <DealDetailPage />
                              </CrmDetailNavigationBoundary>
                            }
                          />
                          <Route path="/zoekprofielen" element={<ZoekprofielenPage />} />
                          <Route path="/pipeline" element={<PipelinePage />} />
                          <Route path="/acquisitie" element={<AcquisitiePage />} />
                          <Route path="/acquisitie/funnel" element={<AcquisitieFunnelPage />} />
                          <Route path="/acquisitie/targets/:id" element={<AcquisitieTargetDetailPage />} />
                          <Route path="/acquisitie/campagnes/:id" element={<AcquisitieCampagneDetailPage />} />
                          <Route path="/vastgoedkansen" element={<VastgoedkansenPage />} />
                          <Route path="/vastgoedkansen/vinden" element={<VastgoedkansenVindenPage />} />
                          <Route path="/vastgoedkansen/pandcheck" element={<SnellePandcheckPage />} />
                          <Route path="/vastgoedkansen/:id" element={<VastgoedkansDetailPage />} />
                          <Route path="/off-market" element={<OffMarketPage />} />
                          <Route
                            path="/off-market/:id"
                            element={
                              <CrmDetailNavigationBoundary fallbackPath="/off-market" fallbackLabel="Off-Market Radar" source="off-market-detail">
                                <OffMarketSignaalRoutePage />
                              </CrmDetailNavigationBoundary>
                            }
                          />
                          <Route path="/referentieobjecten" element={<ReferentieObjectenPage />} />
                          <Route path="/taken" element={<TakenPage />} />
                          <Route
                            path="/taken/:id"
                            element={
                              <CrmDetailNavigationBoundary fallbackPath="/taken" fallbackLabel="Taken" source="taak-detail">
                                <TaakDetailPage />
                              </CrmDetailNavigationBoundary>
                            }
                          />
                          <Route path="/vastgoedrekenen" element={<VastgoedrekenenPage />} />
                          <Route path="/rapportage" element={<RapportagePage />} />
                          <Route path="/rapportage/kadasterkosten" element={<KadasterKostenPage />} />
                          <Route
                            path="/admin"
                            element={
                              <ProtectedRoute vereistAdmin>
                                <AdminPage />
                              </ProtectedRoute>
                            }
                          />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AppLayout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
              </VastgoedkansenProvider>
              </AcquisitieProvider>
            </DataStoreProvider>
            </PropertyTaxonomieProvider>
          </SubcategorieProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;