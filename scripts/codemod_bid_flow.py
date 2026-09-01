from pathlib import Path
import re


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f"Expected fragment not found in {path}: {old[:120]!r}")
    p.write_text(s.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str) -> None:
    p = Path(path)
    s = p.read_text()
    s2, n = re.subn(pattern, repl, s, count=1, flags=re.S)
    if n != 1:
        raise SystemExit(f"Expected one regex match in {path}, got {n}: {pattern[:100]}")
    p.write_text(s2)


# 1) Candidate semantics: generic bid/proposal stage and no candidate-driven terminal Object state.
replace_once(
    "src/data/mock-data.ts",
    "  { key: 'indicatieve_bieding',     label: 'Indicatieve bieding' },",
    "  { key: 'indicatieve_bieding',     label: 'Bieding / prijsvoorstel' },",
)
replace_once(
    "src/data/mock-data.ts",
    "  transport_closing: 'closing',\n  afgerond: 'afgerond',\n  afgevallen: 'afgevallen',\n};",
    "  transport_closing: 'closing',\n  // Terminale Objectstatus is altijd een bewuste Object-actie.\n  // Een individuele kandidaat mag het Object nooit winnen/verliezen.\n};",
)

# 2) Candidate -> Object automation reads live DB state and never terminates the Object.
replace_once(
    "src/hooks/useDataStore.tsx",
    """    // -- AUTOMATION: lichte vooruitgang van objectfase wanneer kandidaat verschuift --
    if (patch.pipelineFase) {
      try {
        const { KANDIDAAT_NAAR_OBJECT_STAGE } = await import('@/data/mock-data');
        const targetSlug = KANDIDAAT_NAAR_OBJECT_STAGE[updated.pipelineFase];
        const obj = objecten.find(o => o.id === updated.objectId);
        if (!targetSlug || !obj || obj.pipelineStageLocked) return;

        const defaultPipeline = pipelines.find(p => p.entityType === 'object' && p.isDefault) ?? pipelines.find(p => p.entityType === 'object');
        const pipelineIdForLookup = obj.pipelineId ?? defaultPipeline?.id;
        if (!pipelineIdForLookup) return;

        const targetStage = pipelineStages.find(s => s.slug === targetSlug && s.pipelineId === pipelineIdForLookup);
        const huidig = pipelineStages.find(s => s.id === obj.pipelineStageId);
        if (!targetStage) return;
        if (huidig && targetStage.sortOrder <= huidig.sortOrder) return;

        const { error: e2 } = await supabase.from('objecten').update({
          pipeline_stage_id: targetStage.id,
          pipeline_id: targetStage.pipelineId,
          pipeline_updated_at: new Date().toISOString(),
        }).eq('id', obj.id);
        if (!e2) {
          setObjecten(prev => prev.map(x => x.id === obj.id
            ? { ...x, pipelineStageId: targetStage.id, pipelineId: targetStage.pipelineId, pipelineUpdatedAt: new Date().toISOString() }
            : x));
        }
      } catch (e) {
        console.warn('Object pipeline-automation overgeslagen:', e);
      }
    }""",
    """    // -- AUTOMATION: kandidaat kan het Object alleen vooruit helpen, nooit afsluiten --
    if (patch.pipelineFase) {
      try {
        if (updated.pipelineFase === 'afgevallen' || updated.pipelineFase === 'afgerond') return;

        const { KANDIDAAT_NAAR_OBJECT_STAGE } = await import('@/data/mock-data');
        const targetSlug = KANDIDAAT_NAAR_OBJECT_STAGE[updated.pipelineFase];
        const obj = objecten.find(o => o.id === updated.objectId);
        if (!targetSlug || !obj) return;

        // Lees live DB-state: event-driven transitions zoals Preferred bidder
        // mogen nooit door een stale clientstate worden teruggezet.
        const { data: liveObject, error: liveError } = await supabase.from('objecten')
          .select('pipeline_id, pipeline_stage_id, pipeline_stage_locked')
          .eq('id', updated.objectId)
          .single();
        if (liveError || !liveObject || (liveObject as any).pipeline_stage_locked) return;

        const defaultPipeline = pipelines.find(p => p.entityType === 'object' && p.isDefault) ?? pipelines.find(p => p.entityType === 'object');
        const pipelineIdForLookup = (liveObject as any).pipeline_id ?? obj.pipelineId ?? defaultPipeline?.id;
        if (!pipelineIdForLookup) return;

        const targetStage = pipelineStages.find(s => s.slug === targetSlug && s.pipelineId === pipelineIdForLookup);
        const huidig = pipelineStages.find(s => s.id === (liveObject as any).pipeline_stage_id);
        if (!targetStage) return;
        if (huidig && targetStage.sortOrder <= huidig.sortOrder) return;

        const now = new Date().toISOString();
        const { error: e2 } = await supabase.from('objecten').update({
          pipeline_stage_id: targetStage.id,
          pipeline_id: targetStage.pipelineId,
          pipeline_updated_at: now,
        }).eq('id', obj.id);
        if (!e2) {
          setObjecten(prev => prev.map(x => x.id === obj.id
            ? { ...x, pipelineStageId: targetStage.id, pipelineId: targetStage.pipelineId, pipelineUpdatedAt: now }
            : x));
        }
      } catch (e) {
        console.warn('Object pipeline-automation overgeslagen:', e);
      }
    }""",
)

