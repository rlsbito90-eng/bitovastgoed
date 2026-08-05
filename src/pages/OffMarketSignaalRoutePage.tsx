import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import OffMarketSignaalDetailPage from '@/pages/OffMarketSignaalDetailPage';
import OffMarketSignaalReviewPage from '@/pages/OffMarketSignaalReviewPage';
import {
  bepaalInitieleSignaalmodus,
  bewaarStandaardSignaalmodus,
  leesStandaardSignaalmodus,
  type SignaalWeergavemodus,
} from '@/lib/offMarket/signaalReviewVoorkeur';

export default function OffMarketSignaalRoutePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [standaardModus, setStandaardModus] = useState<SignaalWeergavemodus>(() =>
    leesStandaardSignaalmodus(typeof window === 'undefined' ? null : window.localStorage),
  );
  const initieleModus = useMemo(() => bepaalInitieleSignaalmodus({
    explicieteModus: searchParams.get('mode'),
    gerichteDossierTab: searchParams.get('tab'),
    standaardModus,
  }), []);
  const [modus, setModus] = useState<SignaalWeergavemodus>(initieleModus);

  const wijzigModus = (volgende: SignaalWeergavemodus) => {
    setModus(volgende);
    const next = new URLSearchParams(searchParams);
    next.set('mode', volgende);
    setSearchParams(next, { replace: true });
  };

  const maakStandaard = () => {
    setStandaardModus(modus);
    bewaarStandaardSignaalmodus(typeof window === 'undefined' ? null : window.localStorage, modus);
  };

  return (
    <div>
      <div className="px-4 sm:px-6 pt-3 md:pt-4 max-w-7xl">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-card/80 p-1">
          <Button
            type="button"
            size="sm"
            variant={modus === 'review' ? 'default' : 'ghost'}
            onClick={() => wijzigModus('review')}
          >
            Reviewmodus
          </Button>
          <Button
            type="button"
            size="sm"
            variant={modus === 'normaal' ? 'default' : 'ghost'}
            onClick={() => wijzigModus('normaal')}
          >
            Normale modus
          </Button>
          {modus !== standaardModus ? (
            <Button type="button" size="sm" variant="ghost" onClick={maakStandaard}>
              Als standaard instellen
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5" /> Standaard
            </span>
          )}
        </div>
      </div>
      {modus === 'review' ? <OffMarketSignaalReviewPage /> : <OffMarketSignaalDetailPage />}
    </div>
  );
}
