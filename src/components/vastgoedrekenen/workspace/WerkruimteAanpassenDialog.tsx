import {
  VR_WIDGET_LABELS,
  VR_WIDGETS,
  moveWidget,
  resetLayoutPrefs,
  toggleWidget,
  type VrLayoutPrefs,
} from '@/lib/vastgoedrekenen/workspaceLayoutPrefs';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronDown, ChevronUp } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: VrLayoutPrefs;
  onChange: (prefs: VrLayoutPrefs) => void;
};

export default function WerkruimteAanpassenDialog({ open, onOpenChange, prefs, onChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Werkruimte aanpassen</DialogTitle>
          <DialogDescription>
            Bepaal welke overzichtsblokken je op de startpagina ziet en in welke volgorde.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {prefs.order.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2"
              data-testid={`vr-widget-rij-${id}`}
            >
              <span className="flex-1 text-sm">{VR_WIDGET_LABELS[id]}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${VR_WIDGET_LABELS[id]} omhoog`}
                disabled={index === 0}
                onClick={() => onChange(moveWidget(prefs, id, -1))}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`${VR_WIDGET_LABELS[id]} omlaag`}
                disabled={index === prefs.order.length - 1}
                onClick={() => onChange(moveWidget(prefs, id, 1))}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Switch
                checked={!prefs.hidden.includes(id)}
                aria-label={`${VR_WIDGET_LABELS[id]} tonen`}
                onCheckedChange={() => onChange(toggleWidget(prefs, id))}
              />
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            data-testid="vr-layout-herstellen"
            onClick={() => onChange(resetLayoutPrefs())}
          >
            Standaardlayout herstellen
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Klaar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { VR_WIDGETS };
