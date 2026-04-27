import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calendar, Copy, Trash2, Plus, ExternalLink, Loader2, Check, Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface FeedToken {
  id: string;
  token: string;
  naam: string;
  aangemaakt_op: string;
  laatst_gebruikt: string | null;
  ingetrokken_op: string | null;
}

// Genereer een random URL-safe token
function genereerToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .replace(/=/g, '')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .substring(0, 32);
}

function getFeedUrl(token: string): string {
  // Haal Supabase project URL uit de bestaande client config
  const supabaseUrl = (supabase as any).supabaseUrl ?? '';
  return `${supabaseUrl}/functions/v1/bito-ical-feed?token=${token}`;
}

export default function FeedTokensSectie() {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<FeedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [nieuweNaam, setNieuweNaam] = useState('');
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [gekopieerd, setGekopieerd] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('feed_tokens')
      .select('*')
      .eq('gebruiker_id', user.id)
      .is('ingetrokken_op', null)
      .order('aangemaakt_op', { ascending: false });

    if (error) {
      console.error('Tokens laden mislukt:', error);
      toast.error('Tokens laden mislukt');
    } else {
      setTokens((data ?? []) as FeedToken[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { laden(); }, [laden]);

  const handleNieuw = async () => {
    if (!user) return;
    setNieuwBezig(true);
    try {
      const token = genereerToken();
      const naam = nieuweNaam.trim() || 'Agenda-feed';
      const { error } = await supabase.from('feed_tokens').insert({
        token,
        naam,
        gebruiker_id: user.id,
      });
      if (error) throw error;
      toast.success('Nieuwe feed-token aangemaakt');
      setNieuweNaam('');
      await laden();
    } catch (err: any) {
      toast.error(`Aanmaken mislukt: ${err?.message ?? 'onbekende fout'}`);
    } finally {
      setNieuwBezig(false);
    }
  };

  const handleIntrekken = async (id: string) => {
    setBezig(true);
    try {
      const { error } = await supabase
        .from('feed_tokens')
        .update({ ingetrokken_op: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Token ingetrokken — oude URL werkt niet meer');
      await laden();
    } catch (err: any) {
      toast.error(`Intrekken mislukt: ${err?.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const handleKopieer = async (token: string) => {
    try {
      await navigator.clipboard.writeText(getFeedUrl(token));
      setGekopieerd(token);
      toast.success('URL gekopieerd');
      setTimeout(() => setGekopieerd(null), 2000);
    } catch {
      toast.error('Kopiëren mislukt — selecteer en kopieer handmatig');
    }
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="section-title flex items-center gap-2">
          <Calendar className="h-4 w-4 text-accent" />
          Agenda-feed (iCal)
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5">
          Genereer een feed-URL die je in je agenda-app kunt koppelen. De feed bevat alle
          bezichtigingen, taken-deadlines, follow-ups, verwachte closings, kandidaat-acties uit
          de pipeline (volgende actie, bezichtiging, gewenste levering) en NDA-data — automatisch up-to-date.
        </p>
      </div>

      {/* INSTRUCTIES */}
      <div className="bg-muted/40 rounded-md p-3 sm:p-4 space-y-2">
        <p className="text-xs font-medium text-foreground/80 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-accent shrink-0" />
          Hoe te koppelen
        </p>
        <div className="text-xs text-muted-foreground space-y-1.5 ml-5">
          <p>
            <span className="font-medium text-foreground/80">Apple Calendar (iPhone/Mac):</span>{' '}
            Bestand → Nieuw kalenderabonnement → plak URL.
          </p>
          <p>
            <span className="font-medium text-foreground/80">Google Calendar:</span>{' '}
            Andere agenda's → Toevoegen via URL → plak URL.
          </p>
          <p>
            <span className="font-medium text-foreground/80">Outlook:</span>{' '}
            Agenda toevoegen → Vanaf internet → plak URL.
          </p>
          <p className="text-foreground/60 italic mt-2">
            Belangrijk: dit is een alleen-lezen feed. Je kunt geen events vanuit je agenda terug schrijven naar de CRM.
          </p>
        </div>
      </div>

      {/* NIEUWE TOKEN */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <label className="field-label block mb-1">Naam (optioneel)</label>
          <Input
            placeholder="bv. iPhone agenda, Werk laptop"
            value={nieuweNaam}
            onChange={e => setNieuweNaam(e.target.value)}
            disabled={nieuwBezig}
            maxLength={50}
          />
        </div>
        <Button
          onClick={handleNieuw}
          disabled={nieuwBezig}
          className="gap-1.5 shrink-0"
        >
          {nieuwBezig ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Nieuwe feed
        </Button>
      </div>

      {/* TOKEN LIJST */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nog geen feed-tokens. Klik op "Nieuwe feed" om er een aan te maken.
        </p>
      ) : (
        <div className="space-y-2 hairline pt-3">
          {tokens.map(t => (
            <div key={t.id} className="border border-border rounded-md p-3 space-y-2">
              <div className="row-with-action">
                <div className="row-flex">
                  <p className="text-sm font-medium text-foreground truncate">{t.naam}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Aangemaakt: {new Date(t.aangemaakt_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {t.laatst_gebruikt
                      ? ` · Laatst opgehaald: ${new Date(t.laatst_gebruikt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                      : ' · Nog nooit gebruikt'
                    }
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="row-action text-muted-foreground hover:text-destructive"
                      disabled={bezig}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Feed-token intrekken?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hierna werkt de URL "{t.naam}" niet meer. Je agenda-app kan geen updates
                        meer ophalen totdat je een nieuwe token aanmaakt en koppelt.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleIntrekken(t.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Intrekken
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={getFeedUrl(t.token)}
                  className="font-mono-data text-[11px] h-9 bg-muted/40"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleKopieer(t.token)}
                  className="gap-1 shrink-0"
                >
                  {gekopieerd === t.token ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Kopieer
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECURITY NOTE */}
      {tokens.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200/60 text-[11px] text-amber-900">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Behandel deze URL's als wachtwoorden. Iedereen met de URL kan je agenda zien.
            Trek een token in zodra je 'm niet meer nodig hebt of vermoedt dat hij gedeeld is.
          </span>
        </div>
      )}
    </section>
  );
}
