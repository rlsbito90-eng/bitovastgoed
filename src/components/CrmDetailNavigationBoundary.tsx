import type { MouseEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { leesCrmReturnContext, maakCrmReturnState } from '@/lib/crmReturnContext';

const DETAIL_MODULES = [
  'relaties',
  'objecten',
  'deals',
  'taken',
  'off-market',
  'acquisitie',
  'vastgoedkansen',
] as const;
type DetailModule = (typeof DETAIL_MODULES)[number];

export function getCrmDetailModule(pathname: string): DetailModule | null {
  const standaard = pathname.match(/^\/(relaties|objecten|deals|taken|off-market)\/[^/]+\/?$/);
  if (standaard) return standaard[1] as DetailModule;
  if (/^\/acquisitie\/(?:targets|campagnes)\/[^/]+\/?$/.test(pathname)) return 'acquisitie';
  if (/^\/vastgoedkansen\/[^/]+\/?$/.test(pathname)) return 'vastgoedkansen';
  return null;
}

export type CrmDetailNavigationAction = 'normal' | 'history-back' | 'return' | 'cross-detail';

export function bepaalCrmDetailNavigationAction(args: {
  currentPathname: string;
  targetPathname: string;
  fallbackPath: string;
  hasReturnContext: boolean;
}): CrmDetailNavigationAction {
  const { currentPathname, targetPathname, fallbackPath, hasReturnContext } = args;

  if (targetPathname === fallbackPath) {
    return hasReturnContext ? 'return' : 'history-back';
  }

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

function heeftBruikbareBrowserHistory(): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx;
  return typeof idx === 'number' && idx > 0;
}

/**
 * Centrale grens voor CRM-detailroutes.
 *
 * - Een terug-/modulelink naar de eigen hoofdlijst gaat bij normale list->detail
 *   navigatie via de echte vorige history-entry. Daardoor blijven tab, werkbak,
 *   filters, sortering, selectie en scrollcontext behouden waar de lijst die
 *   context zelf bewaart.
 * - Een expliciete cross-module return-context blijft leidend.
 * - Een cross-module detail-link krijgt automatisch de huidige detailroute als
 *   return-context mee.
 * - Same-module navigatie (o.a. Vorige/Volgende) blijft ongemoeid.
 * - Een directe deep-link zonder bruikbare history valt veilig terug op de
 *   opgegeven module-hoofdroute.
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

    if (action === 'history-back') {
      event.preventDefault();
      event.stopPropagation();
      if (heeftBruikbareBrowserHistory()) navigate(-1);
      else navigate(fallbackPath);
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