# 3) Object Pipeline board = active inventory only.
replace_once(
    "src/components/pipeline/ObjectPipelineKanban.tsx",
    "    return objecten.filter(o => {\n      if (q) {",
    "    return objecten.filter(o => {\n      if (o.isArchived || o.softDeletedAt) return false;\n      if (q) {",
)

# 4) Clarify unlock semantics.
replace_once(
    "src/components/pipeline/ObjectPipelineFaseSectie.tsx",
    "Automatische voortgang weer ingeschakeld",
    "Automatisch volgen van kandidaatvoortgang hervat",
)
replace_once(
    "src/components/pipeline/ObjectPipelineFaseSectie.tsx",
    '<Unlock className="h-3 w-3" /> Automatische voortgang',
    '<Unlock className="h-3 w-3" /> Volgt kandidaten automatisch',
)
replace_once(
    "src/components/pipeline/ObjectPipelineFaseSectie.tsx",
    '<Unlock className="h-3.5 w-3.5" />\n                  Auto. voortgang aan',
    '<Unlock className="h-3.5 w-3.5" />\n                  Automatisch volgen hervatten',
)

# 5) Counteroffer direction alternates; relation remains the candidate trajectory.
replace_once(
    "src/components/biedingen/OfferFormDialog.tsx",
    "import { parseDutchNumber } from '@/lib/format/nl';",
    "import { parseDutchNumber } from '@/lib/format/nl';\nimport { nextCounterDirection, counterStatusForDirection } from '@/lib/biedingen/progression';",
)
replace_once(
    "src/components/biedingen/OfferFormDialog.tsx",
    """              offerType: 'tegenvoorstel' as BiedingType,
              status: 'tegenvoorstel_gedaan' as BiedingStatus,
              richting: 'van_verkoper' as BiedingRichting,""",
    """              offerType: 'tegenvoorstel' as BiedingType,
              status: counterStatusForDirection(nextCounterDirection(counterTo.richting)),
              richting: nextCounterDirection(counterTo.richting),""",
)
replace_once(
    "src/components/biedingen/OfferFormDialog.tsx",
    'label="Relatie / kandidaat" pickerTitle="Kies relatie"',
    'label="Kandidaat / kopertraject" pickerTitle="Kies kandidaat"',
)

