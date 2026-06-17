import { ArrowUpCircle, EyeOff, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  pending?: boolean;
  onPromoot: () => void;
  onVerberg: () => void;
  onWissen: () => void;
}

export default function AfgekeurdeRecordsBulkToolbar({
  count, pending, onPromoot, onVerberg, onWissen,
}: Props) {
  return (
    <div
      data-testid="bulk-toolbar"
      className="sticky top-0 z-10 -mx-1 px-3 py-2 mb-3 flex flex-wrap items-center gap-2 bg-card/95 backdrop-blur border border-border rounded-md shadow-sm"
    >
      <span className="text-xs font-medium text-foreground mr-1">
        <span className="font-mono-data">{count}</span> geselecteerd
      </span>
      <div className="ml-auto flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={pending} onClick={onPromoot}>
          {pending
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <ArrowUpCircle className="h-3.5 w-3.5 mr-1" />}
          Promoveren
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={onVerberg}>
          {pending
            ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            : <EyeOff className="h-3.5 w-3.5 mr-1" />}
          Verbergen
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={onWissen}>
          <X className="h-3.5 w-3.5 mr-1" /> Selectie wissen
        </Button>
      </div>
    </div>
  );
}
