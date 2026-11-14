import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, MapPin, Plus, Search, Unlink2, Link2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { ObjectVastgoed } from '@/data/mock-data';
import { formatCurrency, formatCurrencyCompact } from '@/data/mock-data';
import { buildMapsUrl } from '@/lib/maps';
import {
  portefeuilleOnderdelen,
  beschikbarePortefeuilleOnderdelen,
  portefeuilleAdresLabel,
} from '@/lib/objecten/portefeuilleOnderdelen';

interface Props {
  portefeuille: ObjectVastgoed;
  objecten: readonly ObjectVastgoed[];
  onNieuwOnderdeel: () => void;
  onKoppel: (objectId: string) => Promise<void>;
  onOntkoppel: (objectId: string) => Promise<void>;
}

/**
 * Eén verkooppropositie, meerdere eigen objectdossiers.
 * Alleen visualisatie + expliciete gebruikersacties: nooit automatische
 * verdeling van vraagprijs, optelling van huur of kopiëren van een pipeline.
 */
export default function PortefeuilleOnderdelenPanel({
  portefeuille, objecten, onNieuwOnderdeel, onKoppel, onOntkoppel,
}: Props) {
  const [koppelenOpen, setKoppelenOpen] = useState(false);
  const [zoek, setZoek] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const onderdelen = portefeuilleOnderdelen(objecten, portefeuille.id);
  const kandidaten = beschikbarePortefeuilleOnderdelen(objecten, portefeuille.id)
    .filter(o => [o.titel, o.adres, o.postcode, o.plaats]
      .some(v => (v ?? '').toLocaleLowerCase('nl').includes(zoek.trim().toLocaleLowerCase('nl'))))
    .slice(0, 8);

  const mutate = async (id: string, taak: (id: string) => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await taak(id);
    } catch {
      toast.error('Koppeling kon niet worden opgeslagen. Probeer het opnieuw.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="section-card p-4 sm:p-5 space-y-4" aria-label="Portefeuilleonderdelen">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" aria-hidden="true" />
            <h2 className="font-semibold text-base">Onderdelen & adressen</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {onderdelen.length} gekoppelde {onderdelen.length === 1 ? 'object' : 'objecten'} ·
            gezamenlijke vraagprijs {portefeuille.vraagprijs != null
              ? formatCurrency(portefeuille.vraagprijs) : 'niet ingevuld'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={() => setKoppelenOpen(!koppelenOpen)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs font-medium hover:bg-muted/50">
            <Link2 className="h-3.5 w-3.5" /> Bestaand koppelen
          </button>
          <button type="button" onClick={onNieuwOnderdeel}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-2 text-xs font-medium text-accent-foreground hover:bg-accent/90">
            <Plus className="h-3.5 w-3.5" /> Onderdeel toevoegen
          </button>
        </div>
      </div>

      {onderdelen.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nog geen objecten gekoppeld. Voeg een onderdeel toe of koppel een bestaand object.
          Adressen worden dan hier zichtbaar, inclusief Google Maps-link.
        </p>
      ) : (
        <div className="space-y-2">
          {onderdelen.map(o => {
            // Zonder straat/huisnummer zou Maps hooguit de plaats aanwijzen.
            const url = o.adres && o.plaats ? buildMapsUrl({
              adres: o.adres, postcode: o.postcode, plaats: o.plaats, provincie: o.provincie,
            }) : null;
            return (
              <div key={o.id} className="rounded-lg border border-border/70 bg-card/60 p-3 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <Link className="font-medium text-sm text-foreground hover:text-accent hover:underline break-words"
                      to={`/objecten/${o.id}`}>
                      {o.titel} <ArrowUpRight className="inline-block h-3 w-3" aria-hidden="true" />
                    </Link>
                    <p className="text-xs text-muted-foreground break-words">
                      {portefeuilleAdresLabel(o)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {o.vraagprijs != null
                        ? `Eigen vraagprijs: ${formatCurrency(o.vraagprijs)} (niet opgeteld)`
                        : 'Geen afzonderlijke vraagprijs'}
                      {o.huurinkomsten != null && ` · Eigen jaarhuur: ${formatCurrencyCompact(o.huurinkomsten)}`}
                      {o.isArchived && ' · Gearchiveerd'}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {url && (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        aria-label={`Open ${o.titel} in Google Maps`} title="Open in Google Maps"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted/50">
                        <MapPin className="h-4 w-4" />
                      </a>
                    )}
                    <button type="button" onClick={() => void mutate(o.id, onOntkoppel)}
                      disabled={busyId !== null}
                      title="Alleen portefeuille-koppeling verwijderen, object blijft bestaan"
                      aria-label={`Ontkoppel ${o.titel} van portefeuille`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-muted/50 disabled:opacity-50">
                      <Unlink2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {koppelenOpen && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2">
          {window.location.hostname === 'bitovastgoed-git-crm-test-bitovastgoed.vercel.app' && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Let op: deze testomgeving deelt de bestaande CRM-database.
              Koppelen en ontkoppelen wijzigen daarom echte objectgegevens.
            </p>
          )}
          <label htmlFor="portefeuille-zoek" className="text-xs font-medium">
            Bestaand object zoeken
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input id="portefeuille-zoek" value={zoek} onChange={e => setZoek(e.target.value)}
              placeholder="Naam, adres of plaats"
              className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" />
          </div>
          {kandidaten.length === 0 ? (
            <p className="text-xs text-muted-foreground">Geen ongekoppelde objecten gevonden.</p>
          ) : kandidaten.map(o => (
            <div className="flex items-center justify-between gap-2 border-b border-border/40 py-2 last:border-0" key={o.id}>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{o.titel}</p>
                <p className="text-[11px] text-muted-foreground truncate">{portefeuilleAdresLabel(o)}</p>
              </div>
              <button type="button" disabled={busyId !== null}
                onClick={() => void mutate(o.id, onKoppel)}
                className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-card disabled:opacity-50">
                Koppelen
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        De portefeuilleprijs en -jaarhuur worden niet automatisch verdeeld of opgeteld.
        Iedere kaart opent het eigen objectdossier. Een koppeling verandert geen bestaande prijzen,
        huurcontracten of kandidaten.
      </p>
    </section>
  );
}
