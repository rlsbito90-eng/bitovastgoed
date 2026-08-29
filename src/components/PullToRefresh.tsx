import type { ReactNode } from 'react';

/**
 * Legacy compatibility wrapper.
 *
 * De eerdere mobiele pull-to-refresh gesture is bewust uitgeschakeld: hij
 * concurreerde met horizontale swipe-rails en toonde daardoor te vaak de
 * melding "Trek omlaag om te vernieuwen". Handmatig vernieuwen blijft
 * beschikbaar via RefreshButton; automatische focus-refresh blijft via
 * useAutoRefreshOnFocus lopen.
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
