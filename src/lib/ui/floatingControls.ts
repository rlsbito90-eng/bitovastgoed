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
