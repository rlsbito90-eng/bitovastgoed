# Scenario-taxonomie

Deze module is in Fase 1 bewust **niet aangesloten** op runtime, database of UI.

Gebruik later uitsluitend de exports uit `index.ts`. De centrale metadata en legacy-mapping voorkomen verspreide strategie-switches.

- `types.ts`: canonieke dimensies, labels en contracten;
- `legacyMapping.ts`: exhaustieve interpretatie van alle bestaande `vr_strategy_type`-waarden;
- `resolution.ts`: veilige guards en runtimefallbacks;
- `validation.ts`: draft/strict-validatie en componenttiming.

Bestaande rekenfuncties mogen deze metadata pas ontvangen nadat een afzonderlijke migratie- en compatibiliteitsfase is goedgekeurd.