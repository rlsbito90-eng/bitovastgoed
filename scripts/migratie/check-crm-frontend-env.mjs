#!/usr/bin/env node

import { CRM_DOELPROJECT, valideerCrmDoel } from './check-crm-target.mjs';

export function haalProjectIdUitSupabaseUrl(rawUrl) {
  const waarde = String(rawUrl ?? '').trim();
  if (!waarde) return null;

  try {
    const url = new URL(waarde);
    if (url.protocol !== 'https:') return null;
    const match = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function valideerCrmFrontendEnv({ projectId, supabaseUrl, publishableKey }) {
  const doel = valideerCrmDoel(projectId);
  if (!doel.ok) return doel;

  const urlProjectId = haalProjectIdUitSupabaseUrl(supabaseUrl);
  if (!urlProjectId) {
    return {
      ok: false,
      code: 'frontend_url_ongeldig',
      reden: 'VITE_SUPABASE_URL ontbreekt of is geen geldige https://<project>.supabase.co URL.',
    };
  }

  if (urlProjectId !== CRM_DOELPROJECT) {
    return {
      ok: false,
      code: 'frontend_url_verkeerd_doel',
      reden: `VITE_SUPABASE_URL wijst naar ${urlProjectId}; verwacht ${CRM_DOELPROJECT}.`,
    };
  }

  const sleutel = String(publishableKey ?? '').trim();
  if (!sleutel) {
    return {
      ok: false,
      code: 'frontend_key_ontbreekt',
      reden: 'VITE_SUPABASE_PUBLISHABLE_KEY ontbreekt. Cutover wordt geblokkeerd.',
    };
  }

  return {
    ok: true,
    code: 'frontend_env_bevestigd',
    reden: `Frontend cutover-config wijst aantoonbaar naar CRM-doel ${CRM_DOELPROJECT}.`,
  };
}

function runCli() {
  const resultaat = valideerCrmFrontendEnv({
    projectId: process.env.CRM_TARGET_PROJECT_ID,
    supabaseUrl: process.env.VITE_SUPABASE_URL,
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });

  const prefix = resultaat.ok ? '[CRM frontend preflight OK]' : '[CRM frontend preflight BLOCKED]';
  console.log(`${prefix} ${resultaat.reden}`);
  if (!resultaat.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
