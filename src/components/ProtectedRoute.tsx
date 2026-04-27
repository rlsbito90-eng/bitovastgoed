import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
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

  return <>{children}</>;
}
