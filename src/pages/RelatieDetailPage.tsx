import { useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  getMatchesForRelatieFromData,
  formatCurrency,
  formatDate,
  ASSET_CLASS_LABELS,
  INVESTEERDER_SUBTYPE_LABELS,
  KAPITAAL_SITUATIE_LABELS,
  COMMUNICATIE_KANAAL_LABELS,
} from '@/data/mock-data';
import {
  LeadStatusBadge, DealFaseBadge, MatchScoreBadge, PrioriteitBadge,
} from '@/components/StatusBadges';
import {
  ArrowLeft, Phone, Mail, Pencil, Trash2, Plus,
  ShieldCheck, Linkedin, Globe, Star, Building2, Users,
} from 'lucide-react';
import RelatieFormDialog from '@/components/forms/RelatieFormDialog';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
import { ClassificatieRij, PropertyTypeBadges, SubtypeBadges, DealtypeBadges } from '@/components/TaxonomieBadges';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const DEALSTRUCTUUR_LABELS: Record<string, string> = {
  direct: 'Direct eigendom',
  jv: 'JV',
  fonds: 'Fonds',
  asset_deal: 'Asset deal',
  share_deal: 'Share deal',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="text-sm text-foreground mt-1 break-words">{children}</div>
    </div>
  );
}

