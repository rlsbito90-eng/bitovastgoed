import type { Bieding } from './types';

export const biedingFromDb = (r: any): Bieding => ({
  id: r.id,
  objectId: r.object_id,
  relatieId: r.relatie_id,
  dealId: r.deal_id ?? null,
  objectPipelineId: r.object_pipeline_id ?? null,
  counterOfferToId: r.counter_offer_to_id ?? null,
  bedrag: r.bedrag ?? null,
  currency: r.currency ?? 'EUR',
  bieddatum: r.bieddatum,
  geldigTot: r.geldig_tot ?? null,
  status: r.status,
  offerType: r.offer_type,
  financieringsvoorbehoud: r.financieringsvoorbehoud,
  ddVoorbehoud: r.dd_voorbehoud,
  gewensteLevering: r.gewenste_levering ?? null,
  gewensteLeveringTekst: r.gewenste_levering_tekst ?? null,
  waarborgsomBedrag: r.waarborgsom_bedrag ?? null,
  waarborgsomPct: r.waarborgsom_pct ?? null,
  kostenType: r.kosten_type ?? null,
  voorwaarden: r.voorwaarden ?? null,
  notities: r.notities ?? null,
  interneNotities: r.interne_notities ?? null,
  bron: r.bron ?? null,
  richting: r.richting ?? 'van_koper',
  isBestOffer: !!r.is_best_offer,
  isFinalOffer: !!r.is_final_offer,
  rejectedReason: r.rejected_reason ?? null,
  acceptedAt: r.accepted_at ?? null,
  rejectedAt: r.rejected_at ?? null,
  withdrawnAt: r.withdrawn_at ?? null,
  expiredAt: r.expired_at ?? null,
  aangemaaktDoor: r.aangemaakt_door ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const biedingToDb = (b: Partial<Bieding>) => {
  const o: Record<string, any> = {};
  if (b.objectId !== undefined) o.object_id = b.objectId;
  if (b.relatieId !== undefined) o.relatie_id = b.relatieId;
  if (b.dealId !== undefined) o.deal_id = b.dealId || null;
  if (b.objectPipelineId !== undefined) o.object_pipeline_id = b.objectPipelineId || null;
  if (b.counterOfferToId !== undefined) o.counter_offer_to_id = b.counterOfferToId || null;
  if (b.bedrag !== undefined) o.bedrag = b.bedrag ?? null;
  if (b.currency !== undefined) o.currency = b.currency;
  if (b.bieddatum !== undefined) o.bieddatum = b.bieddatum;
  if (b.geldigTot !== undefined) o.geldig_tot = b.geldigTot || null;
  if (b.status !== undefined) o.status = b.status;
  if (b.offerType !== undefined) o.offer_type = b.offerType;
  if (b.financieringsvoorbehoud !== undefined) o.financieringsvoorbehoud = b.financieringsvoorbehoud;
  if (b.ddVoorbehoud !== undefined) o.dd_voorbehoud = b.ddVoorbehoud;
  if (b.gewensteLevering !== undefined) o.gewenste_levering = b.gewensteLevering || null;
  if (b.gewensteLeveringTekst !== undefined) o.gewenste_levering_tekst = b.gewensteLeveringTekst || null;
  if (b.waarborgsomBedrag !== undefined) o.waarborgsom_bedrag = b.waarborgsomBedrag ?? null;
  if (b.waarborgsomPct !== undefined) o.waarborgsom_pct = b.waarborgsomPct ?? null;
  if (b.kostenType !== undefined) o.kosten_type = b.kostenType || null;
  if (b.voorwaarden !== undefined) o.voorwaarden = b.voorwaarden || null;
  if (b.notities !== undefined) o.notities = b.notities || null;
  if (b.interneNotities !== undefined) o.interne_notities = b.interneNotities || null;
  if (b.bron !== undefined) o.bron = b.bron || null;
  if (b.richting !== undefined) o.richting = b.richting;
  if (b.isBestOffer !== undefined) o.is_best_offer = b.isBestOffer;
  if (b.isFinalOffer !== undefined) o.is_final_offer = b.isFinalOffer;
  if (b.rejectedReason !== undefined) o.rejected_reason = b.rejectedReason || null;
  if (b.acceptedAt !== undefined) o.accepted_at = b.acceptedAt || null;
  if (b.rejectedAt !== undefined) o.rejected_at = b.rejectedAt || null;
  if (b.withdrawnAt !== undefined) o.withdrawn_at = b.withdrawnAt || null;
  if (b.aangemaaktDoor !== undefined) o.aangemaakt_door = b.aangemaaktDoor || null;
  return o;
};
