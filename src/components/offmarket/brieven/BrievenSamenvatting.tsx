// Compacte samenvattingsregel boven Brieven & opvolging.
import { Users, Mail, FileEdit, CalendarClock, MessageSquare, BellRing } from 'lucide-react';
import type { BrievenSamenvatting } from '@/lib/offMarket/brieven/groepering';
import { formatDeadlineNL } from '@/lib/offMarket/volgendeActie';

export default function BrievenSamenvattingRegel({ data }: { data: BrievenSamenvatting }) {
  const items: { Icon: typeof Users; label: string }[] = [
    { Icon: Users, label: `${data.aantalGeadresseerden} geadresseerden` },
    { Icon: Mail, label: `${data.brief1Verstuurd}× Brief 1 gepost` },
  ];
  if (data.emailsVerstuurd > 0) {
    items.push({ Icon: Mail, label: `${data.emailsVerstuurd}× E-mail verzonden` });
  }
  items.push(
    { Icon: FileEdit, label: `${data.actieveConcepten} actieve concepten` },
    { Icon: MessageSquare, label: `${data.reacties} reacties` },
    { Icon: BellRing, label: `${data.openOpvolgingen} open opvolgingen` },
  );
  if (data.eerstvolgendeOpvolging) {
    items.push({
      Icon: CalendarClock,
      label: `Volgende opvolging ${formatDeadlineNL(data.eerstvolgendeOpvolging.deadline)}`,
    });
  }
  return (
    <div
      data-testid="brieven-samenvatting"
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground"
    >
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <it.Icon className="h-3 w-3" />
          <span className="tabular-nums">{it.label}</span>
          {i < items.length - 1 && <span className="opacity-40">·</span>}
        </span>
      ))}
    </div>
  );
}
