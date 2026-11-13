import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  CRM_PRIMARY_ORIGIN,
  isBitoPreviewOrigin,
  PREVIEW_LOGIN_ACK,
  PREVIEW_LOGIN_MESSAGE,
} from '@/lib/auth/previewSso';

type Grant = { nonce?: string; tokenHash?: string; type?: string };

/**
 * Alleen op het vaste productiedomein: verstrek na echte admin-autorisatie een
 * server-side gegenereerde EENMALIGE previewlogin. Geen access/refresh tokens
 * van de productiesessie overdragen.
 */
export default function PreviewAuthBridgePage() {
  const [params] = useSearchParams();
  const { loading, user, isAdmin } = useAuth();
  const origin = params.get('origin') ?? '';
  const nonce = params.get('nonce') ?? '';
  const geldigeAanvraag = useMemo(() =>
    window.location.origin === CRM_PRIMARY_ORIGIN
    && isBitoPreviewOrigin(origin)
    && /^[a-f0-9]{64}$/.test(nonce),
  [origin, nonce]);

  const [busy, setBusy] = useState(false);
  const [verstuurd, setVerstuurd] = useState(false);
  const [afgerond, setAfgerond] = useState(false);

  useEffect(() => {
    const onAck = (event: MessageEvent) => {
      if (event.source !== window.opener || event.origin !== origin) return;
      if (event.data?.type !== PREVIEW_LOGIN_ACK || event.data?.nonce !== nonce) return;
      setAfgerond(true);
      window.close();
    };
    window.addEventListener('message', onAck);
    return () => window.removeEventListener('message', onAck);
  }, [origin, nonce]);

  const verleenToegang = async () => {
    if (!geldigeAanvraag || !window.opener || busy || verstuurd || loading) return;
    if (user && !isAdmin) {
      toast.error('Alleen een CRM-beheerder kan previewtoegang bevestigen.');
      return;
    }
    setBusy(true);
    try {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!window.isSecureContext || !('PublicKeyCredential' in window)) {
          toast.error('Touch ID is op deze browser niet beschikbaar. Gebruik de herstelroute op het vaste CRM-adres.');
          return;
        }
        const { error } = await supabase.auth.signInWithPasskey();
        if (error) {
          toast.error('Aanmelden met Touch ID is niet gelukt. Probeer opnieuw of herstel je toegang.');
          return;
        }
        ({ data: { session } } = await supabase.auth.getSession());
      }
      if (!session) {
        toast.error('Geen geldige sessie gevonden.');
        return;
      }

      const { data, error } = await supabase.functions.invoke<Grant>('crm-preview-session', {
        body: { previewOrigin: origin, nonce },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data || data.nonce !== nonce || data.type !== 'magiclink' || typeof data.tokenHash !== 'string') {
        toast.error('Centrale previewaanmelding is nog niet beschikbaar of de preview is niet vertrouwd. Gebruik voorlopig de herstelroute.');
        return;
      }

      // De doel-origin is twee keer gecontroleerd: browserformaat hierboven,
      // werkelijk Vercel-project/branch binnen de Supabase Edge Function.
      window.opener.postMessage(
        { type: PREVIEW_LOGIN_MESSAGE, nonce, tokenHash: data.tokenHash },
        origin,
      );
      setVerstuurd(true);
    } catch {
      toast.error('Centrale previewaanmelding is niet gelukt. Probeer het opnieuw.');
    } finally {
      setBusy(false);
    }
  };

  const herstelPath = `/auth/herstel?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-md rounded-xl border bg-card p-7 text-center space-y-5">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
        <h1 className="text-xl font-semibold">Beveiligde previewtoegang</h1>
        {!geldigeAanvraag || !window.opener ? (
          <p className="text-sm text-destructive">Deze aanmelding is ongeldig. Open een preview vanuit Bito CRM.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Je bevestigt via het vaste CRM-adres de toegang tot een gecontroleerde preview.
              Er wordt geen bestaande CRM-sessie gedeeld.
            </p>
            <p className="break-all text-xs text-muted-foreground">{origin}</p>
            {afgerond ? (
              <p className="text-sm">Toegang bevestigd. Je kunt dit venster sluiten.</p>
            ) : verstuurd ? (
              <p className="text-sm">Toegang verzonden. Rond de aanmelding af in het previewvenster.</p>
            ) : (
              <Button className="w-full gap-2" disabled={loading || busy} onClick={() => void verleenToegang()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
                {busy ? 'Beveiligde toegang controleren…' : (user ? 'Previewtoegang bevestigen' : 'Open preview met Touch ID')}
              </Button>
            )}
            <a className="text-xs underline underline-offset-4 text-muted-foreground" href={herstelPath}>
              Toegang herstellen met bestaande account
            </a>
          </>
        )}
      </section>
    </main>
  );
}
