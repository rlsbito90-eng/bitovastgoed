import type { MouseEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { leesCrmReturnContext, maakCrmReturnState } from '@/lib/crmReturnContext';

const DETAIL_MODULES = ['relaties', 'objecten', 'deals', 'taken', 'off-market'] as const;
type DetailModule = (typeof DETAIL_MODULES)[number];

export function getCrmDetailModule(pathname: string): DetailModule | null {
  const match = pathname.match(/^\/(relaties|objecten|deals|taken|off-market)\/[^/]+\/?$/);
  return match ? match[1] as DetailModule : null;
}

export function isCrmTerugKnopTekst(text: string | null | undefined): boolean {
  const normalized = (text ?? '').trim().toLocaleLowerCase('nl-NL');
  return normalized === 'terug' || normalized.startsWith('terug naar ');
}

export type CrmDetailNavigationAction = 'normal' | 'return' | 'cross-detail';

export function bepaalCrmDetailNavigationAction(args: {
  currentPathname: string;
  targetPathname: string;
  fallbackPath: string;
  hasReturnContext: boolean;
}): CrmDetailNavigationAction {
  const { currentPathname, targetPathname, fallbackPath, hasReturnContext } = args;

  if (hasReturnContext && targetPathname === fallbackPath) return 'return';

  const currentModule = getCrmDetailModule(currentPathname);
  const targetModule = getCrmDetailModule(targetPathname);
  if (currentModule && targetModule && currentModule !== targetModule) return 'cross-detail';

  return 'normal';
}

interface Props {
  children: ReactNode;
  fallbackPath: string;
  fallbackLabel: string;
  source: string;
}

/**
 * Centrale grens voor CRM-detailroutes.
 *
 * - Een vaste terug-link naar de eigen hoofdlijst respecteert een expliciete
 *   return-context wanneer het detail vanuit een andere CRM-module is geopend.
 * - Ook programmatische terugknoppen (bijv. Button onClick={() => navigate(...)})
 *   worden afgevangen wanneer hun zichtbare tekst "Terug" of "Terug naar …" is.
 * - Een cross-module detail-link krijgt automatisch de huidige detailroute als
 *   return-context mee.
 * - Same-module navigatie (o.a. Vorige/Volgende) blijft ongemoeid.
 *
 * Hierdoor hoeven bestaande detailpagina's niet elk hun eigen browser-history
 * logica te implementeren.
 */
export default function CrmDetailNavigationBoundary({
  children,
  fallbackPath,
  fallbackLabel,
  source,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const returnContext = leesCrmReturnContext(location.state);

  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;

    const element = event.target as Element | null;

    // React Router kan ook via een gewone Button programmatisch naar de vaste
    // hoofdlijst navigeren. Die onClick is niet zichtbaar als <a href> en werd
    // daardoor eerder niet onderschept. In capture-fase sturen we zo'n expliciete
    // terugknop rechtstreeks naar de opgeslagen broncontext.
    if (returnContext) {
      const button = element?.closest('button') as HTMLButtonElement | null;
      if (button && isCrmTerugKnopTekst(button.textContent)) {
        event.preventDefault();
        event.stopPropagation();
        navigate(returnContext.path);
        return;
      }
    }

    const anchor = element?.closest('a[href]') as HTMLAnchorElement | null;
    if (!anchor || anchor.hasAttribute('download')) return;
    if (anchor.target && anchor.target !== '_self') return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    const action = bepaalCrmDetailNavigationAction({
      currentPathname: location.pathname,
      targetPathname: url.pathname,
      fallbackPath,
      hasReturnContext: !!returnContext,
    });

    if (action === 'return' && returnContext) {
      event.preventDefault();
      event.stopPropagation();
      navigate(returnContext.path);
      return;
    }

    if (action === 'cross-detail') {
      event.preventDefault();
      event.stopPropagation();
      const targetPath = `${url.pathname}${url.search}${url.hash}`;
      navigate(targetPath, {
        state: maakCrmReturnState(currentPath, fallbackLabel, source),
      });
    }
  };

  return <div onClickCapture={handleClickCapture}>{children}</div>;
}
