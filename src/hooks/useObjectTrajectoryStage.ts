import { useDataStore } from '@/hooks/useDataStore';

/**
 * Enige zichtbare commerciële trajectfase.
 *
 * Deal.fase bestaat nog uitsluitend als technische legacy/closing-projectie.
 * UI, kansweging en operationele voortgang lezen de Object Pipeline.
 */
export function useObjectTrajectoryStage(objectId?: string) {
  const store = useDataStore();
  const object = objectId ? store.getObjectById(objectId) : undefined;
  const pipeline = store.getDefaultObjectPipeline();
  const stages = pipeline ? store.getStagesVoorPipeline(pipeline.id) : [];
  const stage = object?.pipelineStageId
    ? stages.find(candidate => candidate.id === object.pipelineStageId)
    : undefined;
  const preferredBidderStage = stages.find(candidate => candidate.slug === 'preferred_bidder');

  const probability = stage?.probability != null ? stage.probability / 100 : 0;
  const isTransactionPosition = Boolean(
    stage && preferredBidderStage && (
      stage.sortOrder >= preferredBidderStage.sortOrder || stage.isWon || stage.isLost
    ),
  );

  return {
    object,
    pipeline,
    stages,
    stage,
    preferredBidderStage,
    probability,
    isTransactionPosition,
  };
}
