import type { ComponentProps } from 'react';
import ScenarioTaxonomyPanelCore from './ScenarioTaxonomyPanelCore';
import ScenarioManagementPanel from './ScenarioManagementPanel';

type Props = ComponentProps<typeof ScenarioTaxonomyPanelCore>;

export default function ScenarioTaxonomyPanel(props: Props) {
  return (
    <div className="space-y-4">
      <ScenarioManagementPanel scenario={props.scenario} />
      <ScenarioTaxonomyPanelCore {...props} />
    </div>
  );
}
