// Test-only harness die de PinPreview-uitvoer 1:1 spiegelt zónder maplibre.
// Dit voorkomt het mounten van een hele Map in jsdom maar valideert wel
// dezelfde structuur (testid's, klassen) als in OffMarketKaart.tsx.
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ToevoegenAanAcquisitieSelectieKnop from '@/components/offmarket/acquisitie/ToevoegenAanAcquisitieSelectieKnop';

export function PinPreviewHarness({ signaal, onOpen }: { signaal: any; onOpen: () => void }) {
  return (
    <div
      data-testid="pin-preview"
      className="flex flex-col min-w-[240px] max-w-[300px]"
      style={{ maxHeight: '60vh' }}
    >
      <div
        className="space-y-2 overflow-y-auto overflow-x-hidden pr-0.5"
        style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
      >
        <div className="text-sm">{signaal.titel}</div>
      </div>
      <div
        data-testid="pin-preview-acties"
        className="flex flex-col gap-1.5 pt-2 mt-2 border-t border-border/60 shrink-0"
      >
        <Button size="sm" onClick={onOpen}>
          <ExternalLink className="h-3.5 w-3.5" />
          Open signaal
        </Button>
        <ToevoegenAanAcquisitieSelectieKnop
          signaalId={signaal.id}
          variant="compact"
          className="w-full"
        />
      </div>
    </div>
  );
}
