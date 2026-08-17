// V2 — Gecombineerde brief-PDF voor de Off-Market Acquisitieselectie.
// Iedere afzonderlijke brief krijgt zijn eigen <Page> (sibling), waardoor
// een nieuwe brief altijd op een nieuwe pagina begint. Binnen één brief
// mag de inhoud op meerdere pagina's doorlopen via `wrap`. Hergebruikt de
// bestaande `BriefPagina`-component — geen gedupliceerde opmaak.

import { Document } from '@react-pdf/renderer';
import { BriefPagina, type BriefLogoOptie } from '@/components/offmarket/BriefPDF';
import type { BriefViewModel } from '@/lib/offMarket/brief';

export interface GecombineerdeBriefItem {
  /** Stabiele key voor React reconciliation. */
  key: string;
  vm: BriefViewModel;
  logo?: BriefLogoOptie;
}

export interface GecombineerdeBrievenPDFProps {
  items: GecombineerdeBriefItem[];
  /** Titel van het PDF-document (metadata). */
  title?: string;
  /** Optioneel watermerk op iedere pagina, bijvoorbeeld `CONCEPT`. */
  watermerk?: string | null;
}

export default function GecombineerdeBrievenPDF({
  items, title, watermerk = null,
}: GecombineerdeBrievenPDFProps) {
  return (
    <Document title={title ?? 'Bito Vastgoed — gecombineerde brieven'}>
      {items.map((it) => (
        <BriefPagina key={it.key} vm={it.vm} logo={it.logo} watermerk={watermerk} />
      ))}
    </Document>
  );
}
