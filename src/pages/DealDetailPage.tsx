import { useState, ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatEurPerM2,
  DEAL_FASE_LABELS,
  DD_STATUS_LABELS,
  FASE_KANS,
} from '@/data/mock-data';
import { DealFaseBadge, LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';
import {
  ArrowLeft, Pencil, Trash2, Star, Trophy, AlertCircle,
  Building2, Landmark, Users as UsersIcon,
} from 'lucide-react';
import DealFormDialog from '@/components/forms/DealFormDialog';
import DealPdfButton from '@/components/pdf/DealPdfButton';
import DealObjectenSectie from '@/components/deal/DealObjectenSectie';
import DealKandidatenSectie from '@/components/deal/DealKandidatenSectie';
import DealReferentieAnalyseSectie from '@/components/deal/DealReferentieAnalyseSectie';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="field-label">{label}</p>
      <div className="text-sm text-foreground mt-1 break-words">{children}</div>
    </div>
  );
}

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const deal = store.getDealById(id!);
  const [editOpen, setEditOpen] = useState(false);

  if (!deal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Deal niet gevonden.</p>
        <Link to="/deals" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar deals</Link>
      </div>
    );
  }

  const relatie = store.getRelatieById(deal.relatieId);
  const object = store.getObjectById(deal.objectId);
  const isAfgerond = deal.fase === 'afgerond';
  const isAfgevallen = deal.fase === 'afgevallen';
  const gewogenCommissie = deal.commissieBedrag != null
    ? deal.commissieBedrag * (FASE_KANS[deal.fase] ?? 0)
    : null;

  const handleDelete = async () => {
    try {
      await store.deleteDeal(deal.id);
      toast.success('Deal gearchiveerd');
      navigate('/deals');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <div className="page-shell-narrow">
      <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Deals
      </Link>

      <div className="flex flex-col gap-3 min-w-0">
        <div className="flex flex-wrap justify-end gap-2">
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Pencil className="h-4 w-4" /> Bewerken
          </button>
          {object && relatie && (
            <DealPdfButton deal={deal} object={object} relatie={relatie} />
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center justify-center px-2.5 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive" aria-label="Verwijderen">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Deal archiveren?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je deze deal wilt archiveren?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Archiveren</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight break-words">
            {object?.titel || 'Deal'}
          </h1>
          <div className="mt-2">
            <DealFaseBadge fase={deal.fase} />
          </div>
          <p className="text-sm text-muted-foreground mt-1.5 break-words">
            {relatie?.bedrijfsnaam} · {object?.plaats}
          </p>
        </div>
      </div>

      {/* Banner: gefeliciteerd of afgevallen */}
      {isAfgerond && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-md p-4 flex items-start gap-3">
          <Trophy className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">Deal afgerond — gefeliciteerd!</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {deal.commissieBedrag != null
                ? `Goed voor ${formatCurrency(deal.commissieBedrag)} commissie. Telt mee in je gerealiseerde commissie op het dashboard.`
                : 'Vul de commissie in via Bewerken om hem mee te tellen op het dashboard.'}
            </p>
          </div>
        </div>
      )}
      {isAfgevallen && (
        <div className="bg-muted/40 border border-border rounded-md p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-foreground">Deal afgevallen</p>
            {deal.afwijzingsreden ? (
              <p className="text-sm text-muted-foreground mt-0.5">Reden: {deal.afwijzingsreden}</p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">Vul de afwijzingsreden in via Bewerken — handig voor toekomstige analyse.</p>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
        <div className="lg:col-span-2 space-y-4 lg:space-y-6">
          {/* DEAL CORE */}
          <section className="section-card p-5 sm:p-6 space-y-5">
            <h2 className="section-title">Dealgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Dealfase">{DEAL_FASE_LABELS[deal.fase]}</Field>
              <Field label="Interessegraad">
                <span className="inline-flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < deal.interessegraad ? 'fill-accent text-accent' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </span>
              </Field>
              <Field label="Eerste contact">
                <span className="tabular-nums">{formatDate(deal.datumEersteContact)}</span>
              </Field>
              <Field label="Follow-up">
                <span className="tabular-nums">{deal.datumFollowUp ? formatDate(deal.datumFollowUp) : '—'}</span>
              </Field>
              {deal.bezichtigingGepland && (
                <Field label="Bezichtiging">
                  <span className="tabular-nums">{formatDate(deal.bezichtigingGepland)}</span>
                </Field>
              )}
              {deal.verwachteClosingdatum && (
                <Field label="Verwachte closing">
                  <span className="tabular-nums">{formatDate(deal.verwachteClosingdatum)}</span>
                </Field>
              )}
              {deal.indicatiefBod != null && (
                <Field label="Indicatief bod">
                  <div className="space-y-0.5">
                    <span className="font-mono-data">{formatCurrency(deal.indicatiefBod)}</span>
                    {object && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {(object.oppervlakteVvo ?? object.oppervlakte) && (
                          <p>
                            Bod / m²:{' '}
                            <span className="font-mono-data">
                              {formatEurPerM2(deal.indicatiefBod, object.oppervlakteVvo ?? object.oppervlakte)}
                            </span>
                          </p>
                        )}
                        {object.vraagprijs && (
                          <p>
                            <span className="font-mono-data">
                              {Math.round((deal.indicatiefBod / object.vraagprijs - 1) * 100)}%
                            </span>{' '}
                            t.o.v. vraagprijs ({formatCurrency(object.vraagprijs)})
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </Field>
              )}
            </div>
          </section>

          {/* COMMISSIE */}
          {(deal.commissiePct != null || deal.commissieBedrag != null || deal.feeStructuur) && (
            <section className={`section-card p-5 sm:p-6 space-y-4 ${isAfgerond ? 'border-green-500/30' : ''}`}>
              <h2 className="section-title flex items-center gap-2">
                <Landmark className="h-4 w-4 text-accent" /> Commissie
              </h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {deal.commissiePct != null && (
                  <div className="p-3 bg-muted/40 rounded-md">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Percentage</p>
                    <p className="text-base font-semibold font-mono-data mt-0.5">{deal.commissiePct}%</p>
                  </div>
                )}
                {deal.commissieBedrag != null && (
                  <div className={`p-3 rounded-md ${isAfgerond ? 'bg-green-500/10 border border-green-500/30' : 'bg-muted/40'}`}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {isAfgerond ? 'Gerealiseerd' : 'Bedrag (verwacht)'}
                    </p>
                    <p className={`text-base font-semibold font-mono-data mt-0.5 ${isAfgerond ? 'text-green-700 dark:text-green-400' : ''}`}>
                      {formatCurrency(deal.commissieBedrag)}
                    </p>
                  </div>
                )}
                {gewogenCommissie != null && !isAfgerond && !isAfgevallen && (
                  <div className="p-3 bg-muted/40 rounded-md">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Gewogen ({Math.round((FASE_KANS[deal.fase] ?? 0) * 100)}%)
                    </p>
                    <p className="text-base font-semibold font-mono-data mt-0.5">
                      {formatCurrencyCompact(gewogenCommissie)}
                    </p>
                  </div>
                )}
              </div>
              {deal.feeStructuur && (
                <Field label="Fee-structuur">{deal.feeStructuur}</Field>
              )}
            </section>
          )}

          {/* PROCES / DD */}
          {(deal.ddStatus || deal.notaris || deal.bank || deal.tegenpartijMakelaar) && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title">Proces & partijen</h2>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                {deal.ddStatus && deal.ddStatus !== 'niet_gestart' && (
                  <Field label="Due diligence status">
                    {DD_STATUS_LABELS[deal.ddStatus]}
                  </Field>
                )}
                {deal.notaris && <Field label="Notaris">{deal.notaris}</Field>}
                {deal.bank && <Field label="Bank">{deal.bank}</Field>}
                {deal.tegenpartijMakelaar && (
                  <Field label="Tegenpartij makelaar">{deal.tegenpartijMakelaar}</Field>
                )}
              </div>
            </section>
          )}

          {/* NOTITIES */}
          {(deal.notities || (isAfgevallen && deal.afwijzingsreden)) && (
            <section className="section-card p-5 sm:p-6 space-y-4">
              <h2 className="section-title">Notities</h2>
              {isAfgevallen && deal.afwijzingsreden && (
                <Field label="Afwijzingsreden">
                  <p className="whitespace-pre-wrap">{deal.afwijzingsreden}</p>
                </Field>
              )}
              {deal.notities && (
                <Field label="Algemeen">
                  <p className="whitespace-pre-wrap">{deal.notities}</p>
                </Field>
              )}
            </section>
          )}

          {/* PRIMAIR OBJECT */}
          {object && (
            <Link to={`/objecten/${object.id}`} className="block section-card p-5 sm:p-6 hover:border-accent/40 transition-colors">
              <div className="flex items-center justify-between mb-3 gap-3">
                <h2 className="section-title flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> Primair object
                </h2>
                <ObjectStatusBadge status={object.status} />
              </div>
              <p className="text-foreground font-medium truncate">{object.titel}</p>
              <p className="text-sm text-muted-foreground truncate">
                {object.anoniem ? (object.publiekeRegio ?? object.provincie) : `${object.plaats}, ${object.provincie}`}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <Field label="Prijs"><span className="font-mono-data">{formatCurrency(object.vraagprijs)}</span></Field>
                <Field label="Oppervlakte"><span className="font-mono-data">{object.oppervlakte?.toLocaleString('nl-NL') ?? '—'} m²</span></Field>
              </div>
            </Link>
          )}

          <DealObjectenSectie dealId={deal.id} primairObjectId={deal.objectId} />
          <DealKandidatenSectie dealId={deal.id} primaireRelatieId={deal.relatieId} />
          <DealReferentieAnalyseSectie dealId={deal.id} objectM2={object?.oppervlakte} />
        </div>

        {/* SIDEBAR */}
        <div>
          {relatie && (
            <Link to={`/relaties/${relatie.id}`} className="block section-card p-5 sm:p-6 hover:border-accent/40 transition-colors space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title flex items-center gap-2">
                  <UsersIcon className="h-4 w-4 text-muted-foreground" /> Primaire relatie
                </h2>
                <LeadStatusBadge status={relatie.leadStatus} />
              </div>
              <div>
                <p className="text-foreground font-medium truncate">{relatie.bedrijfsnaam}</p>
                {relatie.investeerderSubtype && (
                  <p className="text-xs text-muted-foreground capitalize">{relatie.investeerderSubtype.replace('_', ' ')}</p>
                )}
              </div>
              <div className="text-sm space-y-1 hairline pt-3">
                {relatie.telefoon && <p className="text-muted-foreground truncate">{relatie.telefoon}</p>}
                {relatie.email && <p className="text-muted-foreground truncate">{relatie.email}</p>}
                {(relatie.budgetMin || relatie.budgetMax) && (
                  <p className="font-mono-data text-muted-foreground pt-1">
                    Budget: {formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}
                  </p>
                )}
                {relatie.ndaGetekend && (
                  <p className="text-xs text-green-600 dark:text-green-400 pt-1">✓ NDA getekend</p>
                )}
              </div>
            </Link>
          )}
        </div>
      </div>

      <DealFormDialog open={editOpen} onOpenChange={setEditOpen} deal={deal} />
    </div>
  );
}
