import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  openKadasterDocument,
  useKadasterDocumentenForSignaal,
} from '@/hooks/useKadasterDocumenten';

interface Props {
  signaalId: string;
  label?: string;
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  /** Verberg de knop volledig wanneer er nog geen Rechten-PDF is. */
  hideWhenMissing?: boolean;
}

/**
 * Opent het meest recente intern opgeslagen Rechten-Kadasterbericht voor een
 * signaal. Dit doet uitsluitend een read + tijdelijke signed URL en start
 * nooit een nieuwe Kadasteraanvraag.
 */
export default function KadasterBerichtOpenKnop({
  signaalId,
  label = 'Kadasterbericht openen',
  className,
  size = 'sm',
  variant = 'outline',
  hideWhenMissing = false,
}: Props) {
  const { data: documenten = [], isLoading } = useKadasterDocumentenForSignaal(signaalId);
  const [bezig, setBezig] = useState(false);
  const document = documenten.find((d) => (d.product_codes ?? []).includes('rechten')) ?? null;

  if (hideWhenMissing && !isLoading && !document) return null;

  const open = async () => {
    if (!document || bezig) return;
    setBezig(true);
    try {
      await openKadasterDocument(document);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kon Kadasterbericht niet openen.');
    } finally {
      setBezig(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => { void open(); }}
      disabled={isLoading || bezig || !document}
      data-testid="kadaster-bericht-direct-openen"
      title={!isLoading && !document ? 'Nog geen opgeslagen Rechten-Kadasterbericht beschikbaar.' : undefined}
    >
      {isLoading || bezig
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <FileText className="h-4 w-4" />}
      {label}
    </Button>
  );
}
