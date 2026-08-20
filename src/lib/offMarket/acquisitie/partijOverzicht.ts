import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { bouwKandidatenVoorSignaal, type BulkKandidaat } from './bulkBrief';

export type PartijAdvies = 'normaal' | 'portefeuille' | 'recent_benaderd' | 'warm_contact' | 'niet_opnieuw';

export interface PartijObject {
  signaalId: string; adres: string; typeSignaal: string | null; status: string | null;
  benaderd: boolean; laatsteContactOp: string | null;
}
export interface PartijOverzicht {
  key: string; naam: string; soort: 'bedrijf' | 'persoon'; verzendadres: string | null;
  objecten: PartijObject[]; briefAantal: number; verstuurdAantal: number;
  laatsteContactOp: string | null; laatsteContactSignaalId: string | null; laatsteContactObjectAdres: string | null;
  laatsteRespons: string | null; laatsteResponsOp: string | null;
  laatsteResponsSignaalId: string | null; laatsteResponsObjectAdres: string | null;
  advies: PartijAdvies;
}
function normaliseer(waarde: string | null | undefined): string { return String(waarde ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\bbesloten\s+vennootschap\b/g, ' bv ').replace(/\bb\s+v\b/g, ' bv ').replace(/\s+/g, ' ').trim(); }
function normaliseerAdres(waarde: string | null | undefined): string { return normaliseer(waarde).replace(/\s+/g, ' ').trim(); }
export function partijKeyVoorKandidaat(kandidaat: Pick<BulkKandidaat, 'naam' | 'bedrijfsnaam' | 'verzendadres'>): string | null { const bedrijf = normaliseer(kandidaat.bedrijfsnaam); if (bedrijf) return `bedrijf:${bedrijf}`; const persoon = normaliseer(kandidaat.naam); if (!persoon) return null; return `persoon:${persoon}|${normaliseerAdres(kandidaat.verzendadres)}`; }
export function partijKeyVoorBrief(brief: Pick<OffMarketBrief, 'eigenaar_naam' | 'eigenaar_bedrijfsnaam' | 'verzendadres'>): string | null { return partijKeyVoorKandidaat({ naam: brief.eigenaar_naam, bedrijfsnaam: brief.eigenaar_bedrijfsnaam, verzendadres: brief.verzendadres }); }
function isPositieveRespons(status: string | null): boolean { return !!status && ['interesse', 'wil_meer_informatie', 'gesprek_gepland', 'reactie_ontvangen'].includes(status); }
function isNegatieveRespons(status: string | null): boolean { return !!status && ['niet_geinteresseerd', 'afgevallen', 'verkocht_of_niet_relevant'].includes(status); }
function dagenSinds(iso: string | null): number | null { if (!iso) return null; const tijd = Date.parse(iso); if (!Number.isFinite(tijd)) return null; return Math.floor((Date.now() - tijd) / 86_400_000); }
function bepaalAdvies(input: { objectAantal: number; verstuurdAantal: number; laatsteContactOp: string | null; laatsteRespons: string | null }): PartijAdvies { if (isNegatieveRespons(input.laatsteRespons)) return 'niet_opnieuw'; if (isPositieveRespons(input.laatsteRespons)) return 'warm_contact'; const dagen = dagenSinds(input.laatsteContactOp); if (input.verstuurdAantal > 0 && dagen !== null && dagen <= 30) return 'recent_benaderd'; if (input.objectAantal > 1) return 'portefeuille'; return 'normaal'; }
function contactDatum(brief: OffMarketBrief): string | null { if (brief.status !== 'verstuurd') return null; return brief.verzonden_op ?? brief.postdatum ?? brief.updated_at ?? brief.created_at ?? null; }

