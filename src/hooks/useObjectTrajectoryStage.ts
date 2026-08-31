import { useDataStore } from '@/hooks/useDataStore';
import {
  getPreferredBidderStage,
  getTrajectoryProbability,
  getTrajectoryStage,
  isConcreteTransactionPosition,
} from '@/lib/lifecycle/trajectory';

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
  const stage = getTrajectoryStage(object, stages);
  const preferredBidderStage = getPreferredBidderStage(stages);
  const probability = getTrajectoryProbability(stage);
  const isTransactionPosition = isConcreteTransactionPosition(stage, preferredBidderStage);

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
