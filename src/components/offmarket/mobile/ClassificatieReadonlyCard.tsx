// Mobiel — readonly samenvatting van classificatie. Pas na klikken op
// "Wijzig classificatie" opent de bestaande SignaalFormDialog.
import { Pencil, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ASSETTYPE_LABEL,
  PRIORITEIT_LABEL,
  SIGNAALTYPE_LABEL,
  STATUS_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  onWijzig: () => void;
}

export default function ClassificatieReadonlyCard({ signaal, onWijzig }: Props) {
  const omschrijving = signaal.omschrijving?.trim() || '—';

  return (
    <section
      data-testid="classificatie-readonly"
      className="section-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          Classificatie
        </h2>
        <Button variant="outline" size="sm" onClick={onWijzig}>
          <Pencil className="h-3.5 w-3.5" />
          Wijzigen
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[12px]">
        <Rij label="Assettype" waarde={ASSETTYPE_LABEL[signaal.assettype]} />
        <Rij label="Strategie" waarde={signaal.potentiele_strategie || '—'} />
        <Rij label="Type signaal" waarde={SIGNAALTYPE_LABEL[signaal.type_signaal]} />
        <Rij label="Status" waarde={STATUS_LABEL[signaal.status]} />
        <Rij label="Prioriteit" waarde={PRIORITEIT_LABEL[signaal.prioriteit]} />
      </dl>

      <div className="pt-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Omschrijving
        </p>
        <p className="text-[13px] text-foreground mt-0.5 whitespace-pre-wrap break-words">
          {omschrijving}
        </p>
      </div>
    </section>
  );
}

function Rij({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words leading-snug" title={waarde}>{waarde}</dd>
    </div>
  );
}
