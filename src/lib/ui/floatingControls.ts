/**
 * One route policy for the global floating quick-task control and the
 * app-shell clearance it requires. Dashboard / Taken already have task entry
 * points; rendering another dock there would cause duplicates.
 */
export function hasGlobalQuickTaskDock(pathname: string): boolean {
  return pathname !== '/' && pathname !== '/taken' && !pathname.startsWith('/taken/');
}

export function hasInlineQuickTaskBar(pathname: string): boolean {
  return pathname === '/taken';
}

/**
 * Do not put the back-to-top arrow over an expanded quick task entry or a
 * dialog. This also covers modals opened from the task bar itself.
 */
export function floatingActionOverlayOpen(): boolean {
  return Boolean(document.querySelector(
    '[data-testid="quick-task-capture-dock"][data-expanded="true"], ' +
    '[role="dialog"][data-state="open"], ' +
    '[role="alertdialog"][data-state="open"]',
  ));
}
