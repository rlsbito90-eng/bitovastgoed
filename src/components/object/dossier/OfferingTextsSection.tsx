// Aanbiedingsteksten als grid van kaarten. Per kaart inline bewerken en opslaan.

import type { OfferingTextsRow } from '@/hooks/useObjectDossier';
import OfferingTextCard, { type OfferingFieldKey } from './OfferingTextCard';

interface FieldDef {
  key: OfferingFieldKey;
  label: string;
  description?: string;
  rows: number;
  klaarMin?: number;
  span?: 'normal' | 'wide';
}

const FIELDS: FieldDef[] = [
  { key: 'korte_teaser',             label: 'Korte teaser',           description: 'Eén alinea om snel te delen.', rows: 4, klaarMin: 80 },
  { key: 'whatsapp_tekst',           label: 'WhatsApp tekst',         description: 'Compact, persoonlijk, met call-to-action.', rows: 5, klaarMin: 80 },
  { key: 'email_tekst',              label: 'E-mailtekst',            description: 'Voor introductie aan kandidaten.', rows: 7, klaarMin: 200, span: 'wide' },
  { key: 'uitgebreide_omschrijving', label: 'Uitgebreide omschrijving', description: 'Voor IM of teaser-deck.', rows: 8, klaarMin: 400, span: 'wide' },
  { key: 'highlights',               label: 'Highlights',             description: 'Bullets met USP\u2019s.', rows: 5, klaarMin: 60 },
  { key: 'externe_aandachtspunten',  label: 'Externe aandachtspunten', description: 'Wat moet de koper weten?', rows: 5, klaarMin: 80 },
  { key: 'fee_tekst',                label: 'Fee-tekst',              description: 'Standaardformulering courtage / fee.', rows: 4, klaarMin: 60 },
  { key: 'nda_tekst',                label: 'NDA / informatievoorbehoud', description: 'Korte tekst bij delen vertrouwelijke info.', rows: 4, klaarMin: 60 },
];

interface Props {
  objectId: string;
  initial: OfferingTextsRow | null;
  onSaved: () => void;
}

export default function OfferingTextsSection({ objectId, initial, onSaved }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {FIELDS.map(f => (
        <div key={f.key} className={f.span === 'wide' ? 'md:col-span-2' : ''}>
          <OfferingTextCard
            objectId={objectId}
            fieldKey={f.key}
            label={f.label}
            description={f.description}
            rows={f.rows}
            klaarMin={f.klaarMin}
            value={(initial?.[f.key] as string) ?? ''}
            onSaved={onSaved}
          />
        </div>
      ))}
    </div>
  );
}
