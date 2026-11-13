import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PASSKEY_ORIGIN, isPasskeyOriginAllowed } from '@/lib/auth/passkeyOrigin';
import { createPreviewNonce, isBitoPreviewOrigin, PREVIEW_LOGIN_ACK, PREVIEW_LOGIN_ERROR, PREVIEW_LOGIN_MESSAGE } from '@/lib/auth/previewSso';

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
  const juistDomein = isPasskeyOriginAllowed(window.location.origin);
  const geldigPreviewadres = isBitoPreviewOrigin(window.location.origin);
  const popupRef = useRef<Window | null>(null);
  const nonceRef = useRef<string | null>(null);
  const [previewAanmelding, setPreviewAanmelding] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate(next, { replace: true });
  }, [loading, user, navigate, next]);

  // Verleen nooit directe toegang vanuit de preview zelf: eerst aanmelden op
  // het vaste CRM-domein, daarna server-side Vercel-projectverificatie en een
  // afzonderlijke, EENMALIGE login met Supabase Auth.
  useEffect(() => {
    if (!geldigPreviewadres) return;
    const ontvangPreviewLogin = async (event: MessageEvent) => {
      const nonce = nonceRef.current;
      // Exacte primaire origin + cryptografisch willekeurige nonce zijn vereist.
      // De WindowProxy van een popup kan bij navigatie wisselen.
      if (!nonce || event.origin !== PASSKEY_ORIGIN) return;
      if (event.data?.type !== PREVIEW_LOGIN_MESSAGE || event.data?.nonce !== nonce) return;
      if (typeof event.data?.tokenHash !== 'string' || !/^[a-f0-9]{64}$/i.test(event.data.tokenHash)) return;

      nonceRef.current = null; // Slechts één respons verwerken, ook bij herhaalde postMessages.
      const responder = (event.source as Window | null) ?? popupRef.current;
      setBezig(true);
      try {
        const { error } = await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: event.data.tokenHash,
        });
        if (error) {
          responder?.postMessage({ type: PREVIEW_LOGIN_ERROR, nonce }, PASSKEY_ORIGIN);
          toast.error('De eenmalige previewtoegang is verlopen of al gebruikt. Start opnieuw.');
          return;
        }
        responder?.postMessage({ type: PREVIEW_LOGIN_ACK, nonce }, PASSKEY_ORIGIN);
        navigate(next, { replace: true });
      } catch {
        responder?.postMessage({ type: PREVIEW_LOGIN_ERROR, nonce }, PASSKEY_ORIGIN);
        toast.error('Centrale previewaanmelding mislukt. Probeer opnieuw.');
      } finally {
        setBezig(false);
        setPreviewAanmelding(false);
      }
    };
    window.addEventListener('message', ontvangPreviewLogin);
    return () => window.removeEventListener('message', ontvangPreviewLogin);
  }, [geldigPreviewadres, navigate, next]);

  const openCentraleAanmelding = () => {
    if (!geldigPreviewadres || bezig) return;
    const nonce = createPreviewNonce();
    const destination = new URL('/auth/preview-bridge', PASSKEY_ORIGIN);
    destination.searchParams.set('origin', window.location.origin);
    destination.searchParams.set('nonce', nonce);
    nonceRef.current = nonce;
    // Gebruikersactie, zodat de browser de beveiligde popup toestaat.
    // Opener is uitsluitend nodig voor het postMessage-handshakeprotocol.
    const popup = window.open(destination.toString(), 'bito-crm-preview-login', 'popup,width=520,height=680');
    if (!popup) {
      nonceRef.current = null;
      toast.error('Sta popups toe voor deze preview om met Touch ID aan te melden.');
      return;
    }
    popupRef.current = popup;
    setPreviewAanmelding(true);
  };

  const toegangMetPasskey = async () => {
    if (bezig) return;
    if (!juistDomein) {
      toast.error('Touch ID werkt uitsluitend op bitovastgoed.vercel.app.');
      return;
    }
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
              {juistDomein
                ? 'Bevestig je identiteit met Touch ID, de pincode van je apparaat of een beveiligingssleutel.'
                : geldigPreviewadres
                  ? 'Meld je veilig aan via het vaste CRM-adres. Je hoeft geen e-mail of wachtwoord in te vullen.'
                  : 'Dit is geen vertrouwd previewadres. Gebruik het vaste CRM-adres.'}
            </p>
          </div>
          {juistDomein ? (
            <Button type="button" disabled={bezig || loading} className="w-full gap-2" onClick={() => void toegangMetPasskey()}>
              {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              {bezig ? 'Beveiligde toegang openen…' : 'Open met Touch ID / passkey'}
            </Button>
          ) : geldigPreviewadres ? (
            <Button type="button" disabled={bezig || loading} className="w-full gap-2" onClick={openCentraleAanmelding}>
              {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              {bezig ? 'Aanmelding afronden…' : previewAanmelding ? 'Aanmelding opnieuw openen' : 'Aanmelden via Touch ID'}
            </Button>
          ) : (
            <Button asChild className="w-full gap-2">
              <a href={PASSKEY_ORIGIN}>Open het vaste CRM-adres</a>
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            {geldigPreviewadres ? 'De centrale aanmelding controleert het previewadres. Je bestaande productiesessie wordt niet gedeeld.' : 'Ook beschikbaar in een privévenster. Geen e-mailadres of wachtwoord nodig.'}
          </p>
          <Link to={herstelPad} className="block text-xs text-muted-foreground underline-offset-4 hover:underline">
            Toegang herstellen
          </Link>
        </div>
      </div>
    </main>
  );
}
