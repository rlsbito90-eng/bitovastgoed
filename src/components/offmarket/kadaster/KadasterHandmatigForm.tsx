// Handmatige fallback-form: gebruiker heeft zelf in Mijn Kadaster gezocht
// en typt het resultaat hier in. Wordt opgeslagen als check (modus=handmatig)
// + overgenomen naar het signaal.
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useHandmatigeOvername } from '@/hooks/useKadasterCheck';
import type { KadasterEigenaarType } from '@/lib/offMarket/kadaster/types';
import { EIGENAARTYPE_LABEL, type OffMarketEigenaartype } from '@/lib/offMarket/types';

interface Props {
  signaalId: string;
  onDone: () => void;
}

export default function KadasterHandmatigForm({ signaalId, onDone }: Props) {
  const overname = useHandmatigeOvername();
  const [naam, setNaam] = useState('');
  const [type, setType] = useState<KadasterEigenaarType | ''>('');
  const [bedrijf, setBedrijf] = useState('');
  const [kadastrale, setKadastrale] = useState('');

  const handleOpslaan = async () => {
    if (!naam.trim() || !kadastrale.trim()) {
      toast.error('Eigenaar naam en kadastrale aanduiding zijn verplicht');
      return;
    }
    try {
      await overname.mutateAsync({
        signaal_id: signaalId,
        eigenaar_naam: naam.trim(),
        eigenaar_type: type || undefined,
        eigenaar_bedrijfsnaam: bedrijf.trim() || undefined,
        kadastrale_aanduiding: kadastrale.trim(),
      });
      toast.success('Kadaster-resultaat handmatig overgenomen');
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Opslaan mislukt';
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        Vul hier het resultaat in dat je zelf via Mijn Kadaster / BRK Inzage hebt gevonden.
        Dit wordt direct overgenomen in Eigenaarsonderzoek en gelogd als handmatige check.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Eigenaar naam *</Label>
          <Input value={naam} onChange={e => setNaam(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Eigenaar type</Label>
          <Select value={type || 'geen'} onValueChange={(v) => setType(v === 'geen' ? '' : (v as KadasterEigenaarType))}>
            <SelectTrigger><SelectValue placeholder="Niet ingesteld" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="geen">Niet ingesteld</SelectItem>
              {(Object.keys(EIGENAARTYPE_LABEL) as OffMarketEigenaartype[]).map(t => (
                <SelectItem key={t} value={t}>{EIGENAARTYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Bedrijfsnaam</Label>
          <Input value={bedrijf} onChange={e => setBedrijf(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Kadastrale aanduiding *</Label>
          <Input value={kadastrale} onChange={e => setKadastrale(e.target.value)} placeholder="bv. AMSTERDAM A 1234 A1" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>Annuleren</Button>
        <Button size="sm" onClick={handleOpslaan} disabled={overname.isPending}>
          {overname.isPending ? 'Opslaan…' : 'Overnemen in eigenaarsonderzoek'}
        </Button>
      </div>
    </div>
  );
}
