import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ScrollToTop from "@/components/ScrollToTop";
import { AuthProvider } from "@/hooks/useAuth";
import { DataStoreProvider } from "@/hooks/useDataStore";
import { SubcategorieProvider } from "@/hooks/useSubcategorieen";
import { PropertyTaxonomieProvider } from "@/hooks/usePropertyTaxonomie";
import { AcquisitieProvider } from "@/hooks/useAcquisitie";
import AcquisitiePage from "@/pages/AcquisitiePage";
import AcquisitieTargetDetailPage from "@/pages/AcquisitieTargetDetailPage";
import AcquisitieCampagneDetailPage from "@/pages/AcquisitieCampagneDetailPage";
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
import RapportagePage from "@/pages/RapportagePage";
import ReferentieObjectenPage from "@/pages/ReferentieObjectenPage";
import AdminPage from "@/pages/AdminPage";
import VastgoedrekenenPage from "@/pages/VastgoedrekenenPage";
import OffMarketPage from "@/pages/OffMarketPage";
import OffMarketSignaalDetailPage from "@/pages/OffMarketSignaalDetailPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AuthProvider>
          <SubcategorieProvider>
            <PropertyTaxonomieProvider>
            <DataStoreProvider>
              <AcquisitieProvider>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Routes>
                          <Route path="/" element={<DashboardPage />} />
                          <Route path="/relaties" element={<RelatiesPage />} />
                          <Route path="/relaties/:id" element={<RelatieDetailPage />} />
                          <Route path="/objecten" element={<ObjectenPage />} />
                          <Route path="/objecten/:id" element={<ObjectDetailPage />} />
                          <Route path="/deals" element={<DealsPage />} />
                          <Route path="/deals/:id" element={<DealDetailPage />} />
                          <Route path="/zoekprofielen" element={<ZoekprofielenPage />} />
                          <Route path="/pipeline" element={<PipelinePage />} />
                          <Route path="/acquisitie" element={<AcquisitiePage />} />
                          <Route path="/acquisitie/targets/:id" element={<AcquisitieTargetDetailPage />} />
                          <Route path="/acquisitie/campagnes/:id" element={<AcquisitieCampagneDetailPage />} />
                          <Route path="/off-market" element={<OffMarketPage />} />
                          <Route path="/referentieobjecten" element={<ReferentieObjectenPage />} />
                          <Route path="/taken" element={<TakenPage />} />
                          <Route path="/vastgoedrekenen" element={<VastgoedrekenenPage />} />
                          <Route path="/rapportage" element={<RapportagePage />} />
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
