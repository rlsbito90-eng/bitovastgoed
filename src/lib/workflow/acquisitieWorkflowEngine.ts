export type WorkflowAutomationMode = 'automatic' | 'proposal' | 'confirmation';

export type AcquisitieWorkflowEventType =
  | 'pand_toegevoegd'
  | 'kadaster_opgehaald'
  | 'eigenaar_bevestigd'
  | 'brief_concept_aangemaakt'
  | 'brief_verzonden'
  | 'reactie_ontvangen'
  | 'retour_post'
  | 'follow_up_gepland'
  | 'follow_up_afgerond'
  | 'gearchiveerd'
  | 'heropend'
  | 'deal_gesloten';

export type AcquisitieReactieUitkomst =
  | 'interesse'
  | 'meer_informatie'
  | 'later_bellen'
  | 'geen_interesse'
  | 'verkeerde_eigenaar'
  | 'overig';

export interface AcquisitieWorkflowEvent {
  id: string;
  type: AcquisitieWorkflowEventType;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowNextAction {
  code: string;
  label: string;
  dueAt: string | null;
  mode: WorkflowAutomationMode;
  sourceEventId: string;
  supersedes?: string[];
}

export interface WorkflowState {
  lifecycle: 'active' | 'archived' | 'deal_closed';
  eigenaar: 'onbekend' | 'voorstel' | 'bevestigd' | 'controle_nodig';
  outreach: 'niet_gestart' | 'concept' | 'verzonden' | 'reactie' | 'retour';
  nextAction: WorkflowNextAction | null;
  appliedRuleIds: string[];
}

export interface WorkflowRuleContext {
  events: AcquisitieWorkflowEvent[];
  latest: AcquisitieWorkflowEvent;
  state: WorkflowState;
}

export interface WorkflowRule {
  id: string;
  trigger: AcquisitieWorkflowEventType;
  priority: number;
  mode: WorkflowAutomationMode;
  applies: (context: WorkflowRuleContext) => boolean;
  apply: (context: WorkflowRuleContext) => WorkflowState;
}

const datum = (waarde: unknown): string | null =>
  typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde) ? waarde : null;

const reactie = (event: AcquisitieWorkflowEvent): AcquisitieReactieUitkomst => {
  const raw = event.metadata?.uitkomst;
  return raw === 'interesse' || raw === 'meer_informatie' || raw === 'later_bellen'
    || raw === 'geen_interesse' || raw === 'verkeerde_eigenaar' || raw === 'overig'
    ? raw
    : 'overig';
};

const next = (
  event: AcquisitieWorkflowEvent,
  code: string,
  label: string,
  mode: WorkflowAutomationMode,
  dueAt: string | null = null,
  supersedes: string[] = [],
): WorkflowNextAction => ({ code, label, dueAt, mode, sourceEventId: event.id, supersedes });

const withRule = (state: WorkflowState, ruleId: string): WorkflowState => ({
  ...state,
  appliedRuleIds: [...state.appliedRuleIds, ruleId],
});

