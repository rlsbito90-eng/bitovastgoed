import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

/**
 * Kleine toggle waarmee de gebruiker een veld expliciet als "Bewust € 0"
 * kan markeren. Hierdoor wordt een leeg veld onderscheiden van een bewuste nul.
 *
 * - Bij aanvinken wordt de waarde op 0 gezet en het veld toegevoegd aan de
 *   manual_zero_fields-lijst van het scenario.
 * - Bij uitvinken wordt het veld uit de lijst verwijderd en de waarde gewist
 *   (naar null), zodat het weer als "leeg" telt.
 */
export default function ManualZeroToggle({
  active,
  value,
  onToggle,
}: {
  active: boolean;
  value: number | null | undefined;
  onToggle: (next: boolean) => void;
}) {
  const id = `mzero-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <div className="flex items-center gap-2 pt-1">
      <Checkbox id={id} checked={active} onCheckedChange={(v) => onToggle(!!v)} className="h-3.5 w-3.5" />
      <label htmlFor={id} className="text-[10px] leading-none text-muted-foreground cursor-pointer select-none">
        Bewust € 0
      </label>
      {active && Number(value ?? 0) === 0 && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-normal">Bewust € 0</Badge>
      )}
    </div>
  );
}
