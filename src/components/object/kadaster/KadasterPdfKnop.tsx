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
      await openKadasterDocument(doc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kon Kadasterbericht niet openen.');
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
