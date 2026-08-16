import { useMemo, useState } from 'react';
import { CheckCheck, Loader2, MailCheck, PrinterCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { maakStandaardProductiekernBrowserWriteSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserWriteClient';
import type { PrintbatchContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import {
  markeerProductiekernBatchGeprint,
  markeerProductiekernBrievenGepost,
  type ProductiekernBatchBrief,
} from '@/lib/offMarket/acquisitie/productiekernPrintbatch';

interface Props {
  batch: PrintbatchContract;
  brieven: readonly ProductiekernBatchBrief[];
  onBatchChange: (batch: PrintbatchContract) => void;
}

/**
 * De fysieke wereld blijft bewust een handmatige grens. Genereren/downloaden
 * verandert geen status; alleen deze expliciete bevestigingen schrijven
 * `geprint` en daarna `gepost` naar de Productiekern.
 */
export default function ProductiekernPrintPostBevestiging({
  batch,
  brieven,
  onBatchChange,
}: Props) {
  const [bezig, setBezig] = useState<'print' | 'post' | null>(null);
  const writes = useMemo(() => maakStandaardProductiekernBrowserWriteSamenstelling(), []);

  if (!writes.activatie.schrijvenActief) return null;

  async function actorId(): Promise<string> {
    const auth = await supabase.auth.getUser();
    if (auth.error || !auth.data.user?.id) throw new Error('Ingelogde gebruiker kon niet worden vastgesteld.');
    return auth.data.user.id;
  }

  async function bevestigPrint() {
    if (bezig || batch.status !== 'documenten_gegenereerd') return;
    setBezig('print');
    try {
      const actor = await actorId();
      const printdatum = new Date().toISOString();
      await markeerProductiekernBatchGeprint({
        batch,
        actorId: actor,
        printdatum,
      }, writes.transactieRepository);
      onBatchChange({ ...batch, status: 'geprint', printdatum });
      toast.success(`${batch.batchnummer} gemarkeerd als geprint.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printbevestiging is mislukt.');
    } finally {
      setBezig(null);
    }
  }

  async function bevestigPost() {
    if (bezig || (batch.status !== 'geprint' && batch.status !== 'gedeeltelijk_gepost')) return;
    setBezig('post');
    try {
      const actor = await actorId();
      const verzenddatum = new Date().toISOString();
      await markeerProductiekernBrievenGepost({
        batch,
        brieven: [...brieven],
        actorId: actor,
        verzenddatum,
      }, writes.transactieRepository);
      onBatchChange({ ...batch, status: 'gepost', verzenddatum });
      toast.success(`${brieven.length} ${brieven.length === 1 ? 'brief' : 'brieven'} als gepost geregistreerd.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Postbevestiging is niet volledig verwerkt. Veilige retry is mogelijk.');
    } finally {
      setBezig(null);
    }
  }

  if (batch.status === 'documenten_gegenereerd') {
    return (
      <div className="rounded-md border border-dashed p-2.5 space-y-2" data-testid="productiekern-print-bevestiging">
        <p className="text-[11px] text-muted-foreground">
          Bevestig dit pas nadat de vier geregistreerde bestanden daadwerkelijk zijn geprint en gecontroleerd.
        </p>
        <Button type="button" size="sm" onClick={() => void bevestigPrint()} disabled={!!bezig}>
          {bezig === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PrinterCheck className="h-4 w-4" />}
          Ik heb deze batch geprint
        </Button>
      </div>
    );
  }

  if (batch.status === 'geprint' || batch.status === 'gedeeltelijk_gepost') {
    return (
      <div className="rounded-md border border-dashed p-2.5 space-y-2" data-testid="productiekern-post-bevestiging">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <PrinterCheck className="h-3.5 w-3.5" />
          Geprint {batch.printdatum ? new Date(batch.printdatum).toLocaleString('nl-NL') : ''}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Bevestig verzending pas nadat alle {brieven.length} fysieke {brieven.length === 1 ? 'brief' : 'brieven'} daadwerkelijk aan de post zijn aangeboden.
        </p>
        <Button type="button" size="sm" onClick={() => void bevestigPost()} disabled={!!bezig}>
          {bezig === 'post' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
          Alle brieven daadwerkelijk gepost
        </Button>
      </div>
    );
  }

  if (batch.status === 'gepost') {
    return (
      <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 p-2 text-xs" data-testid="productiekern-post-gereed">
        <CheckCheck className="h-4 w-4" />
        <span>Batch volledig gepost{batch.verzenddatum ? ` · ${new Date(batch.verzenddatum).toLocaleString('nl-NL')}` : ''}</span>
      </div>
    );
  }

  return null;
}
