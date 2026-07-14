// src/components/object/FocusPointDialog.tsx
// Modal om het kijkpunt (focal point) van een foto te bepalen.
// Klik/tap op de foto verplaatst de crosshair. Waarden worden opgeslagen
// als percentages (0-100) en toegepast als CSS `object-position`.

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export function clampFocusValue(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, Math.round(v)));
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  initialFocusX?: number;
  initialFocusY?: number;
  onSave: (focusX: number, focusY: number) => Promise<void> | void;
}

export default function FocusPointDialog({
  open, onOpenChange, imageUrl, initialFocusX = 50, initialFocusY = 50, onSave,
}: Props) {
  const [fx, setFx] = useState(clampFocusValue(initialFocusX));
  const [fy, setFy] = useState(clampFocusValue(initialFocusY));
  const [saving, setSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (open) {
      setFx(clampFocusValue(initialFocusX));
      setFy(clampFocusValue(initialFocusY));
    }
  }, [open, initialFocusX, initialFocusY]);

  const pickFromEvent = (clientX: number, clientY: number) => {
    const el = imgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    setFx(clampFocusValue(x));
    setFy(clampFocusValue(y));
  };

  const handleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    pickFromEvent(e.clientX, e.clientY);
  };

  const handleTouch = (e: React.TouchEvent<HTMLImageElement>) => {
    const t = e.touches[0] ?? e.changedTouches[0];
    if (!t) return;
    e.preventDefault();
    pickFromEvent(t.clientX, t.clientY);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(clampFocusValue(fx), clampFocusValue(fy));
      onOpenChange(false);
    } catch (err: any) {
      console.error('Kijkpunt opslaan mislukt:', err);
      toast.error(err?.message ?? 'Kijkpunt opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setFx(50);
    setFy(50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kijkpunt instellen</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Klik of tik op de foto om te kiezen welk punt centraal blijft bij automatisch uitsnijden.
          </p>

          {/* Hoofdpreview met marker */}
          <div className="relative w-full bg-muted rounded-md overflow-hidden select-none">
            {imageUrl ? (
              <img
                ref={imgRef}
                src={imageUrl}
                alt=""
                draggable={false}
                onClick={handleClick}
                onTouchStart={handleTouch}
                className="block w-full h-auto max-h-[60vh] object-contain cursor-crosshair touch-none"
                data-testid="focus-point-image"
              />
            ) : (
              <div className="w-full aspect-video flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {/* Crosshair */}
            <div
              className="pointer-events-none absolute"
              style={{ left: `${fx}%`, top: `${fy}%`, transform: 'translate(-50%, -50%)' }}
              data-testid="focus-point-marker"
              data-fx={fx}
              data-fy={fy}
            >
              <div className="h-8 w-8 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)] bg-accent/40 backdrop-blur-sm" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-1.5 w-1.5 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>

          {/* Crop preview */}
          {imageUrl && (
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cover-preview</p>
              <div
                className="w-full aspect-[21/9] bg-muted rounded-md overflow-hidden"
                style={{
                  backgroundImage: `url(${imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: `${fx}% ${fy}%`,
                  backgroundRepeat: 'no-repeat',
                }}
                data-testid="focus-point-preview"
              />
            </div>
          )}

          <p className="text-[11px] text-muted-foreground font-mono">
            Kijkpunt: {fx}% × {fy}%
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={saving}
            className="mr-auto"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Reset naar midden
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuleren
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
