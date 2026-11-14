import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IS_ISOLATED_PREVIEW_SANDBOX } from '@/lib/auth/previewSandbox';

const AUTH_DISABLED = false;

export default function ProtectedRoute({
  children,
  vereistAdmin = false,
}: {
  children: React.ReactNode;
  vereistAdmin?: boolean;
}) {
  const { user, loading, heeftToegang, isAdmin, signOut } = useAuth();
  const location = useLocation();

  if (AUTH_DISABLED) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user && IS_ISOLATED_PREVIEW_SANDBOX) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center space-y-3">
          <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
          <h1 className="text-lg font-semibold">Testomgeving niet beschikbaar</h1>
          <p className="text-sm text-muted-foreground">
            De afzonderlijke sandboxdatabase is nog niet ingericht voor automatische gasttoegang.
            Productiegegevens blijven afgeschermd.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    const nextPath = location.pathname + location.search;
    const q = nextPath && nextPath !== "/" ? `?next=${encodeURIComponent(nextPath)}` : "";
    return <Navigate to={`/auth${q}`} state={{ from: location }} replace />;
  }

  if (!heeftToegang) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-warning" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Toegang in afwachting</h1>
          <p className="text-sm text-muted-foreground">
            Je account is aangemaakt maar nog niet geactiveerd. Een beheerder moet je eerst de rol
            'medewerker' of 'admin' toekennen voordat je toegang krijgt tot de werkomgeving.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Uitloggen
          </Button>
        </div>
      </div>
    );
  }

  if (vereistAdmin && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-8 text-center space-y-3">
          <ShieldAlert className="h-6 w-6 text-warning mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Geen beheerrechten</h1>
          <p className="text-sm text-muted-foreground">
            Deze pagina is alleen toegankelijk voor admins.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {IS_ISOLATED_PREVIEW_SANDBOX && (
        <div aria-label="Testomgeving" className="fixed bottom-3 right-3 z-[9999] rounded-md border border-border bg-background/95 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm">
          TESTOMGEVING · fictieve gegevens
        </div>
      )}
      {children}
    </>
  );
}
