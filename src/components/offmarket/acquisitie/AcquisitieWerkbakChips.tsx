// Fase 1 — Hoofdwerkbakken (Actie/Wachten/Afgehandeld/Alles) met
// een tweede, taakgerichte proceslaag die alleen zichtbaar is binnen Actie.
import { useEffect, useMemo, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { toast } from 'sonner';

import type { ActieSubfilter, WerkbakView } from '@/lib/offMarket/acquisitie/werkbak';
import { ACTIE_SUBFILTER_LABEL, WERKBAK_LABEL } from '@/lib/offMarket/acquisitie/werkbak';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { useAlleOffMarketBrievenVoorPartijen } from '@/hooks/useAcquisitiePartijOverzicht';
import { Button } from '@/components/ui/button';
import BulkEmailVoorbereidenDialog from './BulkEmailVoorbereidenDialog';

const HOOFD_VOLGORDE: WerkbakView[] = ['actie', 'wachten', 'afgehandeld', 'alles'];
const SUB_VOLGORDE: ActieSubfilter[] = [
  'alle', 'onderzoeken', 'eigenaar_controleren', 'adres_achterhalen', 'brief_voorbereiden',
  'printen_posten', 'opvolgen',
];

export interface AcquisitieWerkbakChipsProps {
  werkbak: WerkbakView;
  subfilter: ActieSubfilter;
  onWerkbakChange: (v: WerkbakView) => void;
  onSubfilterChange: (v: ActieSubfilter) => void;
  counts: {
    werkbak: Record<WerkbakView, number>;
    subfilter: Record<ActieSubfilter, number>;
  };
  geselecteerdeRadarIds: string[];
  zichtbareRadarIds: string[];
  onVolgendeBrief: () => void;
}

export default function AcquisitieWerkbakChips({
  werkbak, subfilter, onWerkbakChange, onSubfilterChange, counts,
  geselecteerdeRadarIds, zichtbareRadarIds, onVolgendeBrief,
}: AcquisitieWerkbakChipsProps) {
  const { data: alleSignalen = [], isLoading: signalenLaden } = useOffMarketSignalen();
  const [emailScopeIds, setEmailScopeIds] = useState<string[]>([]);
  const [emailOpenGevraagd, setEmailOpenGevraagd] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const { data: emailBrieven = [], isLoading: brievenLaden } = useAlleOffMarketBrievenVoorPartijen(emailScopeIds.length > 0);

  const emailSignalen = useMemo(() => {
    const scope = new Set(emailScopeIds);
    return alleSignalen.filter((signaal) => scope.has(signaal.id));
  }, [alleSignalen, emailScopeIds]);

  useEffect(() => {
    if (!emailOpenGevraagd || signalenLaden || brievenLaden) return;
    setEmailOpenGevraagd(false);
    if (emailSignalen.length === 0) {
      toast.error('Geen geselecteerde Radar-dossiers gevonden');
      return;
    }
    setEmailOpen(true);
  }, [emailOpenGevraagd, signalenLaden, brievenLaden, emailSignalen.length]);

  const zichtbareSet = useMemo(() => new Set(zichtbareRadarIds), [zichtbareRadarIds]);
  const zichtbareSelectie = useMemo(
    () => geselecteerdeRadarIds.filter((id) => zichtbareSet.has(id)),
    [geselecteerdeRadarIds, zichtbareSet],
  );

  const valideerOpvolgselectie = (): string[] | null => {
    if (zichtbareSelectie.length === 0) {
      toast.info('Selecteer eerst één of meer dossiers in Opvolgen.');
      return null;
    }
    if (zichtbareSelectie.length !== geselecteerdeRadarIds.length) {
      toast.warning('Je selectie bevat ook dossiers buiten de huidige Opvolgen-lijst.', {
        description: 'Wis de selectie en selecteer alleen de vervolgacties die je nu wilt verwerken.',
      });
      return null;
    }
    return zichtbareSelectie;
  };

  const openVolgendeBrief = () => {
    if (!valideerOpvolgselectie()) return;
    onVolgendeBrief();
  };

  const openEmailOpvolging = () => {
    const ids = valideerOpvolgselectie();
    if (!ids) return;
    setEmailScopeIds(ids);
    setEmailOpenGevraagd(true);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2.5" data-testid="acquisitie-werkbak-chips">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Werkbak</span>
        <div role="tablist" aria-label="Werkbak" data-testid="acquisitie-werkbak-hoofd" className="flex flex-wrap gap-1.5">
          {HOOFD_VOLGORDE.map(id => {
            const actief = werkbak === id;
            const aantal = counts.werkbak[id] ?? 0;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={actief}
                data-testid={`acquisitie-werkbak-${id}`}
                onClick={() => onWerkbakChange(id)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                  actief
                    ? 'border-accent bg-accent/10 text-accent shadow-sm'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <span>{id === 'alles' ? 'Alle dossiers' : WERKBAK_LABEL[id]}</span>
                <span className={`rounded px-1.5 py-0.5 font-mono-data text-[10px] leading-none ${
                  actief ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                }`}>{aantal}</span>
              </button>
            );
          })}
        </div>
      </div>

      {werkbak === 'actie' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Actiestap</span>
          <div role="tablist" aria-label="Actiestap" data-testid="acquisitie-werkbak-sub" className="flex flex-wrap gap-1.5">
            {SUB_VOLGORDE.filter((id) => (
              id === 'alle' || id === subfilter || (counts.subfilter[id] ?? 0) > 0
            )).map(id => {
              const actief = subfilter === id;
              const aantal = counts.subfilter[id] ?? 0;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={actief}
                  data-testid={`acquisitie-subfilter-${id}`}
                  onClick={() => onSubfilterChange(id)}
                  className={`inline-flex min-h-7 items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] transition-colors ${
                    actief
                      ? 'border-foreground/40 bg-foreground/5 font-medium text-foreground'
                      : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  <span>{ACTIE_SUBFILTER_LABEL[id]}</span>
                  <span className="font-mono-data text-[10px] opacity-80">{aantal}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {werkbak === 'actie' && subfilter === 'opvolgen' && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/20 bg-accent/5 px-2.5 py-2" data-testid="acquisitie-centrale-opvolgacties">
          <div className="mr-auto min-w-[12rem]">
            <p className="text-[11px] font-medium text-foreground">Centrale opvolging</p>
            <p className="text-[10px] text-muted-foreground">Selecteer dossiers hieronder en kies de volgende campagnestap.</p>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={openVolgendeBrief} data-testid="acquisitie-opvolgen-volgende-brief">
            <Mail className="h-3.5 w-3.5" />Volgende brief
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={openEmailOpvolging} disabled={emailOpenGevraagd} data-testid="acquisitie-opvolgen-email">
            <Send className="h-3.5 w-3.5" />{emailOpenGevraagd ? 'E-mail laden…' : 'E-mail opvolgen'}
          </Button>
        </div>
      )}

      <BulkEmailVoorbereidenDialog
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        signalen={emailSignalen}
        brieven={emailBrieven}
      />
    </div>
  );
}
