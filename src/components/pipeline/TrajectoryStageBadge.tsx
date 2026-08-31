import { GitBranch } from 'lucide-react';
import { useObjectTrajectoryStage } from '@/hooks/useObjectTrajectoryStage';

interface Props {
  objectId?: string;
  className?: string;
  showIcon?: boolean;
  fallback?: string;
}

export default function TrajectoryStageBadge({
  objectId,
  className = '',
  showIcon = false,
  fallback = 'Geen trajectfase',
}: Props) {
  const { stage } = useObjectTrajectoryStage(objectId);

  if (!stage) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground ${className}`}>
        {showIcon && <GitBranch className="h-3 w-3" />}
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}
      style={stage.color ? { borderColor: stage.color, color: stage.color } : undefined}
      title={`Object Pipeline · ${stage.name}`}
    >
      {showIcon && <GitBranch className="h-3 w-3" />}
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: stage.color ?? 'currentColor' }}
      />
      {stage.name}
    </span>
  );
}
