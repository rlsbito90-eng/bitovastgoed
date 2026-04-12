import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataStoreProvider } from "@/hooks/useDataStore";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import RelatiesPage from "@/pages/RelatiesPage";
import RelatieDetailPage from "@/pages/RelatieDetailPage";
import ObjectenPage from "@/pages/ObjectenPage";
import ObjectDetailPage from "@/pages/ObjectDetailPage";
import DealsPage from "@/pages/DealsPage";
import DealDetailPage from "@/pages/DealDetailPage";
import ZoekprofielenPage from "@/pages/ZoekprofielenPage";
import TakenPage from "@/pages/TakenPage";
import RapportagePage from "@/pages/RapportagePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataStoreProvider>
        <BrowserRouter>
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
              <Route path="/taken" element={<TakenPage />} />
              <Route path="/rapportage" element={<RapportagePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </DataStoreProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
