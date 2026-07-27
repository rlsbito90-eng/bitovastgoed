export type QuickscanOverviewItem = {
  id: string;
  object_id: string;
  calculation_name: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ScenarioActivity = {
  calculation_id: string;
  created_at?: string | null;
  updated_at?: string | null;
};

function timestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function latestQuickscanActivity(
  calculation: QuickscanOverviewItem,
  scenarioActivities: readonly ScenarioActivity[],
): number {
  let latest = Math.max(timestamp(calculation.created_at), timestamp(calculation.updated_at));

  for (const scenario of scenarioActivities) {
    if (scenario.calculation_id !== calculation.id) continue;
    latest = Math.max(latest, timestamp(scenario.created_at), timestamp(scenario.updated_at));
  }

  return latest;
}

export function sortQuickscansByLatestActivity<T extends QuickscanOverviewItem>(
  calculations: readonly T[],
  scenarioActivities: readonly ScenarioActivity[],
): Array<T & { latest_activity_at: number }> {
  return calculations
    .map((calculation) => ({
      ...calculation,
      latest_activity_at: latestQuickscanActivity(calculation, scenarioActivities),
    }))
    .sort((a, b) => {
      const activityDifference = b.latest_activity_at - a.latest_activity_at;
      if (activityDifference !== 0) return activityDifference;

      const objectDifference = a.object_id.localeCompare(b.object_id, 'nl');
      if (objectDifference !== 0) return objectDifference;

      return a.calculation_name.localeCompare(b.calculation_name, 'nl', {
        numeric: true,
        sensitivity: 'base',
      });
    });
}
