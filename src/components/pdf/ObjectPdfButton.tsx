// src/components/pdf/ObjectPdfButton.tsx
//
// PDF-download knop voor object-detail. Batch 8b:
// - Marktwaarde-indicatie wordt nu opgehaald van object-niveau referenties
//   (na batch 8a verhuisd vanuit deal-niveau)
// - Marktwaarde default AAN in dialog
// - Subcategorie-label wordt automatisch meegegeven aan PDFs

import { useState, useMemo } from 'react';
import { pdf } from '@react-pdf/renderer';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDataStore } from '@/hooks/useDataStore';
import { useSubcategorieen } from '@/hooks/useSubcategorieen';
import { getSignedUrl } from '@/lib/storage';
import type { ObjectVastgoed } from '@/data/mock-data';
import ObjectOnepagerPDF from '@/components/pdf/ObjectOnepagerPDF';
import ObjectBrochurePDF from '@/components/pdf/ObjectBrochurePDF';

interface Props {
  object: ObjectVastgoed;
}

type PdfTypeKeuze = 'onepager' | 'brochure';

function mediaan(getallen: number[]): number | undefined {
  if (getallen.length === 0) return undefined;
  const sorted = [...getallen].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export default function ObjectPdfButton({ object }: Props) {
  const store = useDataStore();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const [type, setType] = useState<PdfTypeKeuze>('onepager');
  const [includeMarktwaarde, setIncludeMarktwaarde] = useState(true); // default AAN
  const [includeFotos, setIncludeFotos] = useState(true);

  // Beschikbare data
  const huurders = useMemo(
    () => store.getHuurdersVoorObject(object.id),
    [store, object.id],
  );
  const fotos = useMemo(
    () => store.getFotosVoorObject(object.id).sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0)),
    [store, object.id],
  );
  const { byId: getSubById } = useSubcategorieen();
  const subcategorieLabel = useMemo(() => {
    if (!object.subcategorieId) return undefined;
    return getSubById(object.subcategorieId)?.label;
  }, [object.subcategorieId, getSubById]);

  // Marktwaarde-indicatie uit object-niveau referenties (post-8a)
  const marktwaardeMediaan = useMemo(() => {
    const refs = store.getReferentiesVoorObject?.(object.id) ?? [];
    if (refs.length < 2) return undefined;
    const m2 = object.oppervlakteVvo ?? object.oppervlakte;
    if (!m2 || m2 <= 0) return undefined;

    const perM2 = refs
      .map(r => r.prijsPerM2)
      .filter((v): v is number => v != null && !Number.isNaN(v));
    if (perM2.length < 2) return undefined;

    const med = mediaan(perM2);
    if (med == null) return undefined;
    return Math.round(med * m2);
  }, [store, object]);

  // WALT/WALB/jaarhuur uit huurders
  const huurMetrics = useMemo(() => {
    if (huurders.length === 0) return { walt: null, walb: null, totaleJaarhuur: null };
    const nu = new Date();
    const totaleJaarhuur = huurders.reduce((s, h) => s + (h.jaarhuur ?? 0), 0);
    let waltSum = 0;
    let walbSum = 0;
    let waltGewicht = 0;
    let walbGewicht = 0;
    for (const h of huurders) {
      const huurJaren = h.einddatum
        ? Math.max(0, (new Date(h.einddatum).getTime() - nu.getTime()) / (1000 * 60 * 60 * 24 * 365))
        : null;
      // Geen aparte break-optie datum in datamodel — WALB == WALT als fallback
      const breakJaren = huurJaren;
      const gewicht = h.jaarhuur ?? 0;
      if (huurJaren != null && gewicht > 0) {
        waltSum += huurJaren * gewicht;
        waltGewicht += gewicht;
      }
      if (breakJaren != null && gewicht > 0) {
        walbSum += breakJaren * gewicht;
        walbGewicht += gewicht;
      }
    }
    return {
      walt: waltGewicht > 0 ? Math.round((waltSum / waltGewicht) * 10) / 10 : null,
      walb: walbGewicht > 0 ? Math.round((walbSum / walbGewicht) * 10) / 10 : null,
      totaleJaarhuur: totaleJaarhuur > 0 ? totaleJaarhuur : null,
    };
  }, [huurders]);

  const handleGenereer = async () => {
    setBezig(true);
    try {
      let hoofdfotoUrl: string | undefined;
      let extraFotoUrls: string[] = [];

      if (includeFotos && fotos.length > 0) {
        const hoofd = fotos.find(f => f.isHoofdfoto) ?? fotos[0];
        if (hoofd?.bestandspad) {
          hoofdfotoUrl = await downloadFotoUrl(hoofd.bestandspad);
        }
        if (type === 'brochure') {
          const extras = fotos.filter(f => f.id !== hoofd?.id).slice(0, 4);
          extraFotoUrls = await Promise.all(
            extras.map(f => downloadFotoUrl(f.bestandspad)),
          );
        }
      }

      const marktwaardeArg = includeMarktwaarde ? marktwaardeMediaan : undefined;

      const doc = type === 'onepager'
        ? <ObjectOnepagerPDF
            object={object}
            hoofdfotoUrl={hoofdfotoUrl}
            marktwaardeMediaan={marktwaardeArg}
            subcategorieLabel={subcategorieLabel}
          />
        : <ObjectBrochurePDF
            object={object}
            hoofdfotoUrl={hoofdfotoUrl}
            fotoUrls={extraFotoUrls}
            huurders={huurders}
            walt={huurMetrics.walt}
            walb={huurMetrics.walb}
            totaleJaarhuur={huurMetrics.totaleJaarhuur}
            subcategorieLabel={subcategorieLabel}
            marktwaardeMediaan={marktwaardeArg}
          />;

      const blob = await pdf(doc).toBlob();

      const titelClean = (object.anoniem && object.publiekeNaam ? object.publiekeNaam : object.titel)
        .replace(/[^a-zA-Z0-9 \-_]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 50);
      const datum = new Date().toISOString().split('T')[0];
      const suffix = type === 'onepager' ? '1-pager' : 'IM';
      const filename = `Bito-${suffix}-${titelClean}-${datum}.pdf`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`${type === 'onepager' ? '1-pager' : 'Brochure'} gegenereerd`);
      setOpen(false);
    } catch (err: any) {
      console.error('PDF generatie fout:', err);
      toast.error(`PDF genereren mislukt: ${err?.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <FileDown className="h-4 w-4" />
        <span>PDF</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => !bezig && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PDF genereren</DialogTitle>
            <DialogDescription>
              Kies het document-type en welke informatie meegenomen wordt.
            </DialogDescription>
          </DialogHeader>

          {/* TYPE KEUZE */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documenttype</p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setType('onepager')}
                className={`text-left p-3 rounded-md border transition-colors ${
                  type === 'onepager'
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${type === 'onepager' ? 'text-accent' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">1-pager</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Eén pagina met kerninformatie. Voor cold outreach naar investeerders.
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setType('brochure')}
                className={`text-left p-3 rounded-md border transition-colors ${
                  type === 'brochure'
                    ? 'border-accent bg-accent/5'
                    : 'border-border hover:border-accent/40'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${type === 'brochure' ? 'text-accent' : 'text-muted-foreground'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Brochure / Investment Memorandum</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      4-6 pagina's met cover, kerngegevens, financieel, verhuur en juridisch.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* OPTIES */}
          <div className="space-y-2 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Opties</p>

            <label className="flex items-start gap-2 p-2.5 rounded-md bg-muted/30 cursor-pointer hover:bg-muted/40 transition-colors">
              <input
                type="checkbox"
                checked={includeFotos}
                onChange={e => setIncludeFotos(e.target.checked)}
                disabled={fotos.length === 0}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Foto's meenemen</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fotos.length === 0 ? 'Geen foto\'s beschikbaar' : `${fotos.length} foto${fotos.length === 1 ? '' : '\'s'} beschikbaar`}
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-2 p-2.5 rounded-md cursor-pointer transition-colors ${
              marktwaardeMediaan != null
                ? 'bg-muted/30 hover:bg-muted/40'
                : 'bg-muted/20 cursor-not-allowed opacity-60'
            }`}>
              <input
                type="checkbox"
                checked={includeMarktwaarde && marktwaardeMediaan != null}
                onChange={e => setIncludeMarktwaarde(e.target.checked)}
                disabled={marktwaardeMediaan == null}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Marktwaarde-indicatie meenemen</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {marktwaardeMediaan != null
                    ? 'Op basis van gekoppelde referentieobjecten'
                    : 'Niet beschikbaar — koppel min. 2 referenties met €/m² op object-detail'}
                </p>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={bezig}>
              Annuleren
            </Button>
            <Button onClick={handleGenereer} disabled={bezig} className="gap-1.5">
              {bezig ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Bezig…
                </>
              ) : (
                <>
                  <FileDown className="h-4 w-4" /> Genereer PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
