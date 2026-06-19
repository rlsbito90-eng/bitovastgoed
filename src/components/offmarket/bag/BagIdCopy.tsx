// V2.4 — Toont een volledig BAG-ID (VBO/Pand/NA) met optionele kopieerknop.
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface Props {
  value: string | null | undefined;
  testId?: string;
  ariaLabel?: string;
}

export default function BagIdCopy({ value, testId, ariaLabel }: Props) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <span data-testid={testId} className="font-mono text-xs text-muted-foreground">—</span>
    );
  }

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* fail-soft */
    }
  };

  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span
        data-testid={testId}
        title={value}
        className="font-mono text-xs break-all text-foreground"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={onCopy}
        aria-label={ariaLabel ?? `Kopieer ${value}`}
        className="inline-flex items-center justify-center h-4 w-4 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        data-testid={testId ? `${testId}-copy` : undefined}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}
