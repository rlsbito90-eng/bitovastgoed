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
    <div
      data-bito-page-header
      className="flex flex-col gap-3 pb-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4"
    >
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground sm:truncate sm:leading-normal">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div
          data-bito-page-actions
          className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0"
        >
          {actions}
        </div>
      )}
    </div>
  );
}