export default function RelatieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const relatie = store.getRelatieById(id!);
  const [editOpen, setEditOpen] = useState(false);
  const [zpOpen, setZpOpen] = useState(false);

  if (!relatie) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Relatie niet gevonden.</p>
        <Link to="/relaties" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar relaties</Link>
      </div>
    );
  }

  const contactpersonen = store.getContactpersonenVoorRelatie(relatie.id);
  const zoekprofielen = store.getZoekprofielenByRelatie(relatie.id);
  const deals = store.getDealsByRelatie(relatie.id);
  const taken = store.getTakenByRelatie(relatie.id);
  const matches = getMatchesForRelatieFromData(relatie.id, store.zoekprofielen, store.objecten);

  const handleDelete = async () => {
    try {
      await store.deleteRelatie(relatie.id);
      toast.success('Relatie verwijderd');
      navigate('/relaties');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const subtypeLabel = relatie.investeerderSubtype
    ? INVESTEERDER_SUBTYPE_LABELS[relatie.investeerderSubtype]
    : null;

  return (
    <div className="page-shell-narrow">
      <Link to="/relaties" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Relaties
      </Link>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap justify-end gap-2">
          {relatie.telefoon && (
            <a href={`tel:${relatie.telefoon}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Phone className="h-4 w-4" /> Bel
            </a>
          )}
          {relatie.email && (
            <a href={`mailto:${relatie.email}`} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Mail className="h-4 w-4" /> Mail
            </a>
          )}
          {relatie.website && (
            <a href={relatie.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Globe className="h-4 w-4" />
            </a>
          )}
          {relatie.linkedinUrl && (
            <a href={relatie.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
              <Linkedin className="h-4 w-4" />
            </a>
          )}
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
                <AlertDialogTitle>Relatie verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je {relatie.bedrijfsnaam} wilt verwijderen? De relatie wordt gearchiveerd en is later terug te halen via de database.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight break-words">
            {relatie.bedrijfsnaam}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <LeadStatusBadge status={relatie.leadStatus} />
            {relatie.ndaGetekend && (
              <span className="inline-flex items-center gap-1 text-xs bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" /> NDA getekend
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 capitalize break-words">
            {relatie.type}
            {subtypeLabel && ` · ${subtypeLabel}`}
            {relatie.kvkNummer && ` · KVK ${relatie.kvkNummer}`}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6 min-w-0">

          {/* CONTACTPERSONEN */}
          <section className="section-card p-5 sm:p-6 space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Contactpersonen ({contactpersonen.length})
            </h2>
            {contactpersonen.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Nog geen contactpersonen toegevoegd. Voeg ze toe via Bewerken → tab Contact.
              </p>
            ) : (
              <div className="space-y-2">
                {contactpersonen.map(c => (
                  <div key={c.id} className="border border-border rounded-md p-3 bg-card/50 min-w-0">
                    <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
                      <p className="font-medium text-foreground break-words min-w-0">{c.naam}</p>
                      {c.functie && <span className="text-xs text-muted-foreground break-words">· {c.functie}</span>}
                      {c.isPrimair && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-accent/20 text-accent px-2 py-0.5 rounded-full whitespace-nowrap">
                          <Star className="h-2.5 w-2.5 fill-current" /> Primair
                        </span>
                      )}
                      {c.decisionMaker && (
                        <span className="text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                          Decision maker
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground min-w-0">
                      {c.email && <a href={`mailto:${c.email}`} className="hover:text-foreground break-all">{c.email}</a>}
                      {c.telefoon && <a href={`tel:${c.telefoon}`} className="hover:text-foreground break-all">{c.telefoon}</a>}
                      {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">LinkedIn</a>}
                      {c.voorkeurKanaal && <span>Voorkeur: {COMMUNICATIE_KANAAL_LABELS[c.voorkeurKanaal]}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* VASTGOEDVOORKEUREN — nieuwe taxonomie */}
          <section className="section-card p-5 sm:p-6 space-y-4">
            <h2 className="section-title">Vastgoedvoorkeuren</h2>
            <ClassificatieRij
              propertyTypeIds={(relatie as any).propertyTypeIds}
              fallbackAssetClasses={relatie.assetClasses}
              subtypeIds={(relatie as any).propertySubtypeIds}
              dealTypeIds={(relatie as any).dealTypeIds}
              mode="multi"
            />
          </section>

          {/* PROFIEL & VOORKEUREN */}
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title">Investeerdersprofiel</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Regio's">
                {relatie.regio.length ? relatie.regio.join(', ') : '—'}
              </Field>
              {(relatie.budgetMin || relatie.budgetMax) && (
                <Field label="Budget">
                  <span className="font-mono-data">
                    {formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}
                  </span>
                </Field>
              )}
              {relatie.rendementseis != null && (
                <Field label="Rendementseis">
                  <span className="font-mono-data">{relatie.rendementseis}%</span>
                </Field>
              )}
              {relatie.kapitaalsituatie && relatie.kapitaalsituatie !== 'onbekend' && (
                <Field label="Kapitaalsituatie">
                  {KAPITAAL_SITUATIE_LABELS[relatie.kapitaalsituatie]}
                  {relatie.eigenVermogenPct != null && ` · ${relatie.eigenVermogenPct}% EV`}
                </Field>
              )}
              {relatie.voorkeurDealstructuur && relatie.voorkeurDealstructuur.length > 0 && (
                <Field label="Voorkeur dealstructuur">
                  {relatie.voorkeurDealstructuur.map(s => DEALSTRUCTUUR_LABELS[s] ?? s).join(', ')}
                </Field>
              )}
              {relatie.ndaGetekend && relatie.ndaDatum && (
                <Field label="NDA getekend op">
                  {formatDate(relatie.ndaDatum)}
                </Field>
              )}
              <Field label="Laatste contact">
                <span className="tabular-nums">{formatDate(relatie.laatsteContact)}</span>
              </Field>
              {relatie.bronRelatie && (
                <Field label="Bron relatie">{relatie.bronRelatie}</Field>
              )}
              {relatie.voorkeurKanaal && (
                <Field label="Voorkeur kanaal">
                  {COMMUNICATIE_KANAAL_LABELS[relatie.voorkeurKanaal]}
                  {relatie.voorkeurTaal && relatie.voorkeurTaal !== 'nl' && ` · ${relatie.voorkeurTaal.toUpperCase()}`}
                </Field>
              )}
            </div>

            {(relatie.aankoopcriteria || relatie.verkoopintentie || relatie.notities || relatie.volgendeActie) && (
              <div className="space-y-4 hairline pt-5">
                {relatie.volgendeActie && <Field label="Volgende actie">{relatie.volgendeActie}</Field>}
                {relatie.aankoopcriteria && <Field label="Aankoopcriteria">{relatie.aankoopcriteria}</Field>}
                {relatie.verkoopintentie && <Field label="Verkoopintentie">{relatie.verkoopintentie}</Field>}
                {relatie.notities && <Field label="Notities">{relatie.notities}</Field>}
              </div>
            )}
          </section>

          {/* VESTIGING (apart blok) */}
          {(relatie.vestigingsadres || relatie.vestigingsplaats) && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Vestigingsgegevens
              </h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                <Field label="Adres">
                  {relatie.vestigingsadres ?? '—'}
                </Field>
                <Field label="Postcode + plaats">
                  {[relatie.vestigingspostcode, relatie.vestigingsplaats].filter(Boolean).join(' ') || '—'}
                </Field>
                <Field label="Land">
                  {relatie.vestigingsland ?? 'NL'}
                </Field>
              </div>
            </section>
          )}

          {/* DEALS */}
          {deals.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Gekoppelde deals ({deals.length})</h2></header>
              <div className="divide-y divide-border/70">
                {deals.map(deal => {
                  const obj = store.getObjectById(deal.objectId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {obj?.plaats} · <span className="font-mono-data">{formatCurrency(obj?.vraagprijs)}</span>
                            {deal.commissieBedrag != null && ` · commissie ${formatCurrency(deal.commissieBedrag)}`}
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

          {/* TAKEN */}
          {taken.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Open taken ({taken.length})</h2></header>
              <div className="divide-y divide-border/70">
                {taken.map(taak => (
                  <div key={taak.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{taak.titel}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatDate(taak.deadline)}</p>
                    </div>
                    <PrioriteitBadge prioriteit={taak.prioriteit} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-4 lg:space-y-6 min-w-0">
          <section className="section-card">
            <header className="section-header">
              <h2 className="section-title">Zoekprofielen ({zoekprofielen.length})</h2>
              <button onClick={() => setZpOpen(true)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80">
                <Plus className="h-3 w-3" /> Nieuw
              </button>
            </header>
            <div className="divide-y divide-border/70">
              {zoekprofielen.length === 0 && (
                <p className="px-5 py-6 text-xs text-muted-foreground">Nog geen zoekprofielen.</p>
              )}
              {zoekprofielen.map(zp => (
                <div key={zp.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-foreground truncate flex-1">{zp.naam}</p>
                    <span className="text-[10px] uppercase tracking-wider bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                      P{zp.prioriteit}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize truncate">
                    {zp.typeVastgoed.map(t => ASSET_CLASS_LABELS[t]).join(', ')}
                    {zp.regio.length > 0 && ` · ${zp.regio.join(', ')}`}
                  </p>
                  {zp.prijsMax && (
                    <p className="text-xs text-muted-foreground font-mono-data mt-0.5">
                      {formatCurrency(zp.prijsMin)} – {formatCurrency(zp.prijsMax)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {matches.length > 0 && (
            <section className="section-card">
              <header className="section-header"><h2 className="section-title">Matchende objecten ({matches.length})</h2></header>
              <div className="divide-y divide-border/70">
                {matches.slice(0, 5).map((m, i) => {
                  const obj = store.getObjectById(m.objectId);
                  return (
                    <Link key={i} to={`/objecten/${m.objectId}`} className="block px-5 py-3.5 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate">{obj?.titel}</p>
                          <p className="text-xs text-muted-foreground truncate">{obj?.plaats}</p>
                        </div>
                        <MatchScoreBadge score={m.score} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      <RelatieFormDialog open={editOpen} onOpenChange={setEditOpen} relatie={relatie} />
      <ZoekprofielFormDialog open={zpOpen} onOpenChange={setZpOpen} defaultRelatieId={relatie.id} />
    </div>
  );
}
