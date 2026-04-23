import { useEffect, useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import {
  getMatchesForObjectFromData,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatM2,
  formatPercent,
  ASSET_CLASS_LABELS,
  ONDERHOUDSSTAAT_LABELS,
  VERKOPER_VIA_LABELS,
  DOCUMENT_TYPE_LABELS,
  INDEXATIE_BASIS_LABELS,
} from '@/data/mock-data';
import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import {
  ArrowLeft, MapPin, Pencil, Trash2, EyeOff, Star,
  FileText, Download, Building2, Phone, Mail,
} from 'lucide-react';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { getSignedUrls, getSignedUrl, formatFileSize } from '@/lib/storage';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="text-sm text-foreground mt-1 break-words">{children}</div>
    </div>
  );
}

function StatTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`relative section-card p-4 sm:p-5 overflow-hidden ${accent ? 'accent-rule' : ''}`}>
      <p className="field-label">{label}</p>
      <p className="text-xl lg:text-2xl font-semibold font-mono-data text-foreground mt-1.5 truncate">{value}</p>
    </div>
  );
}

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const { labelFor } = useSubcategorieen();
  const object = store.getObjectById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});

  // Fotos signed URLs ophalen
  const fotos = id ? store.getFotosVoorObject(id) : [];
  useEffect(() => {
    if (fotos.length === 0) { setFotoUrls({}); return; }
    let cancelled = false;
    (async () => {
      const map = await getSignedUrls(fotos.map(f => f.storagePath), 60 * 30);
      if (!cancelled) setFotoUrls(map);
    })();
    return () => { cancelled = true; };
  }, [fotos.map(f => f.storagePath).join('|')]);

  if (!object) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Object niet gevonden.</p>
        <Link to="/objecten" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar objecten</Link>
      </div>
    );
  }

  const huurders = store.getHuurdersVoorObject(object.id);
  const documenten = store.getDocumentenVoorObject(object.id);
  const huurMetrics = store.getHuurMetrics(object.id);
  const deals = store.getDealsByObject(object.id);
  const matches = getMatchesForObjectFromData(object, store.zoekprofielen);

  // Bereken BAR fallback uit huurinkomsten + vraagprijs als niet expliciet ingevuld
  const barEffect = object.brutoAanvangsrendement
    ?? (object.huurinkomsten && object.vraagprijs
      ? (object.huurinkomsten / object.vraagprijs) * 100
      : null);
  const huurPerM2 = object.huurPerM2
    ?? (object.huurinkomsten && object.oppervlakte
      ? Math.round(object.huurinkomsten / object.oppervlakte)
      : null);

  const handleDelete = async () => {
    try {
      await store.deleteObject(object.id);
      toast.success('Object gearchiveerd');
      navigate('/objecten');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handleDownload = async (storagePath: string) => {
    try {
      const url = await getSignedUrl(storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message ?? 'Download mislukt');
    }
  };

  const subcatLabel = labelFor(object.subcategorieId);
  const hoofdfoto = fotos.find(f => f.isHoofdfoto) ?? fotos[0];

  return (
    <div className="page-shell-narrow">
      <Link to="/objecten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Objecten
      </Link>

      {/* HEADER met optionele hoofdfoto */}
      <div className="grid lg:grid-cols-[280px_1fr] gap-4 lg:gap-6">
        {hoofdfoto && fotoUrls[hoofdfoto.storagePath] && (
          <div className="aspect-[4/3] rounded-md overflow-hidden bg-muted">
            <img src={fotoUrls[hoofdfoto.storagePath]} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight">{object.titel}</h1>
              <ObjectStatusBadge status={object.status} />
              {object.exclusief && (
                <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium border border-accent/30 text-accent rounded-full bg-accent/10">
                  Exclusief
                </span>
              )}
              {object.anoniem && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  <EyeOff className="h-3 w-3" /> Anoniem
                </span>
              )}
              {object.isPortefeuille && (
                <span className="inline-flex items-center gap-1 text-[11px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  <Building2 className="h-3 w-3" /> Portefeuille
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-3.5 w-3.5" />
              {object.anoniem
                ? (object.publiekeRegio ?? `${object.provincie}`)
                : `${object.plaats}, ${object.provincie}`}
              <span>·</span>
              <span>{ASSET_CLASS_LABELS[object.type]}</span>
              {subcatLabel && <span>· {subcatLabel}</span>}
              {object.internReferentienummer && (
                <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded ml-1">
                  {object.internReferentienummer}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Pencil className="h-4 w-4" /> Bewerken
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button className="inline-flex items-center justify-center px-2.5 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive" aria-label="Verwijderen">
                  <Trash2 className="h-4 w-4" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Object archiveren?</AlertDialogTitle>
                  <AlertDialogDescription>Weet je zeker dat je {object.titel} wilt archiveren? Het verdwijnt uit de lijsten maar blijft bewaard in de database.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Archiveren</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      {/* KEY STATS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatTile label="Vraagprijs" value={formatCurrency(object.vraagprijs)} accent />
        <StatTile label="Oppervlakte" value={object.oppervlakte ? formatM2(object.oppervlakte) : '—'} />
        <StatTile label="BAR" value={barEffect != null ? formatPercent(barEffect, 2) : '—'} />
        <StatTile label="Huur / m²" value={huurPerM2 ? `€${huurPerM2}` : '—'} />
      </div>

      {/* WALT/WALB als er huurders zijn */}
      {huurMetrics && huurMetrics.aantalHuurders > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatTile label="Huurders" value={huurMetrics.aantalHuurders.toString()} />
          <StatTile label="Totale jaarhuur" value={formatCurrencyCompact(huurMetrics.totaleJaarhuur)} />
          <StatTile label="WALT" value={huurMetrics.waltJaren != null ? `${huurMetrics.waltJaren} jr` : '—'} />
          <StatTile label="WALB" value={huurMetrics.walbJaren != null ? `${huurMetrics.walbJaren} jr` : '—'} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">

          {/* OBJECTGEGEVENS */}
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title">Objectgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              {object.huurinkomsten != null && (
                <Field label="Huurinkomsten">
                  <span className="font-mono-data">{formatCurrency(object.huurinkomsten)}</span> /jr
                </Field>
              )}
              {object.nettoAanvangsrendement != null && (
                <Field label="NAR">
                  <span className="font-mono-data">{formatPercent(object.nettoAanvangsrendement, 2)}</span>
                </Field>
              )}
              {object.noi != null && (
                <Field label="NOI">
                  <span className="font-mono-data">{formatCurrency(object.noi)}</span> /jr
                </Field>
              )}
              {object.servicekostenJaar != null && (
                <Field label="Servicekosten">
                  <span className="font-mono-data">{formatCurrency(object.servicekostenJaar)}</span> /jr
                </Field>
              )}
              {object.wozWaarde != null && (
                <Field label="WOZ-waarde">
                  <span className="font-mono-data">{formatCurrency(object.wozWaarde)}</span>
                  {object.wozPeildatum && <span className="text-muted-foreground text-xs ml-1">({formatDate(object.wozPeildatum)})</span>}
                </Field>
              )}
              {object.taxatiewaarde != null && (
                <Field label="Taxatiewaarde">
                  <span className="font-mono-data">{formatCurrency(object.taxatiewaarde)}</span>
                  {object.taxatiedatum && <span className="text-muted-foreground text-xs ml-1">({formatDate(object.taxatiedatum)})</span>}
                </Field>
              )}
              <Field label="Verhuurstatus"><span className="capitalize">{object.verhuurStatus}</span></Field>
              {object.leegstandPct != null && (
                <Field label="Leegstand">
                  <span className="font-mono-data">{formatPercent(object.leegstandPct)}</span>
                </Field>
              )}
              <Field label="Bouwjaar"><span className="tabular-nums">{object.bouwjaar ?? '—'}</span></Field>
              {object.energielabelV2 && (
                <Field label="Energielabel">
                  <span className="font-semibold">{object.energielabelV2}</span>
                </Field>
              )}
              {object.onderhoudsstaatNiveau && (
                <Field label="Onderhoudsstaat">
                  {ONDERHOUDSSTAAT_LABELS[object.onderhoudsstaatNiveau]}
                </Field>
              )}
              {object.aantalVerdiepingen != null && (
                <Field label="Verdiepingen">{object.aantalVerdiepingen}</Field>
              )}
              {object.aantalUnits != null && (
                <Field label="Units">{object.aantalUnits}</Field>
              )}
              {object.huidigGebruik && (
                <Field label="Huidig gebruik">{object.huidigGebruik}</Field>
              )}
              <Field label="Ontwikkelpotentie">{object.ontwikkelPotentie ? 'Ja' : 'Nee'}</Field>
              <Field label="Transformatiepotentie">{object.transformatiePotentie ? 'Ja' : 'Nee'}</Field>
              {object.asbestinventarisatieAanwezig && (
                <Field label="Asbestinventarisatie">Aanwezig</Field>
              )}
              {object.bron && <Field label="Bron">{object.bron}</Field>}
              <Field label="Toegevoegd"><span className="tabular-nums">{formatDate(object.datumToegevoegd)}</span></Field>
            </div>

            {/* Oppervlakten extra */}
            {(object.oppervlakteVvo || object.oppervlakteBvo || object.oppervlakteGbo || object.perceelOppervlakte) && (
              <div className="hairline pt-5">
                <p className="field-label mb-2">Oppervlakten (NEN 2580)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {object.oppervlakteVvo && (
                    <div className="text-sm"><span className="text-muted-foreground">VVO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteVvo)}</span></div>
                  )}
                  {object.oppervlakteBvo && (
                    <div className="text-sm"><span className="text-muted-foreground">BVO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteBvo)}</span></div>
                  )}
                  {object.oppervlakteGbo && (
                    <div className="text-sm"><span className="text-muted-foreground">GBO:</span> <span className="font-mono-data">{formatM2(object.oppervlakteGbo)}</span></div>
                  )}
                  {object.perceelOppervlakte && (
                    <div className="text-sm"><span className="text-muted-foreground">Perceel:</span> <span className="font-mono-data">{formatM2(object.perceelOppervlakte)}</span></div>
                  )}
                </div>
              </div>
            )}

            {/* Adres - verborgen als anoniem */}
            {!object.anoniem && (object.adres || object.postcode) && (
              <div className="hairline pt-5">
                <Field label="Adres">
                  {[object.adres, object.postcode, object.plaats].filter(Boolean).join(', ')}
                </Field>
              </div>
            )}

            {/* Investeringsthese & risico's */}
            {(object.samenvatting || object.investeringsthese || object.risicos || object.onderscheidendeKenmerken || object.opmerkingen) && (
              <div className="space-y-4 hairline pt-5">
                {object.samenvatting && <Field label="Samenvatting">{object.samenvatting}</Field>}
                {object.investeringsthese && (
                  <Field label="Investeringsthese">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{object.investeringsthese}</pre>
                  </Field>
                )}
                {object.onderscheidendeKenmerken && (
                  <Field label="Onderscheidende kenmerken">{object.onderscheidendeKenmerken}</Field>
                )}
                {object.risicos && (
                  <Field label="Risico's">
                    <pre className="whitespace-pre-wrap font-sans text-sm">{object.risicos}</pre>
                  </Field>
                )}
                {object.opmerkingen && <Field label="Opmerkingen">{object.opmerkingen}</Field>}
              </div>
            )}

            {object.interneOpmerkingen && (
              <div className="bg-warning/5 border border-warning/20 rounded-md p-3.5">
                <p className="field-label text-warning">Interne opmerking</p>
                <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{object.interneOpmerkingen}</p>
              </div>
            )}
          </section>

          {/* HUURDERS */}
          {huurders.length > 0 && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title">Huurders ({huurders.length})</h2>
              <div className="space-y-2">
                {huurders.map(h => (
                  <div key={h.id} className="border border-border rounded-md p-3 bg-card/50">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{h.huurderNaam}</p>
                      {h.branche && <span className="text-xs text-muted-foreground">· {h.branche}</span>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                      {h.oppervlakteM2 != null && <span>{formatM2(h.oppervlakteM2)}</span>}
                      {h.jaarhuur != null && <span className="font-mono-data">{formatCurrency(h.jaarhuur)}/jr</span>}
                      {h.ingangsdatum && <span>Ingang: {formatDate(h.ingangsdatum)}</span>}
                      {h.einddatum && <span>Einde: {formatDate(h.einddatum)}</span>}
                      {h.opzegmogelijkheid && <span>Break: {formatDate(h.opzegmogelijkheid)}</span>}
                      {h.indexatieBasis && (
                        <span>
                          Index: {INDEXATIE_BASIS_LABELS[h.indexatieBasis]}
                          {h.indexatieBasis === 'vast_pct' && h.indexatiePct != null && ` (${h.indexatiePct}%)`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* DOCUMENTEN */}
          {documenten.length > 0 && (
            <section className="section-card p-5 sm:p-6 space-y-3">
              <h2 className="section-title">Documenten ({documenten.length})</h2>
              <div className="space-y-2">
                {documenten.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 border border-border rounded-md p-3 bg-card">
                    <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{doc.bestandsnaam}</p>
                      <p className="text-xs text-muted-foreground">
                        {DOCUMENT_TYPE_LABELS[doc.documenttype]} · {formatFileSize(doc.bestandsgrootteBytes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc.storagePath)}
                      className="p-2 hover:bg-muted rounded shrink-0"
                      aria-label="Downloaden"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* FOTO GRID */}
          {fotos.length > 1 && (
            <section className="section-card p-5 sm:p-6 space-y-3">
              <h2 className="section-title">Foto's ({fotos.length})</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {fotos.map(foto => (
                  <div key={foto.id} className="relative aspect-[4/3] bg-muted rounded-md overflow-hidden">
                    {fotoUrls[foto.storagePath] ? (
                      <img src={fotoUrls[foto.storagePath]} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full bg-muted" />
                    )}
                    {foto.isHoofdfoto && (
                      <div className="absolute top-1.5 left-1.5 bg-accent text-accent-foreground text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                        <Star className="h-2.5 w-2.5 fill-current" /> Hoofd
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* JURIDISCH / KADASTRAAL */}
          {(object.eigendomssituatie || object.erfpachtinformatie || object.bestemmingsinformatie || object.kadastraalNummer) && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title">Juridisch & kadastraal</h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {object.eigendomssituatie && <Field label="Eigendomssituatie">{object.eigendomssituatie}</Field>}
                {(object.kadastraleGemeente || object.kadastraalNummer) && (
                  <Field label="Kadaster">
                    {[object.kadastraleGemeente, object.kadastraleSectie, object.kadastraalNummer].filter(Boolean).join(' ')}
                  </Field>
                )}
                {object.erfpachtinformatie && (
                  <div className="sm:col-span-2"><Field label="Erfpacht">{object.erfpachtinformatie}</Field></div>
                )}
                {object.bestemmingsinformatie && (
                  <div className="sm:col-span-2"><Field label="Bestemming">{object.bestemmingsinformatie}</Field></div>
                )}
              </div>
            </section>
          )}

          {/* VERKOPER */}
          {(object.verkoperNaam || object.verkoperEmail || object.verkoperTelefoon) && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title">Verkoper</h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {object.verkoperNaam && (
                  <Field label="Naam">
                    {object.verkoperNaam}
                    {object.verkoperRol && <span className="text-muted-foreground"> · {object.verkoperRol}</span>}
                  </Field>
                )}
                <Field label="Via">
                  {VERKOPER_VIA_LABELS[object.verkoperVia ?? 'onbekend']}
                </Field>
                {object.verkoperTelefoon && (
                  <Field label="Telefoon">
                    <a href={`tel:${object.verkoperTelefoon}`} className="hover:text-accent inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />{object.verkoperTelefoon}
                    </a>
                  </Field>
                )}
                {object.verkoperEmail && (
                  <Field label="E-mail">
                    <a href={`mailto:${object.verkoperEmail}`} className="hover:text-accent inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />{object.verkoperEmail}
                    </a>
                  </Field>
                )}
                {object.verkoopmotivatie && (
                  <div className="sm:col-span-2"><Field label="Verkoopmotivatie">{object.verkoopmotivatie}</Field></div>
                )}
              </div>
            </section>
          )}

          {/* DEALS */}
          {deals.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Gekoppelde deals ({deals.length})</h2></header>
              <div className="divide-y divide-border/70">
                {deals.map(deal => {
                  const rel = store.getRelatieById(deal.relatieId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{rel?.bedrijfsnaam}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {deal.commissieBedrag != null && `Commissie: ${formatCurrency(deal.commissieBedrag)}`}
                          </p>
                        </div>
                        <DealFaseBadge fase={deal.fase} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div>
          <section className="section-card">
            <header className="section-header"><h2 className="section-title">Top kandidaten ({matches.length})</h2></header>
            <div className="divide-y divide-border/70">
              {matches.length === 0 && (
                <p className="px-5 py-6 text-sm text-muted-foreground">Geen matches gevonden.</p>
              )}
              {matches.slice(0, 10).map((m, i) => {
                const rel = store.getRelatieById(m.relatieId);
                return (
                  <Link key={i} to={`/relaties/${m.relatieId}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{rel?.bedrijfsnaam}</p>
                      <MatchScoreBadge score={m.score} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{m.redenen.slice(0, 2).join(' · ')}</p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <ObjectFormDialog open={editOpen} onOpenChange={setEditOpen} object={object} />
    </div>
  );
}
