// Dossiernotities — menselijke commerciële notities. Filtert auto-import
// regels eruit (die staan in tab Technisch).
import { useEffect, useState } from 'react';
import { Pencil, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { splitsNotities } from '@/lib/offMarket/notities';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

export default function SignaalDossierNotities({ signaal }: Props) {
  const update = useUpdateOffMarketSignaal();
  const { dossier, technisch } = splitsNotities(signaal.notities);
  const [edit, setEdit] = useState(false);
  const [waarde, setWaarde] = useState(dossier);

  useEffect(() => {
    if (!edit) setWaarde(dossier);
  }, [dossier, edit]);

  const opslaan = async () => {
    const nieuwTekst = [waarde.trim(), technisch.trim()].filter(Boolean).join('\n');
    try {
      await update.mutateAsync({ id: signaal.id, patch: { notities: nieuwTekst || null } });
      toast.success('Dossiernotities opgeslagen');
      setEdit(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan mislukt');
    }
  };

  return (
    <section className="section-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Dossiernotities
        </h2>
        {!edit && (
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}>
            <Pencil className="h-3.5 w-3.5" /> Bewerken
          </Button>
        )}
      </div>
      {edit ? (
        <div className="space-y-2">
          <Textarea
            rows={5}
            value={waarde}
            onChange={(e) => setWaarde(e.target.value)}
            placeholder="Commerciële beoordeling, contact, opvolging…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEdit(false); setWaarde(dossier); }}>
              Annuleren
            </Button>
            <Button size="sm" onClick={opslaan} disabled={update.isPending}>
              {update.isPending ? 'Opslaan…' : 'Opslaan'}
            </Button>
          </div>
        </div>
      ) : dossier ? (
        <p className="text-sm text-foreground whitespace-pre-wrap">{dossier}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nog geen dossiernotities. Voeg commerciële beoordeling, contact of opvolging toe.
        </p>
      )}
    </section>
  );
}
