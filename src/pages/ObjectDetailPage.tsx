import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { getMatchesForObjectFromData, formatCurrency, formatDate } from '@/data/mock-data';
import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';
import { ArrowLeft, MapPin, Pencil, Trash2 } from 'lucide-react';
import ObjectFormDialog from '@/components/forms/ObjectFormDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function ObjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const store = useDataStore();
  const object = store.getObjectById(id!);
  const [editOpen, setEditOpen] = useState(false);

  if (!object) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Object niet gevonden.</p>
        <Link to="/objecten" className="text-accent hover:underline text-sm mt-2 inline-block">← Terug naar objecten</Link>
      </div>
    );
  }

  const deals = store.getDealsByObject(object.id);
  const matches = getMatchesForObjectFromData(object, store.zoekprofielen);
  const rendement = object.huurinkomsten && object.vraagprijs ? ((object.huurinkomsten / object.vraagprijs) * 100).toFixed(1) : null;
  const huurPerM2 = object.huurinkomsten && object.oppervlakte ? Math.round(object.huurinkomsten / object.oppervlakte) : null;

  const handleDelete = () => {
    store.deleteObject(object.id);
    toast.success('Object verwijderd');
    navigate('/objecten');
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 fade-in">
      <Link to="/objecten" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Objecten
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground">{object.titel}</h1>
            <ObjectStatusBadge status={object.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> {object.plaats}, {object.provincie} · {object.type}
          </p>
        </div>
        <div className="flex gap-2">
          {object.exclusief && (
            <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium border border-accent/20 text-accent rounded-md bg-accent/5">
              Exclusief
            </span>
          )}
          <button onClick={() => setEditOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors text-foreground">
            <Pencil className="h-4 w-4" /> Bewerken
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Object verwijderen?</AlertDialogTitle>
                <AlertDialogDescription>Weet je zeker dat je {object.titel} wilt verwijderen?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Vraagprijs</p>
          <p className="text-xl font-semibold font-mono-data text-foreground mt-1">{formatCurrency(object.vraagprijs)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Oppervlakte</p>
          <p className="text-xl font-semibold font-mono-data text-foreground mt-1">{object.oppervlakte ? `${object.oppervlakte.toLocaleString('nl-NL')} m²` : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">BAR</p>
          <p className="text-xl font-semibold font-mono-data text-foreground mt-1">{rendement ? `${rendement}%` : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">Huur/m²</p>
          <p className="text-xl font-semibold font-mono-data text-foreground mt-1">{huurPerM2 ? `€${huurPerM2}` : '—'}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Objectgegevens</h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Huurinkomsten</span><p className="text-foreground font-mono-data">{formatCurrency(object.huurinkomsten)} /jr</p></div>
              <div><span className="text-muted-foreground">Aantal huurders</span><p className="text-foreground">{object.aantalHuurders ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Verhuurstatus</span><p className="text-foreground capitalize">{object.verhuurStatus}</p></div>
              <div><span className="text-muted-foreground">Bouwjaar</span><p className="text-foreground">{object.bouwjaar ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Onderhoudsstaat</span><p className="text-foreground">{object.onderhoudsstaat ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Bron</span><p className="text-foreground">{object.bron ?? '—'}</p></div>
              <div><span className="text-muted-foreground">Ontwikkelpotentie</span><p className="text-foreground">{object.ontwikkelPotentie ? 'Ja' : 'Nee'}</p></div>
              <div><span className="text-muted-foreground">Transformatiepotentie</span><p className="text-foreground">{object.transformatiePotentie ? 'Ja' : 'Nee'}</p></div>
              <div><span className="text-muted-foreground">Documenten beschikbaar</span><p className="text-foreground">{object.documentenBeschikbaar ? 'Ja' : 'Nee'}</p></div>
              <div><span className="text-muted-foreground">Datum toegevoegd</span><p className="text-foreground">{formatDate(object.datumToegevoegd)}</p></div>
            </div>
            {object.samenvatting && (
              <div><span className="text-xs text-muted-foreground">Samenvatting</span><p className="text-sm text-foreground mt-1">{object.samenvatting}</p></div>
            )}
            {object.interneOpmerkingen && (
              <div className="bg-warning/5 border border-warning/10 rounded-md p-3">
                <span className="text-xs text-warning font-medium">Interne opmerking</span>
                <p className="text-sm text-foreground mt-1">{object.interneOpmerkingen}</p>
              </div>
            )}
          </div>

          {deals.length > 0 && (
            <div className="bg-card border border-border rounded-lg">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">Gekoppelde deals ({deals.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {deals.map(deal => {
                  const rel = store.getRelatieById(deal.relatieId);
                  return (
                    <Link key={deal.id} to={`/deals/${deal.id}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-foreground">{rel?.bedrijfsnaam}</p>
                          <p className="text-xs text-muted-foreground">{rel?.contactpersoon}</p>
                        </div>
                        <DealFaseBadge fase={deal.fase} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="bg-card border border-border rounded-lg">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Top kandidaten ({matches.length})</h2>
            </div>
            <div className="divide-y divide-border">
              {matches.length === 0 && (
                <p className="px-5 py-4 text-sm text-muted-foreground">Geen matches gevonden.</p>
              )}
              {matches.slice(0, 10).map((m, i) => {
                const rel = store.getRelatieById(m.relatieId);
                return (
                  <Link key={i} to={`/relaties/${m.relatieId}`} className="block px-5 py-3 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground">{rel?.bedrijfsnaam}</p>
                      <MatchScoreBadge score={m.score} />
                    </div>
                    <p className="text-xs text-muted-foreground">{m.redenen.slice(0, 2).join(' · ')}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <ObjectFormDialog open={editOpen} onOpenChange={setEditOpen} object={object} />
    </div>
  );
}
