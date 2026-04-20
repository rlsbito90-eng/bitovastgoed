import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { formatCurrency } from '@/data/mock-data';
import { Button } from '@/components/ui/button';
import { Plus, X, Star } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  primairObjectId: string;
}

export default function DealObjectenSectie({ dealId, primairObjectId }: Props) {
  const { objecten, getObjectenVoorDeal, addDealObject, removeDealObject, setPrimairDealObject, getObjectById } = useDataStore();
  const [adding, setAdding] = useState(false);
  const [keuze, setKeuze] = useState('');

  const koppelingen = getObjectenVoorDeal(dealId);
  // Vul aan met het primaire object als dat (om legacy redenen) niet in de M2M staat
  const alleObjectIds = Array.from(new Set([primairObjectId, ...koppelingen.map(k => k.objectId)]));
  const beschikbareObjecten = objecten.filter(o => !alleObjectIds.includes(o.id));

  const handleAdd = async () => {
    if (!keuze) return;
    try {
      await addDealObject(dealId, keuze, false);
      toast.success('Object gekoppeld');
      setKeuze('');
      setAdding(false);
    } catch (err: any) {
      toast.error(`Koppelen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeDealObject(id);
      toast.success('Koppeling verwijderd');
    } catch (err: any) {
      toast.error(`Verwijderen mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  const handlePrimair = async (koppelingId: string) => {
    try {
      await setPrimairDealObject(dealId, koppelingId);
      toast.success('Primair object bijgewerkt');
    } catch (err: any) {
      toast.error(`Bijwerken mislukt: ${err.message ?? 'onbekende fout'}`);
    }
  };

  return (
    <section className="section-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">Gekoppelde objecten</h2>
        {!adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)} disabled={beschikbareObjecten.length === 0}>
            <Plus className="h-4 w-4 mr-1" /> Object toevoegen
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
            <option value="">— Kies object —</option>
            {beschikbareObjecten.map(o => (
              <option key={o.id} value={o.id}>{o.titel} {o.plaats ? `· ${o.plaats}` : ''}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button type="button" onClick={handleAdd} disabled={!keuze}>Koppelen</Button>
            <Button type="button" variant="outline" onClick={() => { setAdding(false); setKeuze(''); }}>Annuleer</Button>
          </div>
        </div>
      )}

      {koppelingen.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen extra objecten gekoppeld.</p>
      ) : (
        <ul className="divide-y divide-border/70 -mx-2">
          {koppelingen.map(k => {
            const obj = getObjectById(k.objectId);
            if (!obj) return null;
            return (
              <li key={k.id} className="px-2 py-3 flex items-center justify-between gap-3">
                <Link to={`/objecten/${obj.id}`} className="min-w-0 flex-1 hover:text-primary transition-colors">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {obj.titel}
                    {k.isPrimair && <Star className="h-3.5 w-3.5 fill-accent text-accent shrink-0" aria-label="Primair" />}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {obj.plaats || '—'} · <span className="font-mono-data">{formatCurrency(obj.vraagprijs)}</span>
                  </p>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  {!k.isPrimair && (
                    <button
                      onClick={() => handlePrimair(k.id)}
                      className="p-1.5 text-muted-foreground hover:text-accent rounded transition-colors"
                      aria-label="Maak primair"
                      title="Maak primair object"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(k.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
                    aria-label="Ontkoppelen"
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
