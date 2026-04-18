import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Primary action(s), shown right-aligned on desktop, full width on mobile */
  actions?: ReactNode;
}

/**
 * Consistent boutique-style page header used across every module.
 * - Stacks on mobile (title above actions)
 * - Inline on desktop with right-aligned actions
 */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-1">
      <div className="min-w-0">
        <h1 className="text-2xl lg:text-[28px] font-semibold text-foreground tracking-tight leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-1.5 truncate">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
