import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Typed wrapper omdat `auth.oauth` momenteel beta is in @supabase/supabase-js.
type AuthorizationDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[] };
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data?: AuthorizationDetails & { redirect_url?: string; redirect_to?: string }; error?: { message: string } | null };

const oauthClient = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
    approveAuthorization: (id: string) => Promise<OAuthResult>;
    denyAuthorization: (id: string) => Promise<OAuthResult>;
  };
}).oauth;

function sameOriginRelative(path: string | null): string | null {
  if (!path) return null;
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//")) return null;
  return path;
}

export default function OAuthConsentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Ontbrekende authorization_id in URL.");
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const nextPath = window.location.pathname + window.location.search;
        navigate(`/auth?next=${encodeURIComponent(nextPath)}`, { replace: true });
        return;
      }
      const res = await oauthClient.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (res.error) {
        setError(res.error.message);
        setLoading(false);
        return;
      }
      const immediate = res.data?.redirect_url ?? res.data?.redirect_to;
      if (immediate && !res.data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(res.data ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, navigate]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = approve
        ? await oauthClient.approveAuthorization(authorizationId)
        : await oauthClient.denyAuthorization(authorizationId);
      if (res.error) {
        setError(res.error.message);
        setBusy(false);
        return;
      }
      const target = res.data?.redirect_url ?? res.data?.redirect_to;
      if (!target) {
        setError("Geen redirect ontvangen van de autorisatieserver.");
        setBusy(false);
        return;
      }
      window.location.href = target;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-md glass-card rounded-2xl p-6 sm:p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Toegang tot Bito Vastgoed</h1>
            <p className="text-xs text-muted-foreground">Externe toepassing wil verbinden met je account</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Autorisatie laden…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && details && (
          <>
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                <span className="font-medium">{details.client?.name ?? "Een externe applicatie"}</span>{" "}
                wil verbinden met Bito Vastgoed en namens jou de ingeschakelde tools gebruiken.
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Lezen van je relaties, objecten, deals en taken</li>
                <li>Werkt alleen zolang je bent ingelogd</li>
                <li>Bestaande RLS-rechten blijven van kracht</li>
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button variant="outline" disabled={busy} onClick={() => decide(false)}>
                Weigeren
              </Button>
              <Button disabled={busy} onClick={() => decide(true)}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Toestaan
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              Je kunt toegang later intrekken via de instellingen.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
