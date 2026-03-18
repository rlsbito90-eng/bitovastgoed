import { useParams, Link } from 'react-router-dom';
import { getDealById, getRelatieById, getObjectById, formatCurrency, formatDate } from '@/data/mock-data';
import { DealFaseBadge, LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';
import { ArrowLeft } from 'lucide-react';

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const deal = getDealById(id!);

  if (!deal) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Deal niet gevonden.</p>
        <Link to="/deals" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar deals</Link>
      </div>
    );
  }

  const relatie = getRelatieById(deal.relatieId);
  const object = getObjectById(deal.objectId);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 fade-in">
      <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Deals
      </Link>

      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-foreground">{object?.titel || 'Deal'}</h1>
          <DealFaseBadge fase={deal.fase} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {relatie?.bedrijfsnaam} · {object?.plaats}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Info */}
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Dealgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Dealfase</span><p className="text-foreground capitalize">{deal.fase}</p></div>
              <div><span className="text-muted-foreground">Interessegraad</span><p className="text-foreground">{'★'.repeat(deal.interessegraad)}{'☆'.repeat(5 - deal.interessegraad)}</p></div>
              <div><span className="text-muted-foreground">Eerste contact</span><p className="text-foreground">{formatDate(deal.datumEersteContact)}</p></div>
              <div><span className="text-muted-foreground">Follow-up</span><p className="text-foreground">{deal.datumFollowUp ? formatDate(deal.datumFollowUp) : '—'}</p></div>
              {deal.bezichtigingGepland && <div><span className="text-muted-foreground">Bezichtiging</span><p className="text-foreground">{formatDate(deal.bezichtigingGepland)}</p></div>}
              {deal.indicatiefBod && <div><span className="text-muted-foreground">Indicatief bod</span><p className="text-foreground font-mono-data">{formatCurrency(deal.indicatiefBod)}</p></div>}
            </div>
            {deal.notities && (
              <div><span className="text-xs text-muted-foreground">Notities</span><p className="text-sm text-foreground mt-1">{deal.notities}</p></div>
            )}
          </div>

          {/* Object card */}
          {object && (
            <Link to={`/objecten/${object.id}`} className="block bg-card border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-foreground">Gekoppeld object</h2>
                <ObjectStatusBadge status={object.status} />
              </div>
              <p className="text-foreground font-medium">{object.titel}</p>
              <p className="text-sm text-muted-foreground">{object.plaats}, {object.provincie}</p>
              <div className="flex gap-6 mt-3 text-sm">
                <div><span className="text-muted-foreground">Prijs</span><p className="font-mono-data text-foreground">{formatCurrency(object.vraagprijs)}</p></div>
                <div><span className="text-muted-foreground">Oppervlakte</span><p className="font-mono-data text-foreground">{object.oppervlakte?.toLocaleString('nl-NL')} m²</p></div>
              </div>
            </Link>
          )}
        </div>

        {/* Sidebar: Relatie */}
        <div>
          {relatie && (
            <Link to={`/relaties/${relatie.id}`} className="block bg-card border border-border rounded-lg p-5 hover:border-accent/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-foreground">Relatie</h2>
                <LeadStatusBadge status={relatie.leadStatus} />
              </div>
              <p className="text-foreground font-medium">{relatie.bedrijfsnaam}</p>
              <p className="text-sm text-muted-foreground">{relatie.contactpersoon}</p>
              <p className="text-sm text-muted-foreground mt-2">{relatie.telefoon}</p>
              <p className="text-sm text-muted-foreground">{relatie.email}</p>
              {relatie.budgetMax && (
                <p className="text-sm font-mono-data text-muted-foreground mt-2">Budget: {formatCurrency(relatie.budgetMin)} – {formatCurrency(relatie.budgetMax)}</p>
              )}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
