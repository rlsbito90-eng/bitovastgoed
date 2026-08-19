import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import ScrollToTop from '@/components/ScrollToTop';
import DynamicSectionNavigator from '@/components/DynamicSectionNavigator';
import { AuthProvider } from '@/hooks/useAuth';
import { queryClient } from '@/lib/queryClient';
import ProtectedRoute from '@/components/ProtectedRoute';

const AuthPage = lazy(() => import('@/pages/AuthPage'));
const OAuthConsentPage = lazy(() => import('@/pages/OAuthConsentPage'));
const CrmProtectedApp = lazy(() => import('@/CrmProtectedApp'));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8 text-sm text-muted-foreground">
      Laden…
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <DynamicSectionNavigator />
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/.lovable/oauth/consent" element={<OAuthConsentPage />} />
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <CrmProtectedApp />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
