export interface TrajectoryStageLike {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  probability?: number | null;
  isWon?: boolean;
  isLost?: boolean;
  color?: string | null;
}

export interface ObjectStageLike {
  pipelineStageId?: string | null;
}

export function getTrajectoryStage<T extends TrajectoryStageLike>(
  object: ObjectStageLike | null | undefined,
  stages: T[],
): T | undefined {
  if (!object?.pipelineStageId) return undefined;
  return stages.find(stage => stage.id === object.pipelineStageId);
}

export function getPreferredBidderStage<T extends TrajectoryStageLike>(stages: T[]): T | undefined {
  return stages.find(stage => stage.slug === 'preferred_bidder');
}

export function getTrajectoryProbability(stage: TrajectoryStageLike | null | undefined): number {
  return stage?.probability != null ? stage.probability / 100 : 0;
}

export function isConcreteTransactionPosition(
  stage: TrajectoryStageLike | null | undefined,
  preferredBidderStage: TrajectoryStageLike | null | undefined,
): boolean {
  if (!stage || !preferredBidderStage) return false;
  return Boolean(
    stage.isWon || stage.isLost || stage.sortOrder >= preferredBidderStage.sortOrder,
  );
}
