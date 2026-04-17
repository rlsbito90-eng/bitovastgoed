import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { Input } from '@/components/ui/input';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ZoekprofielFormDialog from '@/components/forms/ZoekprofielFormDialog';
import type { Zoekprofiel } from '@/data/mock-data';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export default function ZoekprofielenPage() {
  const { zoekprofielen, getRelatieById, deleteZoekprofiel } = useDataStore();
  const [zoek, setZoek] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Zoekprofiel | null>(null);

  const filtered = zoekprofielen.filter(z => {
    const rel = getRelatieById(z.relatieId);
    return !zoek || z.naam.toLowerCase().includes(zoek.toLowerCase()) || rel?.bedrijfsnaam.toLowerCase().includes(zoek.toLowerCase());
  });

  const openNieuw = () => { setEditing(null); setFormOpen(true); };
  const openBewerk = (z: Zoekprofiel) => { setEditing(z); setFormOpen(true); };
  const handleDelete = async (id: string) => {
    await deleteZoekprofiel(id);
    toast.success('Zoekprofiel verwijderd');
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Zoekprofielen</h1>
          <p className="text-sm text-muted-foreground mt-1">{zoekprofielen.length} zoekprofielen</p>
        </div>
        <button onClick={openNieuw} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/90 transition-colors">
          <Plus className="h-4 w-4" /> Nieuw zoekprofiel
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Zoek op profiel of relatie..." className="pl-9" value={zoek} onChange={e => setZoek(e.target.value)} />
      </div>

      {filtered.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-sm text-muted-foreground">
            {zoekprofielen.length === 0
              ? 'Nog geen zoekprofielen aangemaakt. Klik op "Nieuw zoekprofiel" om er een toe te voegen.'
              : 'Geen zoekprofielen gevonden voor deze zoekopdracht.'}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(zp => {
          const rel = getRelatieById(zp.relatieId);
          return (
            <div key={zp.id} className="bg-card border border-border rounded-lg p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{zp.naam}</p>
                  <Link to={`/relaties/${zp.relatieId}`} className="text-xs text-accent hover:underline">{rel?.bedrijfsnaam}</Link>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className={zp.status === 'actief' ? 'bg-success/15 text-success border-success/20' : 'bg-muted text-muted-foreground'}>
                    {zp.status}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {zp.typeVastgoed.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs capitalize">{t}</Badge>
                ))}
              </div>
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Regio: <span className="text-foreground">{zp.regio.join(', ') || '—'}</span></p>
                {zp.prijsMax && <p className="text-muted-foreground">Budget: <span className="text-foreground font-mono-data">{formatCurrency(zp.prijsMin)} – {formatCurrency(zp.prijsMax)}</span></p>}
                {zp.oppervlakteMin && <p className="text-muted-foreground">Min. oppervlakte: <span className="text-foreground font-mono-data">{zp.oppervlakteMin.toLocaleString('nl-NL')} m²</span></p>}
                {zp.rendementseis && <p className="text-muted-foreground">Rendement eis: <span className="text-foreground font-mono-data">≥ {zp.rendementseis}%</span></p>}
              </div>
              {(zp.ontwikkelPotentie || zp.transformatiePotentie) && (
                <div className="flex gap-2">
                  {zp.ontwikkelPotentie && <Badge variant="outline" className="text-xs">Ontwikkeling</Badge>}
                  {zp.transformatiePotentie && <Badge variant="outline" className="text-xs">Transformatie</Badge>}
                </div>
              )}
              <div className="flex items-center gap-1 pt-2 border-t border-border">
                <button onClick={() => openBewerk(zp)} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
                  <Pencil className="h-3 w-3" /> Bewerken
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors">
                      <Trash2 className="h-3 w-3" /> Verwijder
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zoekprofiel verwijderen?</AlertDialogTitle>
                      <AlertDialogDescription>Weet je zeker dat je {zp.naam} wilt verwijderen?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(zp.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </div>

      <ZoekprofielFormDialog open={formOpen} onOpenChange={setFormOpen} zoekprofiel={editing} />
    </div>
  );
}
