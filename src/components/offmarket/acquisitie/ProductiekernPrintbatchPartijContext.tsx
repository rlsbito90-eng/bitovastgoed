import { AlertTriangle, Layers3, MessageCircle, Send } from 'lucide-react';

import { useAcquisitiePartijOverzicht } from '@/hooks/useAcquisitiePartijOverzicht';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { partijKeyVoorBrief } from '@/lib/offMarket/acquisitie/partijOverzicht';

function datumKort(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function responsLabel(status: string | null): string {
  if (!status) return '';
  return status.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
}

export default function ProductiekernPrintbatchPartijContext({
  briefnummer,
}: {
  briefnummer: string;
}) {
  const { data: signalen = [] } = useOffMarketSignalen();
  const partijOverzicht = useAcquisitiePartijOverzicht(signalen);

  const bronbrief = partijOverzicht.alleBrieven.find((brief) => brief.briefnummer === briefnummer);
  const key = bronbrief ? partijKeyVoorBrief(bronbrief) : null;
  const partij = key ? partijOverzicht.perKey.get(key) : undefined;

  if (!partij) return null;

  const bekendePartij = partij.objecten.length >= 2;
  const eerderBenaderd = partij.verstuurdAantal > 0;
  const heeftReactie = !!partij.laatsteRespons;
  const risicovol = partij.advies === 'niet_opnieuw';
  const aandacht = risicovol || partij.advies === 'recent_benaderd' || partij.advies === 'warm_contact';

  if (!bekendePartij && !eerderBenaderd && !heeftReactie) return null;

  return (
    <div className="mt-1.5 space-y-1" data-testid={`printbatch-partijcontext-${briefnummer}`}>
      <div className="flex flex-wrap items-center gap-1">
        {bekendePartij && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
            <Layers3 className="h-3 w-3" /> Bekende partij · {partij.objecten.length} objecten
          </span>
        )}
        {eerderBenaderd && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
            aandacht ? 'border-amber-300 bg-amber-50 text-amber-900' : 'bg-muted/40 text-muted-foreground'
          }`}>
            <Send className="h-3 w-3" /> Eerder benaderd
          </span>
        )}
        {risicovol && (
          <span className="inline-flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
            <AlertTriangle className="h-3 w-3" /> Eerst historie beoordelen
          </span>
        )}
      </div>

      {partij.laatsteContactOp && (
        <p className="text-[10px] text-muted-foreground">
          Laatste partijcontact: {datumKort(partij.laatsteContactOp)}
          {partij.laatsteContactObjectAdres ? ` · ${partij.laatsteContactObjectAdres}` : ''}
        </p>
      )}

      {heeftReactie && (
        <p className={`flex flex-wrap items-center gap-1 text-[10px] ${risicovol ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
          <MessageCircle className="h-3 w-3" />
          Laatste reactie: {responsLabel(partij.laatsteRespons)} · {datumKort(partij.laatsteResponsOp)}
          {partij.laatsteResponsObjectAdres ? ` · ${partij.laatsteResponsObjectAdres}` : ''}
        </p>
      )}
    </div>
  );
}
