import type { ActieSubfilter, WerkbakContext, WerkbakView } from './werkbak';
import { bepaalPrintPostGroep, type PrintPostFilter } from './printPostFilter';
import type { FocusTab } from './focusContext';
import type { WerkrondeBron } from './werkronde';

export function werkrondeBronVoorView(input: {
  heeftHandmatigeSelectie: boolean;
  werkbak: WerkbakView;
  subfilter: ActieSubfilter;
  printPost: PrintPostFilter;
}): WerkrondeBron {
  if (input.heeftHandmatigeSelectie) return 'handmatig';
  if (input.werkbak !== 'actie') return 'handmatig';
  if (input.subfilter === 'onderzoeken') return 'onderzoeken';
  if (input.subfilter === 'brief_voorbereiden') return 'brief_voorbereiden';
  if (input.subfilter === 'opvolgen') return 'opvolgen';
  if (input.subfilter === 'printen_posten' && input.printPost !== 'alles') return input.printPost;
  return 'werkbak';
}

export function hoortWerkbakContextBijBron(
  bron: WerkrondeBron,
  ctx: WerkbakContext | undefined,
): boolean {
  if (!ctx) return false;
  if (bron === 'onderzoeken') {
    return ctx.werkbak === 'actie' && ctx.actieSubfilter === 'onderzoeken';
  }
  if (bron === 'brief_voorbereiden') {
    return ctx.werkbak === 'actie' && ctx.actieSubfilter === 'brief_voorbereiden';
  }
  if (bron === 'te_printen') return bepaalPrintPostGroep(ctx.actieCategorie) === 'te_printen';
  if (bron === 'te_posten') return bepaalPrintPostGroep(ctx.actieCategorie) === 'te_posten';
  if (bron === 'opvolgen') {
    return ctx.werkbak === 'actie' && ctx.actieSubfilter === 'opvolgen';
  }
  if (bron === 'werkbak') return ctx.werkbak === 'actie';
  return true;
}

/** Primaire detailtab voor een rij in Acquisitieselectie. */
export function focusTabVoorWerkbakContext(ctx: WerkbakContext | undefined): FocusTab {
  if (ctx?.werkbak === 'actie' && ctx.actieSubfilter === 'onderzoeken') return 'kadaster';
  return 'brieven';
}