# 6) Candidate dialog: offer data is read-only projection from canonical bids.
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    "import { useState, useEffect } from 'react';",
    "import { useState, useEffect, useMemo } from 'react';",
)
replace_once("src/components/pipeline/PipelineKandidaatDialog.tsx", "import { NumberField } from '@/components/ui/number-field';\n", "")
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    "import { format } from 'date-fns';",
    "import { format } from 'date-fns';\nimport { useBiedingen } from '@/hooks/useBiedingen';\nimport { fmtEur } from '@/lib/biedingen/format';\nimport { getNegotiationPositions } from '@/lib/biedingen/progression';",
)
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    """  const laatsteContact = getLaatsteContactDatum(kandidaat.relatieId, contactMoments);

  const relatie = getRelatieById(kandidaat.relatieId);""",
    """  const laatsteContact = getLaatsteContactDatum(kandidaat.relatieId, contactMoments);
  const { items: objectBiedingen } = useBiedingen({ objectId: kandidaat.objectId });
  const kandidaatBiedingen = useMemo(
    () => objectBiedingen.filter(b => b.relatieId === kandidaat.relatieId),
    [objectBiedingen, kandidaat.relatieId],
  );
  const positie = useMemo(
    () => getNegotiationPositions(kandidaatBiedingen)[0] ?? null,
    [kandidaatBiedingen],
  );

  const relatie = getRelatieById(kandidaat.relatieId);""",
)
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    """      const patch: any = { ...form };
      for (const k of OPTIONAL_NULLABLE_KEYS) {""",
    """      const patch: any = { ...form };
      // Deze velden zijn voortaan alleen een projectie van de centrale biedingenmodule.
      delete patch.biedingBedrag;
      delete patch.biedingVoorwaarden;
      delete patch.financieringsvoorbehoud;
      delete patch.gewensteLevering;
      for (const k of OPTIONAL_NULLABLE_KEYS) {""",
)
replace_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    '<TabsTrigger value="bieding">Bieding</TabsTrigger>',
    '<TabsTrigger value="bieding">Biedingen</TabsTrigger>',
)
regex_once(
    "src/components/pipeline/PipelineKandidaatDialog.tsx",
    r'          <TabsContent value="bieding" className="space-y-3 pt-4">.*?          </TabsContent>\n\n          <TabsContent value="opvolging"',
    '''          <TabsContent value="bieding" className="space-y-4 pt-4">
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
              <div>
                <div className="text-sm font-medium">Biedingen centraal geregistreerd</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bedragen, voorwaarden en tegenvoorstellen beheer je op het Object onder Dealflow → Biedingen. Deze kandidaatkaart toont alleen de actuele projectie.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Laatste kopersbod</div>
                  <div className="text-sm font-semibold mt-1">{positie?.latestBuyer?.bedrag != null ? fmtEur(positie.latestBuyer.bedrag) : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Laatste verkopersvoorstel</div>
                  <div className="text-sm font-semibold mt-1">{positie?.latestSeller?.bedrag != null ? fmtEur(positie.latestSeller.bedrag) : '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Voorstellen</div>
                  <div className="text-sm font-semibold mt-1">{kandidaatBiedingen.length}</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={!!form.feeAkkoord} onCheckedChange={v => set('feeAkkoord', !!v)} />
              <Label className="cursor-default">Fee akkoord met kandidaat</Label>
            </div>
          </TabsContent>

          <TabsContent value="opvolging"''',
)

