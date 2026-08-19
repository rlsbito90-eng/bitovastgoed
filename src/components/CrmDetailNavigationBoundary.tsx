import type { MouseEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getCrmDetailModule,
  leesCrmDetailOrigin,
  leesCrmReturnContext,
  maakCrmReturnState,
} from '@/lib/crmReturnContext';

export { getCrmDetailModule } from '@/lib/crmReturnContext';

export type CrmDetailNavigationAction = 'normal' | 'history-back' | 'return' | 'origin' | 'cross-detail';

export function bepaalCrmDetailNavigationAction(args: {
  currentPathname: string;
  targetPathname: string;
  fallbackPath: string;
  hasReturnContext: boolean;
  hasOriginContext?: boolean;
}): CrmDetailNavigationAction {
  const {
    currentPathname,
    targetPathname,
    fallbackPath,
    hasReturnContext,
    hasOriginContext = false,
  } = args;

  if (targetPathname === fallbackPath) {
    if (hasReturnContext) return 'return';
    if (hasOriginContext) return 'origin';
    return 'history-back';
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
 * Terugvolgorde:
 * 1. expliciete cross-module return-context;
 * 2. stabiele route waar de detailketen echt is gestart;
 * 3. browser-history als legacy fallback;
 * 4. module-hoofdroute bij een directe deep-link.
 *
 * Daardoor blijft Terug correct nadat iemand met Vorige/Volgende door meerdere
 * details is gegaan, en ook bij programmatic list->detail navigatie. Tabs,
 * filters, sortering, selectie en scrollcontext blijven op de oorspronkelijke
 * lijst-entry/session-state staan.
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
  const currentModule = getCrmDetailModule(location.pathname);

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

    // De origin-tracker schrijft na de routewisseling. Lees daarom pas op het
    // daadwerkelijke terugmoment uit sessionStorage, niet tijdens de eerste
    // detail-render; zo kan een snelle list->detail overgang geen lege origin
    // vastzetten in deze componentinstantie.
    const originPath = currentModule ? leesCrmDetailOrigin(currentModule) : null;

    const action = bepaalCrmDetailNavigationAction({
      currentPathname: location.pathname,
      targetPathname: url.pathname,
      fallbackPath,
      hasReturnContext: !!returnContext,
      hasOriginContext: !!originPath,
    });

    if (action === 'return' && returnContext) {
      event.preventDefault();
      event.stopPropagation();
      navigate(returnContext.path, { replace: true });
      return;
    }

    if (action === 'origin' && originPath) {
      event.preventDefault();
      event.stopPropagation();
      navigate(originPath, { replace: true });
      return;
    }

    if (action === 'history-back') {
      event.preventDefault();
      event.stopPropagation();
      if (heeftBruikbareBrowserHistory()) navigate(-1);
      else navigate(fallbackPath, { replace: true });
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
