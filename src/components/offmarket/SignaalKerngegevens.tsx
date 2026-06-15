import { Copy, ExternalLink, Landmark, Map as MapIcon, MapPin, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format/nl';
import {
  bouwBagViewerUrl,
  bouwGoogleMapsUrl,
  bouwGoogleSearchUrl,
  bouwKadastraleKaartUrl,
  bouwOnderzoeksAdresQuery,
} from '@/lib/offMarket/onderzoeksAdres';
import {
  ASSETTYPE_LABEL, BRON_TYPE_LABEL, SIGNAALTYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';

const formatDateNL = (d: string | null) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('nl-NL'); } catch { return d; }
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm text-foreground mt-0.5 break-words">{children ?? <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}

function val(s: string | null | undefined) {
  return s && s.trim() ? s : null;
}

const knopClass =
  'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-card hover:border-accent/50 hover:text-accent text-foreground disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground';

interface Props { signaal: OffMarketSignaal; }

export default function SignaalKerngegevens({ signaal: s }: Props) {
  const adresregel = [s.adres, [s.postcode, s.plaats].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;
  const regio = [s.provincie, s.regio].filter(Boolean).join(' · ') || null;

  const onderzoeksQuery = bouwOnderzoeksAdresQuery({ adres: s.adres, postcode: s.postcode, plaats: s.plaats });
  const mapsUrl = bouwGoogleMapsUrl({
    adres: s.adres, postcode: s.postcode, plaats: s.plaats,
    lat: (s as any).lat ?? null, lng: (s as any).lng ?? null,
  });
  const googleUrl = bouwGoogleSearchUrl({ adres: s.adres, postcode: s.postcode, plaats: s.plaats });
  const bagUrl = bouwBagViewerUrl();
  const kkUrl = bouwKadastraleKaartUrl();

  const kopieerAdres = async () => {
    if (!onderzoeksQuery) return;
    try {
      await navigator.clipboard.writeText(onderzoeksQuery);
      toast.success('Adres gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  return (
    <div className="space-y-5">
      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Locatie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Adres">{val(adresregel)}</Field>
          <Field label="Regio / provincie">{val(regio)}</Field>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={knopClass}>
              <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
            </a>
          )}
          {googleUrl && (
            <a href={googleUrl} target="_blank" rel="noopener noreferrer" className={knopClass}>
              <Search className="h-3.5 w-3.5" /> Zoek adres op Google
            </a>
          )}
          <a href={bagUrl} target="_blank" rel="noopener noreferrer" className={knopClass}>
            <MapIcon className="h-3.5 w-3.5" /> Open in BAG Viewer
          </a>
          <a href={kkUrl} target="_blank" rel="noopener noreferrer" className={knopClass}>
            <Landmark className="h-3.5 w-3.5" /> Open in KadastraleKaart.com
          </a>
          <button
            type="button"
            onClick={kopieerAdres}
            disabled={!onderzoeksQuery}
            className={knopClass}
          >
            <Copy className="h-3.5 w-3.5" /> Kopieer adres
          </button>
        </div>
        {onderzoeksQuery ? (
          <p className="text-[11px] text-muted-foreground">
            Zoekquery: <span className="text-foreground">{onderzoeksQuery}</span>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Geen volledig adres beschikbaar voor externe zoeklink.
          </p>
        )}
      </section>


      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Classificatie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Assettype">{ASSETTYPE_LABEL[s.assettype]}</Field>
          <Field label="Type signaal">{SIGNAALTYPE_LABEL[s.type_signaal]}</Field>
          <Field label="Bron">{BRON_TYPE_LABEL[s.bron_type]}</Field>
        </div>
        {val(s.omschrijving) && (
          <Field label="Omschrijving">
            <span className="whitespace-pre-wrap">{s.omschrijving}</span>
          </Field>
        )}
      </section>

      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Bron</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Bron-referentie">{val(s.bron_referentie)}</Field>
          <Field label="Brondatum">{formatDateNL(s.bron_datum)}</Field>
        </div>
        {s.bron_url && (
          <div className="space-y-1.5">
            <a
              href={s.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className={knopClass}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open bekendmaking
            </a>
            <p className="hidden sm:block text-[11px] text-muted-foreground break-all">
              {s.bron_url}
            </p>
          </div>
        )}
      </section>


      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Waarde & strategie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Indicatieve waarde">
            {s.indicatieve_waarde != null ? formatCurrency(Number(s.indicatieve_waarde)) : null}
          </Field>
          <Field label="Mogelijke fee">
            {s.mogelijke_fee != null ? formatCurrency(Number(s.mogelijke_fee)) : null}
          </Field>
          <Field label="Potentiële strategie">{val(s.potentiele_strategie)}</Field>
        </div>
      </section>

      <section className="section-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Volgende actie</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Datum">{formatDateNL(s.volgende_actie_datum)}</Field>
          <Field label="Omschrijving">{val(s.volgende_actie_omschrijving)}</Field>
        </div>
      </section>

      {val(s.notities) && (
        <section className="section-card p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Interne notities</h2>
          <p className="text-sm text-foreground whitespace-pre-wrap">{s.notities}</p>
        </section>
      )}

      {s.gearchiveerd_op && (
        <section className="section-card p-5 space-y-2 border-warning/30">
          <h2 className="text-sm font-semibold text-foreground">Archief</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Gearchiveerd op">{formatDateNL(s.gearchiveerd_op)}</Field>
            <Field label="Reden">{val(s.archief_reden)}</Field>
          </div>
        </section>
      )}
    </div>
  );
}
