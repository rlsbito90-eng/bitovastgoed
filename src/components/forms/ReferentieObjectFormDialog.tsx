import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useDataStore } from '@/hooks/useDataStore';
import {
  ASSET_CLASS_LABELS,
  REFERENTIE_KWALITEIT_LABELS,
  berekenReferentieKwaliteit,
  berekenPrijsPerM2,
  berekenHuurPerM2PerJaar,
  berekenHuurPerM2PerMaand,
  formatCurrency,
  type AssetClass,
  type Energielabel,
  type ReferentieObject,
  type VerhuurStatus,
} from '@/data/mock-data';
import { toast } from 'sonner';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referentie?: ReferentieObject;
  /** Wordt aangeroepen na succesvol toevoegen of bijwerken. Geeft het opgeslagen object door. */
  onSaved?: (saved: ReferentieObject) => void;
}

const ENERGIELABELS: Energielabel[] = ['A++++','A+++','A++','A+','A','B','C','D','E','F','G','onbekend'];

const KWALITEIT_KLEUR: Record<string, string> = {
  zeer_sterk: 'text-success',
  goed: 'text-success',
  bruikbaar: 'text-warning',
  zwak: 'text-destructive',
};

export default function ReferentieObjectFormDialog({ open, onOpenChange, referentie, onSaved }: Props) {
  const store = useDataStore();
  const isEdit = !!referentie;

  const [adres, setAdres] = useState('');
  const [postcode, setPostcode] = useState('');
  const [plaats, setPlaats] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass | ''>('');
  const [m2, setM2] = useState<string>('');
  const [vraagprijs, setVraagprijs] = useState<string>('');
  const [bouwjaar, setBouwjaar] = useState<string>('');
  const [energielabel, setEnergielabel] = useState<Energielabel | ''>('');
  const [huurstatus, setHuurstatus] = useState<VerhuurStatus | ''>('');
  const [huurMaand, setHuurMaand] = useState<string>('');
  const [huurJaar, setHuurJaar] = useState<string>('');
  const [bron, setBron] = useState('');
  const [notities, setNotities] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    if (referentie) {
      setAdres(referentie.adres);
      setPostcode(referentie.postcode);
      setPlaats(referentie.plaats);
      setAssetClass(referentie.assetClass);
      setM2(String(referentie.m2 ?? ''));
      setVraagprijs(String(referentie.vraagprijs ?? ''));
      setBouwjaar(String(referentie.bouwjaar ?? ''));
      setEnergielabel(referentie.energielabel ?? '');
      setHuurstatus(referentie.huurstatus ?? '');
      setBron(referentie.bron ?? '');
      setNotities(referentie.notities ?? '');
    } else {
      setAdres(''); setPostcode(''); setPlaats(''); setAssetClass('');
      setM2(''); setVraagprijs(''); setBouwjaar('');
      setEnergielabel(''); setHuurstatus(''); setBron(''); setNotities('');
    }
  }, [referentie, open]);

  const m2Num = m2 ? Number(m2) : undefined;
  const vraagprijsNum = vraagprijs ? Number(vraagprijs) : undefined;
  const bouwjaarNum = bouwjaar ? Number(bouwjaar) : undefined;
  const prijsPerM2 = berekenPrijsPerM2(vraagprijsNum, m2Num);

  const kwaliteit = useMemo(() => berekenReferentieKwaliteit({
    adres, postcode, plaats,
    assetClass: (assetClass || undefined) as AssetClass | undefined,
    m2: m2Num,
    vraagprijs: vraagprijsNum,
    bouwjaar: bouwjaarNum,
    energielabel: (energielabel || undefined) as Energielabel | undefined,
    huurstatus: (huurstatus || undefined) as VerhuurStatus | undefined,
    bron: bron || undefined,
  }), [adres, postcode, plaats, assetClass, m2Num, vraagprijsNum, bouwjaarNum, energielabel, huurstatus, bron]);

  const handleSubmit = async () => {
    // Validatie verplichte velden
    if (!adres.trim() || !postcode.trim() || !plaats.trim() || !assetClass
        || !m2Num || !vraagprijsNum || !bouwjaarNum) {
      toast.error('Vul de verplichte velden in (gemarkeerd met **).');
      return;
    }
    if (m2Num <= 0) { toast.error('m² moet groter dan 0 zijn.'); return; }
    if (vraagprijsNum < 0) { toast.error('Vraagprijs kan niet negatief zijn.'); return; }
    if (bouwjaarNum < 1700 || bouwjaarNum > 2100) {
      toast.error('Bouwjaar moet tussen 1700 en 2100 liggen.'); return;
    }

    setBezig(true);
    try {
      const payload = {
        adres: adres.trim(),
        postcode: postcode.trim(),
        plaats: plaats.trim(),
        assetClass: assetClass as AssetClass,
        m2: m2Num,
        vraagprijs: vraagprijsNum,
        bouwjaar: bouwjaarNum,
        energielabel: (energielabel || undefined) as Energielabel | undefined,
        huurstatus: (huurstatus || undefined) as VerhuurStatus | undefined,
        bron: bron.trim() || undefined,
        notities: notities.trim() || undefined,
      };

      if (isEdit && referentie) {
        await store.updateReferentieObject(referentie.id, payload);
        toast.success('Referentieobject bijgewerkt');
        const updated = { ...referentie, ...payload } as ReferentieObject;
        onSaved?.(updated);
      } else {
        const nieuw = await store.addReferentieObject(payload);
        toast.success('Referentieobject toegevoegd');
        if (nieuw) onSaved?.(nieuw);
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Opslaan mislukt');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Referentieobject bewerken' : 'Nieuw referentieobject'}</DialogTitle>
          <DialogDescription>
            Velden gemarkeerd met <span className="font-semibold">**</span> zijn sterk aanbevolen,
            <span className="font-semibold"> *</span> zijn nuttig.
          </DialogDescription>
        </DialogHeader>

        {/* KWALITEITSBLOK */}
        <div className="section-card p-4 space-y-3 bg-muted/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Referentiekwaliteit</p>
              <p className={`text-lg font-semibold ${KWALITEIT_KLEUR[kwaliteit.kwaliteit]}`}>
                {REFERENTIE_KWALITEIT_LABELS[kwaliteit.kwaliteit]} ·{' '}
                <span className="font-mono-data">{kwaliteit.qualityScore}/100</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Volledigheid</p>
              <p className="text-base font-semibold font-mono-data text-foreground">
                {kwaliteit.completenessPct}%
              </p>
            </div>
          </div>
          <Progress value={kwaliteit.qualityScore} className="h-2" />
          {(kwaliteit.ontbrekendeAanbevolen.length > 0 || kwaliteit.ontbrekendeNuttig.length > 0) ? (
            <div className="space-y-1.5 text-xs">
              {kwaliteit.ontbrekendeAanbevolen.length > 0 && (
                <div className="flex items-start gap-2 text-foreground">
                  <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                  <span>
                    Sterk aanbevolen ontbreekt:{' '}
                    <span className="text-muted-foreground">{kwaliteit.ontbrekendeAanbevolen.join(', ')}</span>
                  </span>
                </div>
              )}
              {kwaliteit.ontbrekendeNuttig.length > 0 && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Nuttig ontbreekt:{' '}
                    <span>{kwaliteit.ontbrekendeNuttig.join(', ')}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Alle velden ingevuld.
            </div>
          )}
        </div>

        {/* FORMULIER */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label htmlFor="adres">Adres <span className="text-accent">**</span></Label>
            <Input id="adres" value={adres} onChange={e => setAdres(e.target.value)} placeholder="Straat 12" />
          </div>
          <div>
            <Label htmlFor="postcode">Postcode <span className="text-accent">**</span></Label>
            <Input id="postcode" value={postcode} onChange={e => setPostcode(e.target.value)} placeholder="1234 AB" />
          </div>
          <div>
            <Label htmlFor="plaats">Plaats <span className="text-accent">**</span></Label>
            <Input id="plaats" value={plaats} onChange={e => setPlaats(e.target.value)} placeholder="Amsterdam" />
          </div>
          <div>
            <Label htmlFor="assetClass">Asset class <span className="text-accent">**</span></Label>
            <select
              id="assetClass"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={assetClass}
              onChange={e => setAssetClass(e.target.value as AssetClass | '')}
            >
              <option value="">Selecteer...</option>
              {(Object.keys(ASSET_CLASS_LABELS) as AssetClass[]).map(ac => (
                <option key={ac} value={ac}>{ASSET_CLASS_LABELS[ac]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="m2">m² <span className="text-accent">**</span></Label>
            <Input id="m2" type="number" min={1} value={m2} onChange={e => setM2(e.target.value)} placeholder="850" />
          </div>
          <div>
            <Label htmlFor="vraagprijs">Vraagprijs (€) <span className="text-accent">**</span></Label>
            <Input id="vraagprijs" type="number" min={0} value={vraagprijs} onChange={e => setVraagprijs(e.target.value)} placeholder="2500000" />
          </div>
          <div>
            <Label htmlFor="bouwjaar">Bouwjaar <span className="text-accent">**</span></Label>
            <Input id="bouwjaar" type="number" min={1700} max={2100} value={bouwjaar} onChange={e => setBouwjaar(e.target.value)} placeholder="1998" />
          </div>
          <div>
            <Label>Prijs / m² <span className="text-muted-foreground text-xs">(automatisch)</span></Label>
            <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm font-mono-data">
              {prijsPerM2 != null ? `${formatCurrency(Math.round(prijsPerM2))} / m²` : '—'}
            </div>
          </div>
          <div>
            <Label htmlFor="energielabel">Energielabel <span className="text-muted-foreground">*</span></Label>
            <select
              id="energielabel"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={energielabel}
              onChange={e => setEnergielabel(e.target.value as Energielabel | '')}
            >
              <option value="">—</option>
              {ENERGIELABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="huurstatus">Huurstatus <span className="text-muted-foreground">*</span></Label>
            <select
              id="huurstatus"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={huurstatus}
              onChange={e => setHuurstatus(e.target.value as VerhuurStatus | '')}
            >
              <option value="">—</option>
              <option value="verhuurd">Verhuurd</option>
              <option value="leeg">Leeg</option>
              <option value="gedeeltelijk">Gedeeltelijk verhuurd</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bron">Bron <span className="text-muted-foreground">*</span></Label>
            <Input id="bron" value={bron} onChange={e => setBron(e.target.value)} placeholder="Funda in Business, eigen netwerk, taxateur..." />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notities">Notities</Label>
            <Textarea id="notities" rows={3} value={notities} onChange={e => setNotities(e.target.value)} placeholder="Toelichting, bijzonderheden, vergelijkingsoverwegingen..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSubmit} disabled={bezig}>
            {bezig ? 'Bezig...' : isEdit ? 'Wijzigingen opslaan' : 'Toevoegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