# 7) Offers section: negotiation series KPIs and clearer semantics.
replace_once(
    "src/components/biedingen/BiedingenSection.tsx",
    "import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';",
    "import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';\nimport { getNegotiationPositions, nextCounterDirection } from '@/lib/biedingen/progression';",
)
regex_once(
    "src/components/biedingen/BiedingenSection.tsx",
    r"  const stats = useMemo\(\(\) => \{.*?  \}, \[items\]\);",
    '''  const positions = useMemo(() => getNegotiationPositions(items), [items]);

  const stats = useMemo(() => {
    const actief = items.filter(b => ACTIEF.includes(effectieveStatus(b)));
    const geaccepteerd = items.find(b => b.status === 'geaccepteerd') ?? null;
    const kopersbiedingen = actief.filter(b => b.richting === 'van_koper' && b.bedrag != null);
    const verkopersvoorstellen = actief.filter(b => (b.richting === 'van_verkoper' || b.richting === 'namens_verkoper') && b.bedrag != null);
    const hoogsteKopersbod = kopersbiedingen.reduce<Bieding | null>(
      (best, b) => (!best || (best.bedrag ?? 0) < (b.bedrag ?? 0) ? b : best), null);
    const laatsteVerkopersvoorstel = [...verkopersvoorstellen].sort((a, b) =>
      new Date(b.createdAt || b.bieddatum).getTime() - new Date(a.createdAt || a.bieddatum).getTime()
    )[0] ?? null;
    const openTrajecten = new Set(actief.map(b => b.relatieId)).size;
    return { aantalActief: actief.length, openTrajecten, totaalAantal: items.length, hoogsteKopersbod, laatsteVerkopersvoorstel, geaccepteerd };
  }, [items]);''',
)
replace_once(
    "src/components/biedingen/BiedingenSection.tsx",
    "                {stats.aantalActief} actief{stats.totaalAantal !== stats.aantalActief ? ` · ${stats.totaalAantal} totaal` : ''}",
    "                {stats.openTrajecten} open traject{stats.openTrajecten === 1 ? '' : 'en'} · {stats.totaalAantal} voorstel{stats.totaalAantal === 1 ? '' : 'len'}",
)
replace_once(
    "src/components/biedingen/BiedingenSection.tsx",
    '''              <KpiTile label="Open biedingen" value={String(stats.aantalActief)} />
              <KpiTile
                label="Hoogste actief"
                value={stats.hoogsteActief?.bedrag != null ? fmtEur(stats.hoogsteActief.bedrag) : '—'}
                sub={vraagprijs && stats.hoogsteActief?.bedrag
                  ? vraagprijsDelta(stats.hoogsteActief.bedrag, vraagprijs)?.label ?? undefined
                  : undefined}
                subTone={vraagprijs && stats.hoogsteActief?.bedrag
                  ? vraagprijsDelta(stats.hoogsteActief.bedrag, vraagprijs)?.tone : undefined}
                icon={<ArrowUp className="h-3.5 w-3.5" />}
              />
              <KpiTile
                label="Laagste actief"
                value={stats.laagsteActief?.bedrag != null ? fmtEur(stats.laagsteActief.bedrag) : '—'}
                icon={<ArrowDown className="h-3.5 w-3.5" />}
              />''',
    '''              <KpiTile label="Open biedingsreeksen" value={String(stats.openTrajecten)} />
              <KpiTile
                label="Hoogste kopersbod"
                value={stats.hoogsteKopersbod?.bedrag != null ? fmtEur(stats.hoogsteKopersbod.bedrag) : '—'}
                sub={vraagprijs && stats.hoogsteKopersbod?.bedrag
                  ? vraagprijsDelta(stats.hoogsteKopersbod.bedrag, vraagprijs)?.label ?? undefined
                  : undefined}
                subTone={vraagprijs && stats.hoogsteKopersbod?.bedrag
                  ? vraagprijsDelta(stats.hoogsteKopersbod.bedrag, vraagprijs)?.tone : undefined}
                icon={<ArrowUp className="h-3.5 w-3.5" />}
              />
              <KpiTile
                label="Laatste verkopersvoorstel"
                value={stats.laatsteVerkopersvoorstel?.bedrag != null ? fmtEur(stats.laatsteVerkopersvoorstel.bedrag) : '—'}
                icon={<ArrowDown className="h-3.5 w-3.5" />}
              />''',
)
replace_once("src/components/biedingen/BiedingenSection.tsx", ">Bieder</th>", ">Kandidaat / traject</th>")
replace_once(
    "src/components/biedingen/BiedingenSection.tsx",
    '          {loading && <p className="text-sm text-muted-foreground">Laden…</p>}',
    '''          {!compact && positions.some(p => p.latestSeller) && (
            <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actuele onderhandelingspositie</div>
              {positions.filter(p => p.latestBuyer || p.latestSeller).map(p => (
                <div key={p.relatieId} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 sm:items-center text-sm">
                  <div className="min-w-0">{renderRelatieLabel(p.relatieId)}</div>
                  <div><span className="text-xs text-muted-foreground">Koper</span> <span className="font-medium">{p.latestBuyer?.bedrag != null ? fmtEur(p.latestBuyer.bedrag) : '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground">Verkoper</span> <span className="font-medium">{p.latestSeller?.bedrag != null ? fmtEur(p.latestSeller.bedrag) : '—'}</span></div>
                  <div><span className="text-xs text-muted-foreground">Gap</span> <span className="font-medium">{p.gap != null ? fmtEur(Math.abs(p.gap)) : '—'}</span></div>
                </div>
              ))}
            </div>
          )}

          {loading && <p className="text-sm text-muted-foreground">Laden…</p>}''',
)
replace_once(
    "src/components/biedingen/BiedingenSection.tsx",
    '<DropdownMenuItem onClick={onCounter}><CornerDownRight className="h-3.5 w-3.5 mr-2" />Tegenvoorstel</DropdownMenuItem>',
    '<DropdownMenuItem onClick={onCounter}><CornerDownRight className="h-3.5 w-3.5 mr-2" />{nextCounterDirection(b.richting) === \'van_koper\' ? \'Nieuw tegenbod koper\' : \'Tegenvoorstel verkoper\'}</DropdownMenuItem>',
)

