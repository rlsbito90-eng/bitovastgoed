// Mobiele inklap-disclosure voor "Meer onderzoeksacties".
// Voorkomt dat dezelfde acties dubbel zichtbaar zijn (al in actionbar boven tabs).
import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import SignaalOnderzoeksacties from '@/components/offmarket/SignaalOnderzoeksacties';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props { signaal: OffMarketSignaal; }

export default function MeerOnderzoeksactiesDisclosure({ signaal }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="section-card p-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-1.5 py-1 text-[13px] text-foreground"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-medium">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          Meer onderzoeksacties
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="pt-2">
          <SignaalOnderzoeksacties signaal={signaal} variant="standaard" withHeader={false} />
        </div>
      )}
    </section>
  );
}
