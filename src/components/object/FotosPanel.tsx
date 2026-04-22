// src/components/object/FotosPanel.tsx
// Foto-galerij per object. Upload meerdere tegelijk. Eerste upload wordt
// automatisch hoofdfoto als er nog geen is. Signed URLs voor thumbnails.

import { useEffect, useRef, useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { useAuth } from '@/hooks/useAuth';
import {
  uploadBestand, buildFotoPath, getSignedUrls, isFotoFile, MAX_FILE_SIZE_MB,
} from '@/lib/storage';
import { Upload, Star, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  objectId: string;
}

export default function FotosPanel({ objectId }: Props) {
  const { user } = useAuth();
  const store = useDataStore();
  const fotos = store.getFotosVoorObject(objectId);
  const [bezig, setBezig] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Signed URLs ophalen zodra set foto's verandert
  useEffect(() => {
    const paths = fotos.map(f => f.storagePath).filter(Boolean);
    if (paths.length === 0) { setUrls({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const map = await getSignedUrls(paths, 60 * 30); // 30 min
        if (!cancelled) setUrls(map);
      } catch { /* noop */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotos.map(f => f.storagePath).join('|')]);

  const kies = () => fileInput.current?.click();

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).filter(isFotoFile);
    if (files.length === 0) {
      toast.error('Alleen afbeeldingen kunnen als foto worden geüpload');
      return;
    }
    setBezig(true);
    let ok = 0, fout = 0;
    const alBestaand = fotos.length;
    const heeftHoofd = fotos.some(f => f.isHoofdfoto);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const path = buildFotoPath(objectId, file.name);
        const result = await uploadBestand(path, file);
        await store.addFoto({
          objectId,
          storagePath: result.storagePath,
          isHoofdfoto: !heeftHoofd && ok === 0,
          volgorde: alBestaand + i,
          bestandsgrootteBytes: result.bestandsgrootteBytes,
        });
        ok++;
      } catch (err: any) {
        console.error('Foto-upload mislukt:', err);
        fout++;
      }
    }
    setBezig(false);
    if (fileInput.current) fileInput.current.value = '';
    if (ok > 0) toast.success(`${ok} foto${ok === 1 ? '' : "'s"} geüpload`);
    if (fout > 0) toast.error(`${fout} mislukt`);
  };

  const handleSetHoofd = async (fotoId: string) => {
    try {
      await store.setHoofdfoto(objectId, fotoId);
    } catch (err: any) {
      toast.error(err.message ?? 'Wijzigen mislukt');
    }
  };

  const handleDelete = async (fotoId: string) => {
    if (!confirm('Foto verwijderen?')) return;
    try {
      await store.deleteFoto(fotoId);
      toast.success('Foto verwijderd');
    } catch (err: any) {
      toast.error(err.message ?? 'Verwijderen mislukt');
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <div
        className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-accent hover:bg-muted/30 transition-colors"
        onClick={kies}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        {bezig ? (
          <Loader2 className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
        ) : (
          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        )}
        <p className="text-sm text-foreground mt-2">
          Klik of sleep foto's hiernaartoe
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WEBP, HEIC · max {MAX_FILE_SIZE_MB} MB per foto
        </p>
      </div>

      {fotos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic px-1">
          Nog geen foto's geüpload.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fotos.map(foto => (
            <div key={foto.id} className="relative group border border-border rounded-md overflow-hidden bg-muted/30 aspect-[4/3]">
              {urls[foto.storagePath] ? (
                <img
                  src={urls[foto.storagePath]}
                  alt={foto.bijschrift ?? ''}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              )}
              {foto.isHoofdfoto && (
                <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shadow">
                  <Star className="h-3 w-3 fill-current" /> Hoofd
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {!foto.isHoofdfoto && (
                  <button
                    type="button"
                    onClick={() => handleSetHoofd(foto.id)}
                    className="p-2 bg-card rounded-full shadow hover:bg-accent hover:text-accent-foreground transition-colors"
                    aria-label="Als hoofdfoto"
                    title="Als hoofdfoto"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(foto.id)}
                  className="p-2 bg-card rounded-full shadow hover:bg-destructive hover:text-destructive-foreground transition-colors"
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