# 8) New pure business logic helper.
Path("src/lib/biedingen/progression.ts").write_text('''import { PIPELINE_FASES, type PipelineFase } from '@/data/mock-data';
import type { Bieding, BiedingRichting, BiedingStatus } from './types';

const PHASE_ORDER = new Map(PIPELINE_FASES.map((fase, index) => [fase.key, index]));
const NO_PROGRESS = new Set<BiedingStatus>(['concept', 'afgewezen', 'ingetrokken', 'verlopen']);

export function getOfferProgressTarget(
  bieding: Pick<Bieding, 'status' | 'offerType' | 'richting' | 'counterOfferToId'>,
): PipelineFase | null {
  if (NO_PROGRESS.has(bieding.status) || bieding.richting === 'intern') return null;
  if (bieding.status === 'geaccepteerd') return 'onderhandeling';

  const isOnderhandeling =
    !!bieding.counterOfferToId ||
    bieding.offerType === 'tegenvoorstel' ||
    bieding.offerType === 'verhoogd_bod' ||
    bieding.richting === 'van_verkoper' ||
    bieding.richting === 'namens_verkoper' ||
    bieding.status === 'tegenvoorstel_gedaan' ||
    bieding.status === 'aangepast_bod_gevraagd';

  if (isOnderhandeling) return 'onderhandeling';
  if (bieding.richting === 'van_koper') return 'indicatieve_bieding';
  return null;
}

export function shouldAdvanceCandidate(current: PipelineFase, target: PipelineFase): boolean {
  if (current === 'afgerond') return false;
  if (current === 'afgevallen') return true;
  return (PHASE_ORDER.get(target) ?? -1) > (PHASE_ORDER.get(current) ?? -1);
}

export function nextCounterDirection(richting: BiedingRichting): BiedingRichting {
  if (richting === 'van_koper') return 'van_verkoper';
  if (richting === 'van_verkoper' || richting === 'namens_verkoper') return 'van_koper';
  return 'van_koper';
}

export function counterStatusForDirection(richting: BiedingRichting): BiedingStatus {
  return richting === 'van_koper' ? 'ontvangen' : 'tegenvoorstel_gedaan';
}

export interface NegotiationPosition {
  relatieId: string;
  latestBuyer: Bieding | null;
  latestSeller: Bieding | null;
  gap: number | null;
}

const positionTimestamp = (b: Bieding) => new Date(b.createdAt || b.bieddatum).getTime();
const isPositionRecord = (b: Bieding) => !['concept', 'afgewezen', 'ingetrokken', 'verlopen'].includes(b.status);

export function getNegotiationPositions(items: Bieding[]): NegotiationPosition[] {
  const byRelatie = new Map<string, Bieding[]>();
  for (const item of items.filter(isPositionRecord)) {
    const list = byRelatie.get(item.relatieId) ?? [];
    list.push(item);
    byRelatie.set(item.relatieId, list);
  }

  return [...byRelatie.entries()].map(([relatieId, list]) => {
    const buyer = list.filter(b => b.richting === 'van_koper').sort((a, b) => positionTimestamp(b) - positionTimestamp(a))[0] ?? null;
    const seller = list.filter(b => b.richting === 'van_verkoper' || b.richting === 'namens_verkoper').sort((a, b) => positionTimestamp(b) - positionTimestamp(a))[0] ?? null;
    const gap = buyer?.bedrag != null && seller?.bedrag != null ? seller.bedrag - buyer.bedrag : null;
    return { relatieId, latestBuyer: buyer, latestSeller: seller, gap };
  });
}
''')

