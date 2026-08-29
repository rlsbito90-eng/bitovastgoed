import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OptionalDateFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function OptionalDateField({ id, label, value, onChange, disabled }: OptionalDateFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <div className="min-w-0">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="min-w-0"
      />
    </div>
  );
}

export default OptionalDateField;
