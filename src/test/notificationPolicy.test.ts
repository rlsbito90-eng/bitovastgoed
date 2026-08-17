import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_POLICY,
  buildOccurrenceKey,
  isRegistrationOnlyDate,
  shouldPushByDefault,
} from '@/lib/notifications/policy';

describe('centrale notificatiepolicy', () => {
  it('push voor taak vandaag standaard aan', () => {
    expect(shouldPushByDefault('task_due_today')).toBe(true);
    expect(NOTIFICATION_POLICY.task_due_today.priority).toBe('hoog');
  });

  it('sterke match is standaard geen push', () => {
    expect(shouldPushByDefault('strong_match_found')).toBe(false);
  });

  it('datakwaliteit blijft in-app maar pusht standaard niet', () => {
    expect(NOTIFICATION_POLICY.data_quality_duplicate.inAppDefault).toBe(true);
    expect(NOTIFICATION_POLICY.data_quality_duplicate.pushDefault).toBe(false);
  });
});

describe('occurrence keys', () => {
  it('daggebonden trigger bevat datum voor idempotentie per dag', () => {
    expect(buildOccurrenceKey({
      eventType: 'task_due_today',
      sourceType: 'taak',
      sourceId: 'abc',
      dateKey: '2026-08-18',
    })).toBe('task_due_today:taak:abc:2026-08-18');
  });

  it('eenmalige trigger blijft gelijk over dagen heen', () => {
    expect(buildOccurrenceKey({
      eventType: 'task_overdue',
      sourceType: 'taak',
      sourceId: 'abc',
    })).toBe('task_overdue:taak:abc');
  });

  it('daggebonden trigger zonder datum faalt expliciet', () => {
    expect(() => buildOccurrenceKey({
      eventType: 'bid_expires_today',
      sourceType: 'bieding',
      sourceId: 'bod-1',
    })).toThrow(/dateKey is verplicht/);
  });
});

describe('registratiedatums', () => {
  it('brief verstuurd is registratie en niet automatisch een melding', () => {
    expect(isRegistrationOnlyDate('brief_verstuurd_op')).toBe(true);
  });

  it('taakdeadline is niet als registratiedatum geclassificeerd', () => {
    expect(isRegistrationOnlyDate('deadline')).toBe(false);
  });
});