# 9) Canonical offer -> candidate -> Object progression.
replace_once(
    "src/hooks/useBiedingen.tsx",
    "import { BIEDING_TYPE_LABELS, BIEDING_STATUS_LABELS } from '@/lib/biedingen/types';",
    "import { BIEDING_TYPE_LABELS, BIEDING_STATUS_LABELS } from '@/lib/biedingen/types';\nimport { useDataStore } from '@/hooks/useDataStore';\nimport { getOfferProgressTarget, shouldAdvanceCandidate } from '@/lib/biedingen/progression';\nimport type { PipelineKandidaat } from '@/data/mock-data';",
)
replace_once(
    "src/hooks/useBiedingen.tsx",
    "export function useBiedingen(scope: Scope) {\n  const [items, setItems] = useState<Bieding[]>([]);",
    "export function useBiedingen(scope: Scope) {\n  const { pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat } = useDataStore();\n  const [items, setItems] = useState<Bieding[]>([]);",
)
replace_once(
    "src/hooks/useBiedingen.tsx",
    "  const refresh = fetch;\n\n  const create = useCallback(async (payload: Partial<Bieding>) => {",
    '''  const refresh = fetch;

  const syncKandidaatUitBieding = useCallback(async (bieding: Bieding) => {
    const target = getOfferProgressTarget(bieding);
    if (!target) return;

    const existing = pipelineKandidaten.find(k => k.objectId === bieding.objectId && k.relatieId === bieding.relatieId);
    const buyerProjection: Partial<PipelineKandidaat> = bieding.richting === 'van_koper'
      ? {
          biedingBedrag: bieding.bedrag ?? undefined,
          biedingVoorwaarden: bieding.voorwaarden ?? undefined,
          gewensteLevering: bieding.gewensteLevering ?? undefined,
          ...(bieding.financieringsvoorbehoud === 'ja' ? { financieringsvoorbehoud: true } : {}),
          ...(bieding.financieringsvoorbehoud === 'geen' ? { financieringsvoorbehoud: false } : {}),
        }
      : {};

    if (!existing) {
      const created = await addPipelineKandidaat({
        objectId: bieding.objectId,
        relatieId: bieding.relatieId,
        pipelineFase: target,
        interesseNiveau: 'warm',
        teaserVerstuurd: false,
        ndaVerstuurd: false,
        ndaGetekend: false,
        informatieGedeeld: false,
        feeAkkoord: false,
        ...buyerProjection,
      });
      if (created) await updatePipelineKandidaat(created.id, { pipelineFase: target });
      return;
    }

    const patch: Partial<PipelineKandidaat> = { ...buyerProjection };
    if (shouldAdvanceCandidate(existing.pipelineFase, target)) {
      patch.pipelineFase = target;
      if (existing.pipelineFase === 'afgevallen') patch.redenAfgevallen = '';
    }
    if (Object.keys(patch).length > 0) await updatePipelineKandidaat(existing.id, patch);
  }, [pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat]);

  const create = useCallback(async (payload: Partial<Bieding>) => {''',
)
replace_once(
    "src/hooks/useBiedingen.tsx",
    "    const created = biedingFromDb(data);\n    await logSystemContactMoment({",
    "    const created = biedingFromDb(data);\n    await syncKandidaatUitBieding(created);\n    await logSystemContactMoment({",
)
replace_once("src/hooks/useBiedingen.tsx", "  }, [fetch]);\n\n  const update = useCallback", "  }, [fetch, syncKandidaatUitBieding]);\n\n  const update = useCallback")
replace_once(
    "src/hooks/useBiedingen.tsx",
    "    const updated = biedingFromDb(data);\n    if (patch.status) {",
    "    const updated = biedingFromDb(data);\n    await syncKandidaatUitBieding(updated);\n    if (patch.status) {",
)
replace_once("src/hooks/useBiedingen.tsx", "  }, [fetch]);\n\n  const remove = useCallback", "  }, [fetch, syncKandidaatUitBieding]);\n\n  const remove = useCallback")
replace_once(
    "src/hooks/useBiedingen.tsx",
    "    if (error) throw error;\n\n    const row = Array.isArray(data) ? data[0] : data;",
    "    if (error) throw error;\n\n    await syncKandidaatUitBieding({ ...bieding, status: 'geaccepteerd' });\n\n    const row = Array.isArray(data) ? data[0] : data;",
)
replace_once("src/hooks/useBiedingen.tsx", "  }, [items, fetch]);", "  }, [items, fetch, syncKandidaatUitBieding]);")

