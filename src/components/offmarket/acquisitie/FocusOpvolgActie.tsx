import { useMemo, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RegistreerResponsDialog from '@/components/offmarket/brieven/RegistreerResponsDialog';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';

interface Props {
  signaalId: string;
  relatieId?: string | null;
}

export function kiesMeestRecenteVerstuurdeBrief<T extends {
  status?: string | null;
  archived_at?: string | null;
  verzonden_op?: string | null;
  postdatum?: string | null;
  created_at?: string | null;
}>(brieven: T[]): T | null {
  const kandidaten = brieven.filter((brief) =>
    !brief.archived_at && brief.status === 'verstuurd',
  );
  kandidaten.sort((a, b) => {
    const da = a.verzonden_op ?? a.postdatum ?? a.created_at ?? '';
    const db = b.verzonden_op ?? b.postdatum ?? b.created_at ?? '';
    return db.localeCompare(da);
  });
  return kandidaten[0] ?? null;
}

export default function FocusOpvolgActie({ signaalId, relatieId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: brieven = [], isLoading } = useOffMarketBrievenForSignaal(signaalId);
  const brief = useMemo(() => kiesMeestRecenteVerstuurdeBrief(brieven), [brieven]);

  return (
    <>
      <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2" data-testid="focus-opvolgactie">
        <div>
          <p className="text-xs font-medium text-foreground">Contact of reactie registreren</p>
          <p className="text-[11px] text-muted-foreground">
            Gebruikt de bestaande briefrespons, contactmoment- en vervolgtaakflow.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
          disabled={isLoading || !brief}
          data-testid="focus-registreer-respons"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {isLoading ? 'Brieven laden…' : brief ? 'Reactie registreren' : 'Geen verstuurde brief gevonden'}
        </Button>
      </div>

      <RegistreerResponsDialog
        open={open}
        onOpenChange={setOpen}
        brief={brief}
        signaalId={signaalId}
        relatieId={relatieId ?? null}
      />
    </>
  );
}