const rules: WorkflowRule[] = [
  {
    id: 'lifecycle.deal-gesloten', trigger: 'deal_gesloten', priority: 1000, mode: 'automatic',
    applies: () => true,
    apply: ({ state }) => ({ ...state, lifecycle: 'deal_closed', nextAction: null }),
  },
  {
    id: 'lifecycle.gearchiveerd', trigger: 'gearchiveerd', priority: 950, mode: 'automatic',
    applies: () => true,
    apply: ({ state }) => ({ ...state, lifecycle: 'archived', nextAction: null }),
  },
  {
    id: 'lifecycle.heropend', trigger: 'heropend', priority: 940, mode: 'automatic',
    applies: () => true,
    apply: ({ state, latest }) => ({
      ...state,
      lifecycle: 'active',
      nextAction: next(latest, 'herbeoordelen', 'Beoordeel heropend dossier', 'confirmation'),
    }),
  },
  {
    id: 'intake.pand-toegevoegd', trigger: 'pand_toegevoegd', priority: 100, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      nextAction: next(latest, 'beoordelen', 'Beoordeel vastgoedkans', 'automatic'),
    }),
  },
  {
    id: 'owner.kadaster-uniek', trigger: 'kadaster_opgehaald', priority: 300, mode: 'proposal',
    applies: ({ latest, state }) => state.lifecycle === 'active' && latest.metadata?.eigenaarResultaat === 'uniek',
    apply: ({ state, latest }) => ({
      ...state,
      eigenaar: 'voorstel',
      nextAction: next(latest, 'eigenaar_bevestigen', 'Bevestig voorgestelde eigenaar', 'proposal'),
    }),
  },
  {
    id: 'owner.kadaster-controle', trigger: 'kadaster_opgehaald', priority: 310, mode: 'confirmation',
    applies: ({ latest, state }) => state.lifecycle === 'active' && latest.metadata?.eigenaarResultaat !== 'uniek',
    apply: ({ state, latest }) => ({
      ...state,
      eigenaar: 'controle_nodig',
      nextAction: next(latest, 'rechthebbenden_controleren', 'Controleer rechthebbenden', 'confirmation'),
    }),
  },
  {
    id: 'owner.bevestigd', trigger: 'eigenaar_bevestigd', priority: 400, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      eigenaar: 'bevestigd',
      nextAction: next(latest, 'brief_voorbereiden', 'Brief voorbereiden', 'confirmation'),
    }),
  },
  {
    id: 'outreach.concept', trigger: 'brief_concept_aangemaakt', priority: 450, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      outreach: 'concept',
      nextAction: next(latest, 'brief_controleren', 'Controleer en verstuur de brief', 'confirmation'),
    }),
  },
  {
    id: 'outreach.verzonden', trigger: 'brief_verzonden', priority: 500, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      outreach: 'verzonden',
      nextAction: next(
        latest,
        'opvolgen',
        'Volg verzending op',
        'proposal',
        datum(latest.metadata?.opvolgdatum),
        state.nextAction ? [state.nextAction.code] : [],
      ),
    }),
  },
  {
    id: 'outreach.retour', trigger: 'retour_post', priority: 700, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      outreach: 'retour',
      nextAction: next(latest, 'eigenaar_heronderzoek', 'Controleer eigenaar en adres opnieuw', 'confirmation', null,
        state.nextAction ? [state.nextAction.code] : []),
    }),
  },
  {
    id: 'response.interesse', trigger: 'reactie_ontvangen', priority: 820, mode: 'proposal',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'interesse',
    apply: ({ state, latest }) => ({ ...state, outreach: 'reactie', nextAction: next(latest, 'vervolg_interesse', 'Plan vervolgactie met eigenaar', 'proposal', datum(latest.metadata?.vervolgdatum), state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'response.meer-informatie', trigger: 'reactie_ontvangen', priority: 820, mode: 'confirmation',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'meer_informatie',
    apply: ({ state, latest }) => ({ ...state, outreach: 'reactie', nextAction: next(latest, 'informatie_sturen', 'Stuur gevraagde informatie', 'confirmation', null, state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'response.later-bellen', trigger: 'reactie_ontvangen', priority: 820, mode: 'proposal',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'later_bellen',
    apply: ({ state, latest }) => ({ ...state, outreach: 'reactie', nextAction: next(latest, 'later_bellen', 'Bel eigenaar terug', 'proposal', datum(latest.metadata?.vervolgdatum), state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'response.geen-interesse', trigger: 'reactie_ontvangen', priority: 820, mode: 'confirmation',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'geen_interesse',
    apply: ({ state, latest }) => ({ ...state, outreach: 'reactie', nextAction: next(latest, 'afsluiten_beoordelen', 'Beoordeel afsluiten of archiveren', 'confirmation', null, state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'response.verkeerde-eigenaar', trigger: 'reactie_ontvangen', priority: 830, mode: 'confirmation',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'verkeerde_eigenaar',
    apply: ({ state, latest }) => ({ ...state, eigenaar: 'controle_nodig', outreach: 'reactie', nextAction: next(latest, 'eigenaar_heronderzoek', 'Heropen eigenaaronderzoek', 'confirmation', null, state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'response.overig', trigger: 'reactie_ontvangen', priority: 810, mode: 'confirmation',
    applies: ({ latest, state }) => state.lifecycle === 'active' && reactie(latest) === 'overig',
    apply: ({ state, latest }) => ({ ...state, outreach: 'reactie', nextAction: next(latest, 'reactie_beoordelen', 'Beoordeel reactie en kies vervolgactie', 'confirmation', null, state.nextAction ? [state.nextAction.code] : []) }),
  },
  {
    id: 'followup.gepland', trigger: 'follow_up_gepland', priority: 600, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state, latest }) => ({
      ...state,
      nextAction: next(latest, 'opvolgen', String(latest.metadata?.label ?? 'Voer geplande opvolging uit'), 'automatic', datum(latest.metadata?.opvolgdatum)),
    }),
  },
  {
    id: 'followup.afgerond', trigger: 'follow_up_afgerond', priority: 610, mode: 'automatic',
    applies: ({ state }) => state.lifecycle === 'active',
    apply: ({ state }) => ({ ...state, nextAction: null }),
  },
];

export const ACQUISITIE_WORKFLOW_RULES: readonly WorkflowRule[] = rules;

const INITIELE_STATE: WorkflowState = {
  lifecycle: 'active',
  eigenaar: 'onbekend',
  outreach: 'niet_gestart',
  nextAction: null,
  appliedRuleIds: [],
};

export function evalueerAcquisitieWorkflow(events: readonly AcquisitieWorkflowEvent[]): WorkflowState {
  const gesorteerd = [...events].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  let state = { ...INITIELE_STATE, appliedRuleIds: [] };

  for (const event of gesorteerd) {
    const kandidaten = rules
      .filter((rule) => rule.trigger === event.type)
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
    for (const rule of kandidaten) {
      const context = { events: gesorteerd, latest: event, state };
      if (!rule.applies(context)) continue;
      state = withRule(rule.apply(context), rule.id);
      break;
    }
  }
  return state;
}
