import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import type { KandidaatStatus } from '@/data/mock-data';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  primaireRelatieId: string;
}

const STATUS_LABELS: Record<KandidaatStatus, string> = {
  geinteresseerd: 'Geïnteresseerd',
  bezichtiging: 'Bezichtiging',
  bod: 'Bod',
  gewonnen: 'Gewonnen',
  afgevallen: 'Afgevallen',
};

const STATUS_KLEUREN: Record<KandidaatStatus, string> = {
  geinteresseerd: 'bg-muted text-foreground',
  bezichtiging: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  bod: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  gewonnen: 'bg-success/10 text-success',
  afgevallen: 'bg-muted text-muted-foreground line-through',
};

export default function DealKandidatenSectie({ dealId, primaireRelatieId }: Props) {
  const { relaties, getKandidatenVoorDeal, addDealKandidaat, updateDealKandidaat, removeDealKandidaat, getRelatieById } = useDataStore();
  const [adding, setAdding] = useState(false);
  const [keuze, setKeuze] = useState('');

  const kandidaten = getKandidatenVoorDeal(dealId);
  const gebruikteIds = new Set([primaireRelatieId, ...kandidaten.map(k => k.relatieId)]);
  const beschikbareRelaties = relaties.filter(r => !gebruikteIds.has(r.id));

  const handleAdd = async () => {
    if (!keuze) return;
    try {
      await addDealKandidaat(dealId, keuze, 'geinteresseerd');
      toast.success('Kandidaat toegevoegd');
      setKeuze('');
      setAdding(false);
    } catch (err: any) {
      toast.error(`Toevoegen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handleStatus = async (id: string, status: KandidaatStatus) => {
    try {
      await updateDealKandidaat(id, { status });
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeDealKandidaat(id);
      toast.success('Kandidaat verwijderd');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Kandidaten</h2>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={beschikbareRelaties.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Kandidaat toevoegen
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="flex-1 h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={keuze}
            onChange={e => setKeuze(e.target.value)}
          >
            <option value="">— Kies relatie —</option>
            {beschikbareRelaties.map(r => (
              <option key={r.id} value={r.id}>{r.bedrijfsnaam || '(geen naam)'}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAdd} disabled={!keuze}>Toevoegen</Button>
            <Button type="button" variant="outline" onClick={() => { setAdding(false); setKeuze(''); }}>Annuleer</Button>
          </div>
        </div>
      )}

      {kandidaten.length === 0 ? (
        <p className="text-sm text-muted-foreground">Geen extra kandidaten. De primaire relatie is hieronder zichtbaar.</p>
      ) : (
        <ul className="divide-y divide-border/70 -mx-2">
          {kandidaten.map(k => {
            const rel = getRelatieById(k.relatieId);
            if (!rel) return null;
            return (
              <li key={k.id} className="px-2 py-3 flex items-center justify-between gap-3">
                <Link to={`/relaties/${rel.id}`} className="min-w-0 flex-1 hover:text-primary transition-colors">
                  <p className="text-sm font-medium text-foreground truncate">{rel.bedrijfsnaam || '(geen naam)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{rel.contactpersoon || '—'}</p>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={k.status}
                    onChange={e => handleStatus(k.id, e.target.value as KandidaatStatus)}
                    className={`h-8 px-2 rounded text-xs font-medium border-0 ${STATUS_KLEUREN[k.status]}`}
                  >
                    {(Object.keys(STATUS_LABELS) as KandidaatStatus[]).map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleRemove(k.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                    aria-label="Verwijderen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
