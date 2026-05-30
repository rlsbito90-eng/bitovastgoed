// Resolver: vertaalt scenario-methode + waarden naar effectieve aankoopfee en notariskosten
// voor zowel compute als audit. Geen DB-writes.

import type { Scenario } from '../types';
import {
  computeBitoBuyerFee,
  resolveBuyerFeeBasis,
  BUYER_FEE_BASIS_LABELS,
  type BuyerFeeStaffelResult,
  type BuyerFeeBasisSource,
} from './buyerFeeStaffel';
import {
  computeNotaryFromProfile,
  type NotaryProfileKey,
  type NotaryProfileResult,
} from './notaryProfile';

export type BuyerFeeMethod = 'staffel' | 'percentage' | 'amount' | 'manual' | 'zero';
export type NotaryCostsMethod = 'profile' | 'percentage' | 'amount' | 'manual' | 'zero';

function getMethod<T extends string>(s: Scenario, field: string, fallback: T): T {
  const v = (s as unknown as Record<string, unknown>)[field];
  return (typeof v === 'string' && v.length > 0 ? v : fallback) as T;
}

function manualZeroSet(s: Scenario): Set<string> {
  const v = (s as unknown as Record<string, unknown>).manual_zero_fields;
  if (Array.isArray(v)) return new Set(v.filter((x): x is string => typeof x === 'string'));
  return new Set();
}

export type EffectiveBuyerFee = {
  method: BuyerFeeMethod;
  /** Fee ex. btw (afgerond op euro's). */
  amountExVat: number;
  vatAmount: number;
  amountInclVat: number;
  vatPct: number;
  pctExVat: number;
  basis: number;
  basisSource: BuyerFeeBasisSource;
  basisLabel: string;
  /** Bronchip-tekst voor UI/audit. */
  sourceLabel: 'Bito-staffel' | 'Handmatig' | 'Bewust €0';
  staffel: BuyerFeeStaffelResult;
  warnings: string[];
};

export function resolveEffectiveBuyerFee(scenario: Scenario): EffectiveBuyerFee {
  const method = getMethod<BuyerFeeMethod>(scenario, 'buyer_fee_method', 'manual');
  const vatPct = Number(scenario.buyer_fee_vat_percentage ?? 21);
  const staffel = computeBitoBuyerFee(scenario);
  const basisInfo = resolveBuyerFeeBasis(scenario);
  const basisLabel = BUYER_FEE_BASIS_LABELS[basisInfo.source];
  const zeros = manualZeroSet(scenario);
  const warnings: string[] = [];

  if (method === 'staffel') {
    if (staffel.tier == null) warnings.push('Basis voor staffel ontbreekt — vul beoogde aankoopprijs of vraagprijs in.');
    return {
      method,
      amountExVat: staffel.amountExVat,
      vatAmount: staffel.vatAmount,
      amountInclVat: staffel.amountInclVat,
      vatPct: staffel.vatPct,
      pctExVat: staffel.pctExVat,
      basis: staffel.basis,
      basisSource: staffel.basisSource,
      basisLabel,
      sourceLabel: 'Bito-staffel',
      staffel,
      warnings,
    };
  }

  if (method === 'zero') {
    return {
      method,
      amountExVat: 0,
      vatAmount: 0,
      amountInclVat: 0,
      vatPct,
      pctExVat: 0,
      basis: basisInfo.basis,
      basisSource: basisInfo.source,
      basisLabel,
      sourceLabel: 'Bewust €0',
      staffel,
      warnings,
    };
  }

  // 'manual' | 'percentage' | 'amount' → bestaand gedrag
  const purchase = Number(scenario.purchase_price ?? 0);
  const amountExVat = scenario.buyer_fee_amount != null
    ? Number(scenario.buyer_fee_amount)
    : Math.round((purchase * Number(scenario.buyer_fee_percentage ?? 0)) / 100);
  const vatAmount = Math.round((amountExVat * vatPct) / 100);
  const pctExVat = purchase > 0 ? Math.round((amountExVat / purchase) * 10000) / 100 : 0;

  if (amountExVat === 0 && !zeros.has('buyer_fee_percentage') && !zeros.has('buyer_fee_amount')) {
    warnings.push('Aankoopfee is € 0 zonder bevestiging "Bewust € 0".');
  }
  if (staffel.tier && amountExVat > 0) {
    const diffPct = staffel.amountExVat > 0 ? Math.abs(amountExVat - staffel.amountExVat) / staffel.amountExVat : 0;
    if (diffPct > 0.05) {
      warnings.push(`Handmatige fee wijkt > 5% af van Bito-staffel (${staffel.tier.label}).`);
    }
  }

  return {
    method,
    amountExVat,
    vatAmount,
    amountInclVat: amountExVat + vatAmount,
    vatPct,
    pctExVat,
    basis: basisInfo.basis,
    basisSource: basisInfo.source,
    basisLabel,
    sourceLabel: 'Handmatig',
    staffel,
    warnings,
  };
}

export type EffectiveNotary = {
  method: NotaryCostsMethod;
  amount: number;
  basis: number;
  basisSource: BuyerFeeBasisSource;
  basisLabel: string;
  profileKey: NotaryProfileKey | null;
  profile: NotaryProfileResult | null;
  sourceLabel: 'Default quickscan' | 'Handmatig' | 'Bewust €0';
  warnings: string[];
};

export function resolveEffectiveNotary(scenario: Scenario): EffectiveNotary {
  const method = getMethod<NotaryCostsMethod>(scenario, 'notary_costs_method', 'manual');
  const profileKey = (scenario as unknown as Record<string, unknown>).notary_costs_profile as NotaryProfileKey | null;
  const basisInfo = resolveBuyerFeeBasis(scenario);
  const basisLabel = BUYER_FEE_BASIS_LABELS[basisInfo.source];
  const zeros = manualZeroSet(scenario);
  const warnings: string[] = [];

  if (method === 'profile') {
    const profile = computeNotaryFromProfile(basisInfo.basis, profileKey);
    if (profile.requiresManual) {
      warnings.push('Profiel vereist handmatige notariskostenopgave.');
    }
    if (basisInfo.basis <= 0) warnings.push('Basis voor profiel ontbreekt — vul beoogde aankoopprijs of vraagprijs in.');
    return {
      method,
      amount: profile.amount,
      basis: profile.basis,
      basisSource: basisInfo.source,
      basisLabel,
      profileKey: profile.profile.key,
      profile,
      sourceLabel: 'Default quickscan',
      warnings,
    };
  }

  if (method === 'zero') {
    return {
      method,
      amount: 0,
      basis: basisInfo.basis,
      basisSource: basisInfo.source,
      basisLabel,
      profileKey,
      profile: null,
      sourceLabel: 'Bewust €0',
      warnings,
    };
  }

  // 'manual' | 'percentage' | 'amount' → bestaand veld leidend
  const amount = Number((scenario as unknown as Record<string, unknown>).notary_costs ?? 0);
  if (amount === 0 && !zeros.has('notary_costs')) {
    warnings.push('Notariskosten zijn € 0 zonder bevestiging "Bewust € 0".');
  }
  return {
    method,
    amount,
    basis: basisInfo.basis,
    basisSource: basisInfo.source,
    basisLabel,
    profileKey,
    profile: null,
    sourceLabel: 'Handmatig',
    warnings,
  };
}
