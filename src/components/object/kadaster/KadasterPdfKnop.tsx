// Knop om een intern opgeslagen Kadasterbericht/PDF te openen via een
// tijdelijke signed URL. Intern only — niet voor klant/dataroom.
import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  openKadasterDocument, type KadasterDocument,
} from '@/hooks/useKadasterDocumenten';

interface Props {
  document: KadasterDocument;
  label?: string;
  size?: 'sm' | 'default';
  variant?: 'outline' | 'secondary' | 'default' | 'ghost';
}

export default function KadasterPdfKnop({
  document: doc, label = 'PDF openen', size = 'sm', variant = 'outline',
}: Props) {
  const [bezig, setBezig] = useState(false);
  async function openen() {
    setBezig(true);
    try {
      // Altijd een verse signed URL aanvragen — verlopen URL's worden
      // nooit gecached, dus een PDF "verdwijnt" niet door expiratie.
      await openKadasterDocument(doc);
    } catch (e) {
      const detail = e instanceof Error ? e.message : '';
      toast.error(
        'Kadasterbericht bestaat, maar kon tijdelijk niet worden geopend. ' +
        'Probeer opnieuw of controleer opslagrechten.' + (detail ? ` (${detail})` : ''),
      );
    } finally {
      setBezig(false);
    }
  }
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={openen}
      disabled={bezig}
      className="h-7 text-[11px]"
      title={doc.bestandsnaam}
    >
      {bezig
        ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        : <FileText className="h-3 w-3 mr-1" />}
      {label}
    </Button>
  );
}
