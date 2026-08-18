export type NotificationPriority = 'laag' | 'normaal' | 'hoog' | 'kritiek';

export type NotificationEventType =
  | 'task_due_today'
  | 'task_overdue'
  | 'high_priority_task_created'
  | 'bid_expires_today'
  | 'bid_expires_tomorrow'
  | 'strong_match_found'
  | 'data_quality_duplicate';

export interface NotificationPolicyRule {
  eventType: NotificationEventType;
  actionRequired: boolean;
  calendarVisible: boolean;
  inAppDefault: boolean;
  pushDefault: boolean;
  priority: NotificationPriority;
  repeatPolicy: 'once' | 'daily_occurrence';
  autoResolveWhenSourceClosed: boolean;
}

export const NOTIFICATION_POLICY: Record<NotificationEventType, NotificationPolicyRule> = {
  task_due_today: {
    eventType: 'task_due_today',
    actionRequired: true,
    calendarVisible: true,
    inAppDefault: true,
    pushDefault: true,
    priority: 'hoog',
    repeatPolicy: 'daily_occurrence',
    autoResolveWhenSourceClosed: true,
  },
  task_overdue: {
    eventType: 'task_overdue',
    actionRequired: true,
    calendarVisible: true,
    inAppDefault: true,
    pushDefault: true,
    priority: 'kritiek',
    repeatPolicy: 'once',
    autoResolveWhenSourceClosed: true,
  },
  high_priority_task_created: {
    eventType: 'high_priority_task_created',
    actionRequired: true,
    calendarVisible: false,
    inAppDefault: true,
    pushDefault: true,
    priority: 'hoog',
    repeatPolicy: 'once',
    autoResolveWhenSourceClosed: true,
  },
  bid_expires_today: {
    eventType: 'bid_expires_today',
    actionRequired: true,
    calendarVisible: false,
    inAppDefault: true,
    pushDefault: true,
    priority: 'hoog',
    repeatPolicy: 'daily_occurrence',
    autoResolveWhenSourceClosed: true,
  },
  bid_expires_tomorrow: {
    eventType: 'bid_expires_tomorrow',
    actionRequired: true,
    calendarVisible: false,
    inAppDefault: true,
    pushDefault: true,
    priority: 'hoog',
    repeatPolicy: 'daily_occurrence',
    autoResolveWhenSourceClosed: true,
  },
  strong_match_found: {
    eventType: 'strong_match_found',
    actionRequired: false,
    calendarVisible: false,
    inAppDefault: true,
    pushDefault: false,
    priority: 'normaal',
    repeatPolicy: 'once',
    autoResolveWhenSourceClosed: false,
  },
  data_quality_duplicate: {
    eventType: 'data_quality_duplicate',
    actionRequired: true,
    calendarVisible: false,
    inAppDefault: true,
    pushDefault: false,
    priority: 'kritiek',
    repeatPolicy: 'once',
    autoResolveWhenSourceClosed: true,
  },
};

export interface OccurrenceInput {
  eventType: NotificationEventType;
  sourceType: string;
  sourceId: string;
  dateKey?: string;
}

/**
 * Deterministische sleutel voor één logische gebruikersmelding.
 * daily_occurrence-regels nemen een datum op; once-regels bewust niet.
 */
export function buildOccurrenceKey(input: OccurrenceInput): string {
  const rule = NOTIFICATION_POLICY[input.eventType];
  const base = `${input.eventType}:${input.sourceType}:${input.sourceId}`;
  if (rule.repeatPolicy === 'daily_occurrence') {
    if (!input.dateKey) throw new Error(`dateKey is verplicht voor ${input.eventType}`);
    return `${base}:${input.dateKey}`;
  }
  return base;
}

export function shouldPushByDefault(eventType: NotificationEventType): boolean {
  return NOTIFICATION_POLICY[eventType].pushDefault;
}

export function isRegistrationOnlyDate(kind: string): boolean {
  return new Set([
    'brief_verstuurd_op',
    'created_at',
    'updated_at',
    'archived_at',
    'contactmoment_datum',
  ]).has(kind);
}
