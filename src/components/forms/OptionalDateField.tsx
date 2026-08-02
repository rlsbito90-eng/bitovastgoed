import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OptionalDateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function OptionalDateField({ id, label, value, onChange, disabled }: OptionalDateFieldProps) {
  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-w-0 items-center gap-2">
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="min-w-0 flex-1"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange('')}
            disabled={disabled}
            className="shrink-0 px-2 text-xs text-muted-foreground"
          >
            Wissen
          </Button>
        )}
      </div>
    </div>
  );
}
