import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Alleen interne paden accepteren. Een ?next mag nooit naar een externe site leiden.
function veiligVolgendPad(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export default function PasskeyAccessPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = useMemo(() => veiligVolgendPad(params.get('next')), [params]);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [loading, user, navigate, next]);

  const toegangMetPasskey = async () => {
    if (bezig) return;
    if (!window.isSecureContext || !('PublicKeyCredential' in window)) {
      toast.error('Passkeys zijn op dit apparaat of in deze browser niet beschikbaar. Gebruik toegang herstellen.');
      return;
    }

    setBezig(true);
    try {
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        const code = error.code;
        if (code === 'passkey_disabled') {
          toast.error('Passkeys moeten eerst in Supabase worden ingeschakeld. Gebruik tijdelijk toegang herstellen.');
        } else if (code === 'webauthn_credential_not_found') {
          toast.error('Er is nog geen passkey gekoppeld. Open toegang herstellen en registreer je passkey in het gebruikersmenu.');
        } else {
          toast.error('Toegang met passkey niet gelukt. Probeer opnieuw of gebruik toegang herstellen.');
        }
        return;
      }
      // ProtectedRoute controleert na het aanmelden nog steeds de CRM-rol.
      navigate(next, { replace: true });
    } catch {
      toast.error('Toegang met passkey niet gelukt. Probeer opnieuw of gebruik toegang herstellen.');
    } finally {
      setBezig(false);
    }
  };

  const herstelPad = `/auth/herstel?next=${encodeURIComponent(next)}`;
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <img src="/logo-bito-vastgoed.png" alt="Bito Vastgoed" className="mx-auto h-20 w-auto max-w-[160px] object-contain" />
        <div className="glass-card space-y-5 rounded-2xl p-7">
          <ShieldCheck className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Bito CRM</h1>
            <p className="text-sm text-muted-foreground">
              Bevestig je identiteit met Touch ID, de pincode van je apparaat of een beveiligingssleutel.
            </p>
          </div>
          <Button type="button" disabled={bezig || loading} className="w-full gap-2" onClick={() => void toegangMetPasskey()}>
            {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
            {bezig ? 'Beveiligde toegang openen…' : 'Open met Touch ID / passkey'}
          </Button>
          <p className="text-xs text-muted-foreground">Ook beschikbaar in een privévenster. Geen e-mailadres of wachtwoord nodig.</p>
          <Link to={herstelPad} className="block text-xs text-muted-foreground underline-offset-4 hover:underline">
            Toegang herstellen
          </Link>
        </div>
      </div>
    </main>
  );
}
