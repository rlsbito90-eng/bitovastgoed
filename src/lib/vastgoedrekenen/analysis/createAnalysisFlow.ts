// Herbruikbare createflow: analyse (Analysis-laag) + direct één eerste scenario.
// Bij een fout op het scenario wordt de zojuist aangemaakte analyse verwijderd,
// zodat er nooit stil een half record achterblijft.

export type FlowError = { message?: string | null } | null | undefined;

export type CreateAnalysisDeps<TAnalysis extends { id: string }, TScenario> = {
  insertAnalysis: () => Promise<{ data: TAnalysis | null; error: FlowError }>;
  insertFirstScenario: (analysis: TAnalysis) => Promise<{ data: TScenario | null; error: FlowError }>;
  deleteAnalysis: (analysisId: string) => Promise<{ error: FlowError }>;
};

export type CreateAnalysisResult<TAnalysis, TScenario> =
  | { ok: true; analysis: TAnalysis; scenario: TScenario }
  | {
      ok: false;
      stage: 'analysis' | 'scenario';
      message: string;
      /** Alleen relevant bij stage 'scenario'. */
      rolledBack: boolean;
    };

export async function createAnalysisWithFirstScenario<TAnalysis extends { id: string }, TScenario>(
  deps: CreateAnalysisDeps<TAnalysis, TScenario>,
): Promise<CreateAnalysisResult<TAnalysis, TScenario>> {
  const analysisRes = await deps.insertAnalysis();
  if (analysisRes.error || !analysisRes.data) {
    return {
      ok: false,
      stage: 'analysis',
      message: analysisRes.error?.message?.trim() || 'Analyse aanmaken mislukt.',
      rolledBack: false,
    };
  }

  const analysis = analysisRes.data;
  const scenarioRes = await deps.insertFirstScenario(analysis);
  if (scenarioRes.error || !scenarioRes.data) {
    const rollback = await deps.deleteAnalysis(analysis.id);
    const rolledBack = !rollback.error;
    const reason = scenarioRes.error?.message?.trim() || 'Eerste scenario kon niet worden aangemaakt.';
    return {
      ok: false,
      stage: 'scenario',
      rolledBack,
      message: rolledBack
        ? `Analyse aanmaken afgebroken: ${reason} De analyse is teruggedraaid.`
        : `Analyse aanmaken afgebroken: ${reason} De analyse kon niet automatisch worden teruggedraaid.`,
    };
  }

  return { ok: true, analysis, scenario: scenarioRes.data };
}
