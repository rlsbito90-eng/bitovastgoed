import { RefreshCw } from 'lucide-react';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { toast } from 'sonner';

interface Props {
  className?: string;
  label?: string;
}

/**
 * Subtiele refresh-knop voor in headers. Geen dominante CTA.
 */
export default function RefreshButton({ className = '', label = 'Vernieuwen' }: Props) {
  const { refresh, refreshing } = useAppRefresh();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await refresh();
          toast.success('Bijgewerkt', { duration: 1500 });
        } catch (e: any) {
          toast.error(`Vernieuwen mislukt: ${e?.message ?? 'onbekende fout'}`);
        }
      }}
      disabled={refreshing}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 ${className}`}
    >
      <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
    </button>
  );
}