export function bouwPartijenOverzicht(signalen: readonly OffMarketSignaal[], brieven: readonly OffMarketBrief[]): PartijOverzicht[] {
  const brievenPerSignaal = new Map<string, OffMarketBrief[]>();
  for (const brief of brieven) { if (brief.archived_at) continue; const lijst = brievenPerSignaal.get(brief.signaal_id) ?? []; lijst.push(brief); brievenPerSignaal.set(brief.signaal_id, lijst); }
  type Werk = { key: string; naam: string; soort: 'bedrijf' | 'persoon'; verzendadres: string | null; objecten: Map<string, PartijObject>; brieven: Map<string, OffMarketBrief> };
  const perPartij = new Map<string, Werk>();
  for (const signaal of signalen) {
    const kandidaten = bouwKandidatenVoorSignaal(signaal, brievenPerSignaal.get(signaal.id) ?? []);
    for (const kandidaat of kandidaten) {
      const key = partijKeyVoorKandidaat(kandidaat); if (!key) continue;
      let partij = perPartij.get(key);
      if (!partij) { partij = { key, naam: kandidaat.bedrijfsnaam ?? kandidaat.naam ?? '(onbekende partij)', soort: kandidaat.bedrijfsnaam ? 'bedrijf' : 'persoon', verzendadres: kandidaat.verzendadres, objecten: new Map(), brieven: new Map() }; perPartij.set(key, partij); }
      partij.objecten.set(signaal.id, { signaalId: signaal.id, adres: formatSignaalAdres(signaal) || signaal.adres || signaal.titel || 'Onbekend object', typeSignaal: signaal.type_signaal ?? null, status: signaal.status ?? null, benaderd: false, laatsteContactOp: null });
    }
  }
  for (const brief of brieven) {
    if (brief.archived_at) continue; const key = partijKeyVoorBrief(brief); if (!key) continue;
    let partij = perPartij.get(key);
    if (!partij) { partij = { key, naam: brief.eigenaar_bedrijfsnaam ?? brief.eigenaar_naam ?? '(onbekende partij)', soort: brief.eigenaar_bedrijfsnaam ? 'bedrijf' : 'persoon', verzendadres: brief.verzendadres, objecten: new Map(), brieven: new Map() }; perPartij.set(key, partij); }
    partij.brieven.set(brief.id, brief);
  }
  return [...perPartij.values()].map((partij) => {
    const partijBrieven = [...partij.brieven.values()]; const verstuurd = partijBrieven.filter((b) => b.status === 'verstuurd');
    const reacties = partijBrieven.filter((b) => !!b.responsstatus).sort((a,b) => String(b.responsdatum ?? b.updated_at ?? b.created_at).localeCompare(String(a.responsdatum ?? a.updated_at ?? a.created_at)));
    const laatsteResponsBrief = reacties[0];
    const laatsteContactPerSignaal = new Map<string,string>();
    for (const brief of verstuurd) { const datum = contactDatum(brief); if (!datum) continue; const huidig = laatsteContactPerSignaal.get(brief.signaal_id); if (!huidig || datum.localeCompare(huidig) > 0) laatsteContactPerSignaal.set(brief.signaal_id, datum); }
    const objecten = [...partij.objecten.values()].map((o) => { const laatsteContactOp = laatsteContactPerSignaal.get(o.signaalId) ?? null; return { ...o, benaderd: !!laatsteContactOp, laatsteContactOp }; }).sort((a,b) => a.adres.localeCompare(b.adres,'nl'));
    const laatsteContactObject = objecten.filter((o) => !!o.laatsteContactOp).sort((a,b) => String(b.laatsteContactOp).localeCompare(String(a.laatsteContactOp)))[0];
    const laatsteResponsObject = laatsteResponsBrief ? objecten.find((o) => o.signaalId === laatsteResponsBrief.signaal_id) : undefined;
    const laatsteContactOp = laatsteContactObject?.laatsteContactOp ?? null; const laatsteRespons = laatsteResponsBrief?.responsstatus ?? null;
    return { key: partij.key, naam: partij.naam, soort: partij.soort, verzendadres: partij.verzendadres, objecten, briefAantal: partijBrieven.length, verstuurdAantal: verstuurd.length, laatsteContactOp, laatsteContactSignaalId: laatsteContactObject?.signaalId ?? null, laatsteContactObjectAdres: laatsteContactObject?.adres ?? null, laatsteRespons, laatsteResponsOp: laatsteResponsBrief?.responsdatum ?? laatsteResponsBrief?.updated_at ?? laatsteResponsBrief?.created_at ?? null, laatsteResponsSignaalId: laatsteResponsBrief?.signaal_id ?? null, laatsteResponsObjectAdres: laatsteResponsObject?.adres ?? laatsteResponsBrief?.objectadres ?? null, advies: bepaalAdvies({ objectAantal: objecten.length, verstuurdAantal: verstuurd.length, laatsteContactOp, laatsteRespons }) } satisfies PartijOverzicht;
  }).sort((a,b) => b.objecten.length-a.objecten.length || b.verstuurdAantal-a.verstuurdAantal || a.naam.localeCompare(b.naam,'nl'));
}
export function partijWaarschuwing(partij: PartijOverzicht | undefined): string | null { if (!partij) return null; const basis=`${partij.objecten.length} object${partij.objecten.length===1?'':'en'}`; switch(partij.advies){ case 'niet_opnieuw': return `Bekende partij · ${basis} · eerdere negatieve reactie. Niet opnieuw koud aanschrijven zonder bewuste keuze.`; case 'warm_contact': return `Bekende partij · ${basis} · eerdere reactie/contact. Gebruik bij voorkeur bestaande opvolging in plaats van een nieuwe koude brief.`; case 'recent_benaderd': return `Bekende partij · ${basis} · recent al aangeschreven. Nieuwe brief standaard overslaan en eerst contacthistorie beoordelen.`; case 'portefeuille': return `Portefeuillehouder · ${basis}. Beoordeel of één partijbenadering logischer is dan meerdere losse brieven.`; default:return null; } }
export function standaardUitsluitenVoorNieuweBrief(partij: PartijOverzicht | undefined): boolean { return !!partij && ['niet_opnieuw','warm_contact','recent_benaderd'].includes(partij.advies); }
