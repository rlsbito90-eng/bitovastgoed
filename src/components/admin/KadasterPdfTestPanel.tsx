// Admin-only debugtool — roept POC Edge Function `kadaster-pdf-text-extract`
// aan op een reeds opgeslagen Kadasterdocument en toont uitsluitend
// veilige metadata. Geen persoonsgegevens, geen ruwe tekst, geen DB-writes.

import { useEffect, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface RecentDoc {
  id: string;
  created_at: string;
  source: string | null;
  product_codes: string[] | null;
}

interface VoorstelVeilig {
  rechtType?: string;
  rolLabel?: string;
  confidence?: string;
  bron?: string;
  aandeel?: string;
  naam_gevuld: boolean;
  bedrijfsnaam_gevuld: boolean;
  verzendadres_gevuld: boolean;
  reden_kort?: string;
}

interface VeiligeRespons {
  error?: string;
  status?: number;
  pages?: number;
  raw_chars?: number;
  normalised_chars?: number;
  voorstellen_count?: number;
  voorstellen?: VoorstelVeilig[];
  gemaskeerde_tekst_preview?: string;
  eerste_40_regels?: string[];
}

// Strip alles wat op een echt adres of postcode lijkt uit de "reden"-tekst,
// zodat we nooit per ongeluk persoonsgegevens op het scherm tonen.
function veiligeReden(reden: string | undefined): string | undefined {
  if (!reden) return undefined;
  const zonderPostcode = reden.replace(/\b\d{4}\s?[A-Z]{2}\b/g, '[postcode]');
  // hak op de eerste punt om vrije-tekst-stukken in te perken
  return zonderPostcode.split('.')[0]?.trim() || undefined;
}

function mapVoorstel(v: any): VoorstelVeilig {
  return {
    rechtType: typeof v?.rechtType === 'string' ? v.rechtType : undefined,
    rolLabel: typeof v?.rolLabel === 'string' ? v.rolLabel : undefined,
    confidence: typeof v?.confidence === 'string' ? v.confidence : undefined,
    bron: typeof v?.bron === 'string' ? v.bron : undefined,
    aandeel: typeof v?.aandeel === 'string' ? v.aandeel : undefined,
    naam_gevuld: typeof v?.naam === 'string' && v.naam.trim().length > 0,
    bedrijfsnaam_gevuld: typeof v?.bedrijfsnaam === 'string' && v.bedrijfsnaam.trim().length > 0,
    verzendadres_gevuld: typeof v?.verzendadres === 'string' && v.verzendadres.trim().length > 0,
    reden_kort: veiligeReden(v?.reden),
  };
}

export default function KadasterPdfTestPanel() {
  const [documentId, setDocumentId] = useState('');
  const [bezig, setBezig] = useState(false);
  const [respons, setRespons] = useState<VeiligeRespons | null>(null);
  const [recent, setRecent] = useState<RecentDoc[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    let actief = true;
    (async () => {
      const { data, error } = await supabase
        .from('kadaster_documenten')
        .select('id, created_at, source, product_codes')
        .order('created_at', { ascending: false })
        .limit(5);
      if (!actief) return;
      if (error) {
        setRecent([]);
      } else {
        setRecent(
          (data ?? []).map((d: any) => ({
            id: d.id,
            created_at: d.created_at,
            source: d.source ?? null,
            product_codes: Array.isArray(d.product_codes) ? d.product_codes : null,
          })),
        );
      }
      setRecentLoading(false);
    })();
    return () => {
      actief = false;
    };
  }, []);

  const test = async () => {
    const id = documentId.trim();
    if (!id) {
      toast.error('Vul een document_id in.');
      return;
    }
    setBezig(true);
    setRespons(null);
    try {
      const { data, error } = await supabase.functions.invoke('kadaster-pdf-text-extract', {
        body: { document_id: id },
      });
      if (error) {
        setRespons({ error: error.message ?? 'Onbekende fout', status: (error as any)?.status });
      } else {
        const debug = (data as any)?.debug ?? {};
        const voorstellenArr = Array.isArray((data as any)?.voorstellen) ? (data as any).voorstellen : [];
        setRespons({
          pages: typeof debug.pages === 'number' ? debug.pages : undefined,
          raw_chars: typeof debug.raw_chars === 'number' ? debug.raw_chars : undefined,
          normalised_chars: typeof debug.normalised_chars === 'number' ? debug.normalised_chars : undefined,
          voorstellen_count: typeof debug.voorstellen_count === 'number'
            ? debug.voorstellen_count
            : voorstellenArr.length,
          voorstellen: voorstellenArr.map(mapVoorstel),
        });
      }
    } catch (e: any) {
      setRespons({ error: e?.message ?? 'Aanroep mislukte' });
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-warning/20 bg-warning/5 p-3 text-xs text-muted-foreground">
        Tijdelijke interne testtool voor de POC <code>kadaster-pdf-text-extract</code>.
        Read-only: er worden geen documenten, voorstellen of tekst opgeslagen.
        Persoonsgegevens worden niet getoond — alleen tellingen en booleans.
      </div>

      <div className="space-y-2">
        <Label htmlFor="kpt-docid" className="text-xs">document_id</Label>
        <div className="flex gap-2">
          <Input
            id="kpt-docid"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="UUID van kadaster_documenten"
            className="font-mono-data text-sm"
            autoComplete="off"
            spellCheck={false}
          />
          <Button onClick={test} disabled={bezig || !documentId.trim()}>
            {bezig && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {bezig ? 'Testen…' : 'Test adresvoorstel'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <FileSearch className="h-3.5 w-3.5" /> Laatste 5 documenten
        </div>
        {recentLoading ? (
          <div className="text-xs text-muted-foreground">Laden…</div>
        ) : recent.length === 0 ? (
          <div className="text-xs text-muted-foreground">Geen documenten gevonden.</div>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {recent.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDocumentId(d.id)}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-mono-data text-xs truncate">{d.id}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(d.created_at).toLocaleString('nl-NL')}
                    {d.source ? ` · ${d.source}` : ''}
                    {d.product_codes && d.product_codes.length > 0 ? ` · ${d.product_codes.join(', ')}` : ''}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">selecteer</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      {respons && (
        <div className="rounded-md border border-border bg-card p-3 space-y-3 text-xs">
          {respons.error ? (
            <div className="text-destructive">
              <div className="font-semibold">Fout</div>
              <div className="break-words">{respons.error}</div>
              {respons.status ? <div className="text-muted-foreground">status: {respons.status}</div> : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="pages" value={respons.pages} />
                <Stat label="raw_chars" value={respons.raw_chars} />
                <Stat label="normalised_chars" value={respons.normalised_chars} />
                <Stat label="voorstellen" value={respons.voorstellen_count} />
              </div>
              {respons.voorstellen && respons.voorstellen.length > 0 ? (
                <div className="space-y-2">
                  {respons.voorstellen.map((v, i) => (
                    <div key={i} className="rounded border border-border p-2 space-y-1">
                      <div className="flex flex-wrap gap-1.5">
                        {v.rolLabel && <Badge variant="outline">{v.rolLabel}</Badge>}
                        {v.rechtType && <Badge variant="outline">{v.rechtType}</Badge>}
                        {v.confidence && <Badge variant="outline">conf: {v.confidence}</Badge>}
                        {v.bron && <Badge variant="outline">{v.bron}</Badge>}
                        {v.aandeel && <Badge variant="outline">aandeel {v.aandeel}</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                        <span>naam: {v.naam_gevuld ? '✓' : '—'}</span>
                        <span>bedrijfsnaam: {v.bedrijfsnaam_gevuld ? '✓' : '—'}</span>
                        <span>verzendadres: {v.verzendadres_gevuld ? '✓' : '—'}</span>
                      </div>
                      {v.reden_kort && (
                        <div className="text-[11px] text-muted-foreground italic">{v.reden_kort}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">Geen voorstellen.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono-data text-sm">{value ?? '—'}</div>
    </div>
  );
}
