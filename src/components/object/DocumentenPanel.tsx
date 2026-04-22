// src/components/object/DocumentenPanel.tsx
// Upload en beheer van documenten voor een object.

import { useRef, useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { useAuth } from '@/hooks/useAuth';
import {
  uploadBestand,
  buildDocumentPath,
  getSignedUrl,
  formatFileSize,
  MAX_FILE_SIZE_MB,
} from '@/lib/storage';
import { DOCUMENT_TYPE_LABELS, formatDate } from '@/data/mock-data';
import type { DocumentType, ObjectDocument } from '@/data/mock-data';
import { Upload, File as FileIcon, Trash2, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  objectId: string;
}

export default function DocumentenPanel({ objectId }: Props) {
  const { user } = useAuth();
  const store = useDataStore();
  const docs = store.getDocumentenVoorObject(objectId);
  const [bezig, setBezig] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const kiesBestanden = () => fileInput.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setBezig(true);
    const files = Array.from(fileList);
    let ok = 0, fout = 0;
    for (const file of files) {
      try {
        const path = buildDocumentPath(objectId, file.name);
        const result = await uploadBestand(path, file);
        await store.addDocument({
          objectId,
          documenttype: raadDocumentType(file.name),
          bestandsnaam: result.bestandsnaam,
          storagePath: result.storagePath,
          bestandsgrootteBytes: result.bestandsgrootteBytes,
          mimeType: result.mimeType,
          vertrouwelijk: true,
          geuploadDoor: user?.id,
        });
        ok++;
      } catch (err: any) {
        console.error('Upload mislukt voor', file.name, err);
        fout++;
      }
    }
    setBezig(false);
    if (fileInput.current) fileInput.current.value = '';
    if (ok > 0) toast.success(`${ok} bestand${ok === 1 ? '' : 'en'} geüpload`);
    if (fout > 0) toast.error(`${fout} bestand${fout === 1 ? '' : 'en'} mislukt`);
  };

  const handleTypeWissel = async (doc: ObjectDocument, nieuwType: DocumentType) => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { error } = await supabase.from('object_documenten' as any)
        .update({ documenttype: nieuwType } as any)
        .eq('id', doc.id);
      if (error) throw error;
      await store.refresh();
      toast.success('Documenttype bijgewerkt');
    } catch (err: any) {
      toast.error('Bijwerken mislukt');
    }
  };

  const handleDelete = async (doc: ObjectDocument) => {
    if (!confirm(`"${doc.bestandsnaam}" verwijderen?`)) return;
    try {
      await store.deleteDocument(doc.id);
      toast.success('Document verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    }
  };

  const handleDownload = async (doc: ObjectDocument) => {
    try {
      const url = await getSignedUrl(doc.storagePath);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      toast.error(err.message ?? 'Download mislukt');
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <div
        className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-accent hover:bg-muted/30 transition-colors"
        onClick={kiesBestanden}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        {bezig ? (
          <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        )}
        <p className="text-sm text-foreground mt-2">
          Klik om bestanden te kiezen of sleep ze hiernaartoe
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word, Excel, afbeeldingen · max {MAX_FILE_SIZE_MB} MB per bestand
        </p>
      </div>

      <div className="space-y-2">
        {docs.length === 0 && (
          <p className="text-sm text-muted-foreground italic px-1">
            Nog geen documenten geüpload.
          </p>
        )}
        {docs.map(doc => (
          <div key={doc.id} className="flex items-center gap-3 border border-border rounded-md p-3 bg-card">
            <FileIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{doc.bestandsnaam}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(doc.bestandsgrootteBytes)}
                {doc.createdAt && ` · ${formatDate(doc.createdAt.split('T')[0])}`}
              </p>
            </div>
            <select
              value={doc.documenttype}
              onChange={e => handleTypeWissel(doc, e.target.value as DocumentType)}
              className="shrink-0 h-9 px-2 text-xs rounded-md border border-input bg-background"
            >
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleDownload(doc)}
              className="p-2 hover:bg-muted rounded shrink-0"
              aria-label="Downloaden"
            >
              <Download className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => handleDelete(doc)}
              className="p-2 hover:bg-destructive/10 rounded shrink-0"
              aria-label="Verwijderen"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------

function raadDocumentType(filename: string): DocumentType {
  const s = filename.toLowerCase();
  if (s.includes('huur') || s.includes('lease')) return 'huurovereenkomst';
  if (s.includes('taxatie')) return 'taxatierapport';
  if (s.includes('mjop')) return 'mjop';
  if (s.includes('asbest')) return 'asbestinventarisatie';
  if (s.includes('bouwkun')) return 'bouwkundig_rapport';
  if (s.includes('energielabel') || s.includes('energie')) return 'energielabel_rapport';
  if (s.includes('im') || s.includes('informatie')) return 'informatiememorandum';
  if (s.includes('plattegrond') || s.includes('floorplan')) return 'plattegrond';
  if (s.includes('kadaster')) return 'kadasterbericht';
  if (s.includes('woz')) return 'wozbeschikking';
  if (s.includes('jaarrekening')) return 'jaarrekening_huurder';
  if (s.includes('foto')) return 'fotorapport';
  if (s.includes('dd') || s.includes('due')) return 'dd_overzicht';
  return 'anders';
}