# 10) Regression tests.
Path("src/lib/biedingen/progression.test.ts").write_text('''import { describe, expect, it } from 'vitest';
import { KANDIDAAT_NAAR_OBJECT_STAGE, PIPELINE_FASES } from '@/data/mock-data';
import type { Bieding } from './types';
import {
  counterStatusForDirection,
  getNegotiationPositions,
  getOfferProgressTarget,
  nextCounterDirection,
  shouldAdvanceCandidate,
} from './progression';

const offer = (patch: Partial<Bieding> = {}): Bieding => ({
  id: 'b1', objectId: 'o1', relatieId: 'r1', bedrag: 600000,
  currency: 'EUR', bieddatum: '2026-09-01', status: 'ontvangen',
  offerType: 'indicatief', financieringsvoorbehoud: 'onbekend', ddVoorbehoud: 'onbekend',
  richting: 'van_koper', isBestOffer: false, isFinalOffer: false,
  createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  ...patch,
});

describe('bieding -> kandidaat -> object voortgang', () => {
  it('zet een eerste koperprijsvoorstel op biedingsniveau, niet automatisch op onderhandeling', () => {
    expect(getOfferProgressTarget(offer())).toBe('indicatieve_bieding');
    expect(PIPELINE_FASES.find(f => f.key === 'indicatieve_bieding')?.label).toBe('Bieding / prijsvoorstel');
  });

  it('zet een echte tegenvoorstelreeks op onderhandeling', () => {
    expect(getOfferProgressTarget(offer({ richting: 'van_verkoper', offerType: 'tegenvoorstel', status: 'tegenvoorstel_gedaan', counterOfferToId: 'b0' }))).toBe('onderhandeling');
    expect(getOfferProgressTarget(offer({ offerType: 'verhoogd_bod', counterOfferToId: 'b0' }))).toBe('onderhandeling');
  });

  it('laat een individuele kandidaat het Object nooit afsluiten', () => {
    expect(KANDIDAAT_NAAR_OBJECT_STAGE.afgevallen).toBeUndefined();
    expect(KANDIDAAT_NAAR_OBJECT_STAGE.afgerond).toBeUndefined();
  });

  it('kan een afgevallen kandidaat door nieuw concreet gedrag reactiveren, maar een afgeronde niet terugzetten', () => {
    expect(shouldAdvanceCandidate('afgevallen', 'indicatieve_bieding')).toBe(true);
    expect(shouldAdvanceCandidate('afgerond', 'onderhandeling')).toBe(false);
  });
});

describe('tegenvoorstellen', () => {
  it('wisselt de richting koper -> verkoper -> koper', () => {
    expect(nextCounterDirection('van_koper')).toBe('van_verkoper');
    expect(nextCounterDirection('van_verkoper')).toBe('van_koper');
    expect(counterStatusForDirection('van_koper')).toBe('ontvangen');
    expect(counterStatusForDirection('van_verkoper')).toBe('tegenvoorstel_gedaan');
  });

  it('bewaart laatste koper- en verkoperspositie als één onderhandelingstraject', () => {
    const items = [
      offer({ id: 'b1', bedrag: 600000, richting: 'van_koper', createdAt: '2026-09-01T10:00:00Z' }),
      offer({ id: 'b2', bedrag: 800000, richting: 'van_verkoper', offerType: 'tegenvoorstel', status: 'tegenvoorstel_gedaan', counterOfferToId: 'b1', createdAt: '2026-09-01T11:00:00Z' }),
      offer({ id: 'b3', bedrag: 700000, richting: 'van_koper', offerType: 'tegenvoorstel', counterOfferToId: 'b2', createdAt: '2026-09-01T12:00:00Z' }),
    ];
    const [p] = getNegotiationPositions(items);
    expect(p.latestBuyer?.bedrag).toBe(700000);
    expect(p.latestSeller?.bedrag).toBe(800000);
    expect(p.gap).toBe(100000);
  });
});
''')

print("Guarded bid-flow codemod completed")
