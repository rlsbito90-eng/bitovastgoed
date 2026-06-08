// KadasterCheckDialog — V1A/V1B/V1C
// - Toont gegenereerde zoekvarianten
// - Mock-modus (default zolang echte API niet beschikbaar)
// - Handmatige fallback-tab
// - Preview met confidence en overname-knop
// - Waarschuwing bij complexe adressen en bij recente eerdere check
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FileSearch, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import KadasterResultaatKaart from './KadasterResultaatKaart';
import KadasterHandmatigForm from './KadasterHandmatigForm';
import {
  normaliseerAdres, bouwZoekvarianten, detecteerComplexiteit,
} from '@/lib/offMarket/kadaster/adres';
import {
  useKadasterCheck, useOvernameKadasterCheck, useLaatsteKadasterCheck,
} from '@/hooks/useKadasterCheck';
import type {
  KadasterResultaat, KadasterCheckResponse,
} from '@/lib/offMarket/kadaster/types';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONFIDENCE_MIN_AUTOMATISCH = 0.55;

function formatDateNL(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('nl-NL'); } catch { return iso; }
}

export default function KadasterCheckDialog({ signaal, open, onOpenChange }: Props) {
  const a = signaal as any;

  const adres = useMemo(() => normaliseerAdres({
    origineel: a.adres ?? signaal.titel ?? '',
    postcode: a.postcode,
    plaats: signaal.plaats,
  }), [a.adres, a.postcode, signaal.plaats, signaal.titel]);

  const complexiteit = useMemo(() => detecteerComplexiteit(adres), [adres]);
  const varianten = useMemo(() => bouwZoekvarianten(adres), [adres]);

  const [variantId, setVariantId] = useState<string>(varianten[0]?.id ?? '');
  const [handmatigeZoekterm, setHandmatigeZoekterm] = useState('');
  const [response, setResponse] = useState<KadasterCheckResponse | null>(null);

  const laatsteCheck = useLaatsteKadasterCheck(open ? signaal.id : undefined);
  const check = useKadasterCheck();
  const overname = useOvernameKadasterCheck();

  const recentGecheckt = laatsteCheck.data?.uitgevoerd_op
    ? (Date.now() - new Date(laatsteCheck.data.uitgevoerd_op).getTime()) < 30 * 24 * 3600 * 1000
    : false;

  const resetEnSluiten = () => {
    setResponse(null);
    setHandmatigeZoekterm('');
    onOpenChange(false);
  };

  const handleUitvoeren = async () => {
    try {
      const resp = await check.mutateAsync({
        signaal_id: signaal.id,
        zoekvariant_id: variantId || undefined,
        handmatige_zoekterm: handmatigeZoekterm.trim() || null,
        modus: 'mock',
      });
      setResponse(resp);
      if (resp.status === 'mislukt' && resp.foutmelding) {
        toast.error(resp.foutmelding);
      } else if (resp.status === 'geen_resultaat') {
        toast.info('Geen resultaten gevonden');
      } else {
        toast.success(`${resp.resultaten.length} resultaat${resp.resultaten.length === 1 ? '' : 'en'} gevonden`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kadaster-check mislukt';
      toast.error(msg);
    }
  };

  const handleOvernemen = async (resultaat: KadasterResultaat) => {
    if (!response) return;
    if (resultaat.confidence < CONFIDENCE_MIN_AUTOMATISCH && !window.confirm(
      `Lage match-confidence (${Math.round(resultaat.confidence * 100)}%). Weet je zeker dat je dit resultaat wilt overnemen?`
    )) return;
    try {
      await overname.mutateAsync({
        signaal_id: signaal.id,
        check_id: response.check_id,
        resultaat,
      });
      toast.success('Resultaat overgenomen in Eigenaarsonderzoek');
      resetEnSluiten();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Overname mislukt';
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetEnSluiten(); else onOpenChange(true); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSearch className="h-4 w-4" /> Kadaster check
          </DialogTitle>
          <DialogDescription>
            Genormaliseerd adres: <span className="font-mono-data">{adres.origineel || '—'}</span>
          </DialogDescription>
        </DialogHeader>

        {complexiteit.complex && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Complex of onzeker adres</p>
              <p className="text-amber-700/80">Reden: {complexiteit.redenen.join(', ')}. Kies zelf het juiste resultaat — geen automatische overname.</p>
            </div>
          </div>
        )}

        {laatsteCheck.data && (
          <div className={`rounded-md border px-3 py-2 text-xs ${recentGecheckt ? 'border-amber-500/30 bg-amber-500/10 text-amber-700' : 'border-border bg-muted/30 text-muted-foreground'}`}>
            Laatste check: <span className="font-mono-data">{formatDateNL(laatsteCheck.data.uitgevoerd_op)}</span>
            {' '}({laatsteCheck.data.modus})
            {recentGecheckt && ' — recent uitgevoerd, controleer of een nieuwe check nodig is.'}
          </div>
        )}

        <Tabs defaultValue="check" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="check" className="flex-1">Check uitvoeren (mock)</TabsTrigger>
            <TabsTrigger value="handmatig" className="flex-1">Handmatig invoeren</TabsTrigger>
          </TabsList>

          <TabsContent value="check" className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Zoekvariant</Label>
              <Select value={variantId} onValueChange={setVariantId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {varianten.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label} {v.metToevoeging ? '(met toevoeging)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Of: handmatige zoekterm (overschrijft variant)</Label>
              <Input
                value={handmatigeZoekterm}
                onChange={e => setHandmatigeZoekterm(e.target.value)}
                placeholder="bv. Hoofdweg 160-H Amsterdam"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleUitvoeren} disabled={check.isPending || (!variantId && !handmatigeZoekterm.trim())}>
                {check.isPending ? 'Bezig…' : 'Check uitvoeren'}
              </Button>
            </div>

            {response && response.resultaten.length === 0 && response.status !== 'mislukt' && (
              <p className="text-xs text-muted-foreground">Geen resultaten. Probeer een andere zoekvariant of voer handmatig in.</p>
            )}

            {response && response.resultaten.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {response.resultaten.length} resultaat{response.resultaten.length === 1 ? '' : 'en'}
                </p>
                {response.resultaten.map((r, i) => (
                  <KadasterResultaatKaart
                    key={i}
                    resultaat={r}
                    onOvernemen={() => handleOvernemen(r)}
                    disabled={overname.isPending}
                    vereistBevestiging={r.confidence < CONFIDENCE_MIN_AUTOMATISCH || complexiteit.complex}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="handmatig">
            <KadasterHandmatigForm signaalId={signaal.id} onDone={resetEnSluiten} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={resetEnSluiten}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
