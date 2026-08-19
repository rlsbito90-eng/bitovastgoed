import type { ComponentProps } from 'react';
import { pdf } from '@react-pdf/renderer';
import BriefPDF from '@/components/offmarket/BriefPDF';

type BriefPdfViewModel = ComponentProps<typeof BriefPDF>['vm'];

/**
 * Zware PDF-runtime bewust in een apart modulepad.
 * Callers importeren deze helper pas op het moment dat de gebruiker
 * daadwerkelijk een PDF aanvraagt.
 */
export async function generateBriefPdfBlob(vm: BriefPdfViewModel): Promise<Blob> {
  return pdf(<BriefPDF vm={vm} />).toBlob();
}
