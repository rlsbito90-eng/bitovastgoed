from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: verwacht 1 match, kreeg {count}")
    return content.replace(old, new, 1)


def replace_all_checked(content: str, old: str, new: str, expected: int, label: str) -> str:
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: verwacht {expected} matches, kreeg {count}")
    return content.replace(old, new)


# ---------------------------------------------------------------------------
# Deal detail: Object Pipeline is zichtbaar/canoniek; legacy relatie is veilig.
# ---------------------------------------------------------------------------
path = 'src/pages/DealDetailPage.tsx'
s = read(path)
s = s.replace('  DEAL_FASE_LABELS,\n', '')
s = s.replace('  FASE_KANS,\n', '')
s = replace_once(
    s,
    "import { DealFaseBadge, LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';",
    "import { LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';",
    'DealDetail status imports',
)
s = replace_once(
    s,
    "import DealKandidatenSectie from '@/components/deal/DealKandidatenSectie';\n",
    '',
    'DealDetail kandidaten import',
)
s = replace_once(
    s,
    "import { getListNavigation } from '@/lib/listNavigation';\n",
    "import { getListNavigation } from '@/lib/listNavigation';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { useObjectTrajectoryStage } from '@/hooks/useObjectTrajectoryStage';\n",
    'DealDetail traject imports',
)
s = replace_once(
    s,
    "  const object = store.getObjectById(deal.objectId);\n  const isAfgerond = deal.fase === 'afgerond';\n  const isAfgevallen = deal.fase === 'afgevallen';\n  const gewogenCommissie = deal.commissieBedrag != null\n    ? deal.commissieBedrag * (FASE_KANS[deal.fase] ?? 0)\n    : null;",
    "  const object = store.getObjectById(deal.objectId);\n  const { stage: trajectfase, probability: trajectKans, isTransactionPosition } = useObjectTrajectoryStage(deal.objectId);\n  const isAfgerond = deal.fase === 'afgerond';\n  const isAfgevallen = deal.fase === 'afgevallen';\n  const legacyRelatieIsEigenaar = Boolean(object?.eigenaarRelatieId && deal.relatieId === object.eigenaarRelatieId);\n  const gewogenCommissie = deal.commissieBedrag != null\n    ? deal.commissieBedrag * trajectKans\n    : null;",
    'DealDetail canonical state',
)
s = replace_once(
    s,
    '            <DealFaseBadge fase={deal.fase} />',
    '            <TrajectoryStageBadge objectId={deal.objectId} showIcon />',
    'DealDetail header badge',
)
s = replace_once(
    s,
    '              <Field label="Dealfase">{DEAL_FASE_LABELS[deal.fase]}</Field>',
    '              <Field label="Trajectfase">{trajectfase?.name ?? \'Niet ingesteld\'}</Field>',
    'DealDetail phase field',
)
s = replace_once(
    s,
    "                      Gewogen ({Math.round((FASE_KANS[deal.fase] ?? 0) * 100)}%)",
    "                      Gewogen ({Math.round(trajectKans * 100)}%)",
    'DealDetail weighted label',
)
s = replace_once(
    s,
    '          <DealKandidatenSectie dealId={deal.id} primaireRelatieId={deal.relatieId} />\n',
    '',
    'DealDetail candidates section',
)
s = replace_once(
    s,
    '            defaults={{ dealId: deal.id, objectId: deal.objectId, relatieId: deal.relatieId }}',
    '            defaults={{ dealId: deal.id, objectId: deal.objectId, relatieId: isTransactionPosition ? deal.relatieId : undefined }}',
    'DealDetail bid defaults',
)
s = replace_once(
    s,
    '                  <UsersIcon className="h-4 w-4 text-muted-foreground" /> Primaire relatie',
    "                  <UsersIcon className=\"h-4 w-4 text-muted-foreground\" /> {isTransactionPosition ? 'Koper / preferred bidder' : legacyRelatieIsEigenaar ? 'Verkoper / eigenaar · legacy' : 'Oude Deal-relatie · legacy'}",
    'DealDetail relation title',
)
s = replace_once(
    s,
    "                {relatie.investeerderSubtype && (\n                  <p className=\"text-xs text-muted-foreground capitalize mt-1\">{relatie.investeerderSubtype.replace('_', ' ')}</p>\n                )}\n              </div>",
    "                {relatie.investeerderSubtype && (\n                  <p className=\"text-xs text-muted-foreground capitalize mt-1\">{relatie.investeerderSubtype.replace('_', ' ')}</p>\n                )}\n                {!isTransactionPosition && (\n                  <p className=\"text-xs text-warning mt-2 leading-relaxed\">\n                    Oude Deal-koppeling; niet leidend voor koper of traject. Kandidaten en voortgang worden via het Object beheerd.\n                  </p>\n                )}\n              </div>",
    'DealDetail legacy relation note',
)
# Voeg een duidelijke legacy-banner toe direct vóór de bestaande afgerond/afgevallen banners.
s = replace_once(
    s,
    '      {/* Banner: gefeliciteerd of afgevallen */}\n',
    "      {!isTransactionPosition && !isAfgerond && !isAfgevallen && (\n        <div className=\"bg-warning/8 border border-warning/30 rounded-md p-4 flex items-start gap-3\">\n          <AlertCircle className=\"h-5 w-5 text-warning shrink-0 mt-0.5\" />\n          <div className=\"flex-1\">\n            <p className=\"font-semibold text-foreground\">Legacy Deal-record</p>\n            <p className=\"text-sm text-muted-foreground mt-0.5\">\n              Dit record komt uit het oude model. De Object Pipeline is leidend; deze relatie is niet automatisch de koper.\n            </p>\n          </div>\n        </div>\n      )}\n\n      {/* Banner: gefeliciteerd of afgevallen */}\n",
    'DealDetail legacy banner',
)
write(path, s)


# ---------------------------------------------------------------------------
# Deal form: oude relatie niet foutief als koper presenteren.
# ---------------------------------------------------------------------------
path = 'src/components/forms/DealFormDialog.tsx'
s = read(path)
s = replace_once(
    s,
    "  const pipelineProbability = currentObjectStage?.probability != null\n    ? currentObjectStage.probability / 100\n    : 0;",
    "  const pipelineProbability = currentObjectStage?.probability != null\n    ? currentObjectStage.probability / 100\n    : 0;\n  const isConcreteTransactionPosition = Boolean(\n    currentObjectStage && preferredBidderStage && (\n      currentObjectStage.isWon || currentObjectStage.isLost || currentObjectStage.sortOrder >= preferredBidderStage.sortOrder\n    ),\n  );\n  const relatieLabel = isEdit && !isConcreteTransactionPosition\n    ? 'Legacy relatie (oude Deal) *'\n    : 'Preferred bidder / koper *';",
    'DealForm concrete position',
)
s = replace_once(s, '                    label="Preferred bidder / koper *"', '                    label={relatieLabel}', 'DealForm relation label')
s = replace_once(
    s,
    '              <Sectie titel="Koppelingen">\n',
    "              {isEdit && !isConcreteTransactionPosition && (\n                <div className=\"p-3 bg-warning/8 border border-warning/30 rounded-md flex items-start gap-2\">\n                  <AlertTriangle className=\"h-4 w-4 mt-0.5 text-warning shrink-0\" />\n                  <p className=\"text-sm text-muted-foreground leading-relaxed\">\n                    Dit is een oud Deal-record van vóór Preferred bidder / exclusiviteit. De gekoppelde relatie kan verkoper, aanbieder of een oude kandidaatkoppeling zijn en wordt niet als koper geïnterpreteerd.\n                  </p>\n                </div>\n              )}\n\n              <Sectie titel=\"Koppelingen\">\n",
    'DealForm legacy warning',
)
write(path, s)


# ---------------------------------------------------------------------------
# Deals list: zichtbare fase = Object Pipeline, oude fasefilter verdwijnt.
# ---------------------------------------------------------------------------
path = 'src/pages/DealsPage.tsx'
s = read(path)
s = replace_once(s, "import { DealFaseBadge } from '@/components/StatusBadges';", "import TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';", 'DealsPage badge import')
s = replace_once(
    s,
    "import { smartDealCompare, getDealGewogenCommissie } from '@/lib/sorting/urgency';\n",
    "import { getPreferredBidderStage, getTrajectoryProbability, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
    'DealsPage trajectory import',
)
s = replace_once(
    s,
    "const faseOptions: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen'];\n\n",
    '',
    'DealsPage legacy options',
)
s = replace_once(
    s,
    "  const { deals, getRelatieById, getObjectById, contactpersonen, unarchiveDeal, contactMoments } = useDataStore();",
    "  const { deals, getRelatieById, getObjectById, contactpersonen, unarchiveDeal, contactMoments, getDefaultObjectPipeline, getStagesVoorPipeline } = useDataStore();",
    'DealsPage store destructure',
)
s = replace_once(
    s,
    "  const [faseFilter, setFaseFilter] = useState<DealFase | ''>(initialView.faseFilter);",
    "  const [faseFilter] = useState<DealFase | ''>('');",
    'DealsPage legacy filter state',
)
s = replace_once(
    s,
    "  const [formOpen, setFormOpen] = useState(false);\n\n  useEffect(() => {",
    "  const [formOpen, setFormOpen] = useState(false);\n  const defaultPipeline = getDefaultObjectPipeline();\n  const pipelineStages = defaultPipeline ? getStagesVoorPipeline(defaultPipeline.id) : [];\n  const preferredBidderStage = getPreferredBidderStage(pipelineStages);\n  const stageForDeal = (deal: Deal) => getTrajectoryStage(getObjectById(deal.objectId), pipelineStages);\n  const stageOrderForDeal = (deal: Deal) => stageForDeal(deal)?.sortOrder ?? 0;\n  const weightedFeeForDeal = (deal: Deal) => (deal.commissieBedrag ?? 0) * getTrajectoryProbability(stageForDeal(deal));\n  const concreteForDeal = (deal: Deal) => isConcreteTransactionPosition(stageForDeal(deal), preferredBidderStage);\n\n  useEffect(() => {",
    'DealsPage stage helpers',
)
# Sortering mag geen deal.fase meer gebruiken.
s = replace_once(s, "      { value: 'slim', label: 'Slimme volgorde', compare: smartDealCompare() },", "      { value: 'slim', label: 'Slimme volgorde', compare: combine(byNumber<Deal>(stageOrderForDeal, 'desc'), byDate<Deal>(d => d.datumFollowUp, 'asc')) },", 'DealsPage smart sort')
s = replace_once(s, "      { value: 'gewogen', label: 'Gewogen commissie hoog-laag', compare: byNumber<Deal>(d => getDealGewogenCommissie(d), 'desc') },", "      { value: 'gewogen', label: 'Gewogen commissie hoog-laag', compare: byNumber<Deal>(weightedFeeForDeal, 'desc') },", 'DealsPage weighted sort')
s = replace_once(s, "      { value: 'fase', label: 'Fase', compare: combine(byString<Deal>(d => d.fase), byDate<Deal>(d => d.datumFollowUp, 'asc')) },", "      { value: 'fase', label: 'Trajectfase', compare: combine(byNumber<Deal>(stageOrderForDeal, 'desc'), byDate<Deal>(d => d.datumFollowUp, 'asc')) },", 'DealsPage stage sort')
s = replace_once(s, "      { value: 'status', label: 'Status', compare: combine((a, b) => Number(!!a.isArchived) - Number(!!b.isArchived), byString<Deal>(d => d.fase)) },", "      { value: 'status', label: 'Status', compare: combine((a, b) => Number(!!a.isArchived) - Number(!!b.isArchived), byNumber<Deal>(stageOrderForDeal, 'desc')) },", 'DealsPage status sort')
s = replace_once(
    s,
    "      const matchFase = !faseFilter || d.fase === faseFilter;\n      return matchZoek && matchFase;",
    "      return matchZoek;",
    'DealsPage legacy filtering',
)
# Verwijder zichtbare oude fasefilter.
s = replace_once(
    s,
    "        <select className=\"h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground\" value={faseFilter} onChange={e => setFaseFilter(e.target.value as DealFase | '')}>\n          <option value=\"\">Alle fases</option>\n          {faseOptions.map(f => <option key={f} value={f} className=\"capitalize\">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}\n        </select>\n",
    '',
    'DealsPage phase select',
)
s = replace_all_checked(s, '<DealFaseBadge fase={deal.fase} />', '<TrajectoryStageBadge objectId={deal.objectId} />', 2, 'DealsPage phase badges')
s = replace_once(s, '<th className="text-left px-5 py-3 field-label">Fase</th>', '<th className="text-left px-5 py-3 field-label">Trajectfase</th>', 'DealsPage table heading')
# Maak legacy zichtbaar zonder hem als koper/transactie te claimen.
s = replace_all_checked(
    s,
    '<TrajectoryStageBadge objectId={deal.objectId} />',
    "<TrajectoryStageBadge objectId={deal.objectId} />\n                      {!concreteForDeal(deal) && !deal.isArchived && <span className=\"text-[10px] font-semibold text-warning border border-warning/30 bg-warning/10 rounded-full px-1.5 py-0.5\">Legacy</span>}",
    2,
    'DealsPage legacy chips',
)
write(path, s)


# ---------------------------------------------------------------------------
# Dashboard: Object Pipeline bepaalt momentum, concrete Deal-count en weging.
# ---------------------------------------------------------------------------
path = 'src/pages/DashboardPage.tsx'
s = read(path)
s = s.replace('  FASE_KANS,\n', '')
s = s.replace('  DEAL_FASE_LABELS,\n', '')
s = replace_once(s, "import type { DealFase, Taak } from '@/data/mock-data';", "import type { Taak } from '@/data/mock-data';", 'Dashboard type import')
s = replace_once(
    s,
    "  DealFaseBadge,\n",
    '',
    'Dashboard DealFaseBadge import',
)
s = replace_once(
    s,
    "import PageHeader from '@/components/PageHeader';\n",
    "import PageHeader from '@/components/PageHeader';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { getPreferredBidderStage, getTrajectoryProbability, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
    'Dashboard trajectory imports',
)
# Verwijder oude vaste Deal-fases.
start = s.index('/* ------------------------------------------------------------------ */\n/* Pipeline stages (operationele dealflow)')
end_marker = '/* ------------------------------------------------------------------ */\n/* Main page'
end = s.index(end_marker, start)
s = s[:start] + end_marker + s[end + len(end_marker):]
# Voeg Object Pipeline context toe na actieve deals.
s = replace_once(
    s,
    "  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);\n  const actieveDeals    = useMemo(() => deals.filter(isDealActief), [deals]);",
    "  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);\n  const actieveDeals    = useMemo(() => deals.filter(isDealActief), [deals]);\n  const defaultPipeline = store.getDefaultObjectPipeline();\n  const pipelineStages = defaultPipeline\n    ? store.getStagesVoorPipeline(defaultPipeline.id).filter(stage => stage.isActive && !stage.isLost)\n    : [];\n  const preferredBidderStage = getPreferredBidderStage(pipelineStages);\n  const stageForObject = (objectId: string) => getTrajectoryStage(store.getObjectById(objectId), pipelineStages);\n  const concreteDeals = useMemo(\n    () => actieveDeals.filter(deal => isConcreteTransactionPosition(stageForObject(deal.objectId), preferredBidderStage)),\n    [actieveDeals, objecten, pipelineStages],\n  );",
    'Dashboard pipeline context',
)
# Oude closingDeals volledig weg; hij gebruikt oude Deal-fase.
s = replace_once(
    s,
    "  const closingDeals = useMemo(\n    () => actieveDeals.filter(d => d.fase === 'bieding' || d.fase === 'onderhandeling' || d.fase === 'closing'),\n    [actieveDeals],\n  );\n\n",
    '',
    'Dashboard closing legacy',
)
# Vervang hele pipelineberekening.
old = """  const pipelinePerFase = useMemo(() => {
    return pipelineFases.map(fase => {
      const facetDeals = actieveDeals.filter(d => d.fase === fase);
      const waarde = facetDeals.reduce((s, d) => s + (store.getObjectById(d.objectId)?.vraagprijs ?? 0), 0);
      const fee = facetDeals.reduce((s, d) => s + (d.commissieBedrag ?? 0), 0);
      const gewogen = fee * FASE_KANS[fase];
      return { fase, aantal: facetDeals.length, waarde, fee, gewogen };
    });
  }, [actieveDeals, store]);
  const totaalActieveDeals = pipelinePerFase.reduce((s, x) => s + x.aantal, 0) || 1;
  const maxAantal = Math.max(1, ...pipelinePerFase.map(x => x.aantal));
  const maxGewogen = Math.max(0, ...pipelinePerFase.map(x => x.gewogen));
"""
new = """  const pipelinePerFase = useMemo(() => {
    const feeByObject = new Map(unifiedFees.rows.map(row => [row.objectId, row.pipelineFee]));
    return pipelineStages
      .map(stage => {
        const faseObjecten = actieveObjecten.filter(object => object.pipelineStageId === stage.id);
        const waarde = faseObjecten.reduce((som, object) => som + (object.vraagprijs ?? 0), 0);
        const fee = faseObjecten.reduce((som, object) => som + (feeByObject.get(object.id) ?? 0), 0);
        const gewogen = fee * getTrajectoryProbability(stage);
        return { stage, aantal: faseObjecten.length, waarde, fee, gewogen };
      })
      .filter(item => item.aantal > 0);
  }, [actieveObjecten, pipelineStages, unifiedFees.rows]);
  const totaalActieveObjecten = pipelinePerFase.reduce((som, item) => som + item.aantal, 0) || 1;
  const maxAantal = Math.max(1, ...pipelinePerFase.map(item => item.aantal));
  const maxGewogen = Math.max(0, ...pipelinePerFase.map(item => item.gewogen));
"""
s = replace_once(s, old, new, 'Dashboard pipeline calculation')
# Forecast alleen concrete Deals en Object-kans.
s = replace_once(s, '    for (const d of actieveDeals) {', '    for (const d of concreteDeals) {', 'Dashboard forecast deals')
s = replace_once(s, '      const gewogen = d.commissieBedrag * FASE_KANS[d.fase];', '      const gewogen = d.commissieBedrag * getTrajectoryProbability(stageForObject(d.objectId));', 'Dashboard forecast probability')
s = replace_once(s, '  }, [actieveDeals, nu]);', '  }, [concreteDeals, nu, pipelineStages]);', 'Dashboard forecast deps')
# Top deals op Objectfase, niet deal.fase.
old = """  const topDeals = useMemo(() => {
    const fasePrio: Record<DealFase, number> = {
      closing: 0, onderhandeling: 1, bieding: 2, bezichtiging: 3,
      interesse: 4, introductie: 5, lead: 6, afgerond: 9, afgevallen: 9,
    };
    return [...actieveDeals].sort((a, b) => (fasePrio[a.fase] ?? 9) - (fasePrio[b.fase] ?? 9)).slice(0, 6);
  }, [actieveDeals]);
"""
new = """  const topDeals = useMemo(() => {
    return [...concreteDeals]
      .sort((a, b) => (stageForObject(b.objectId)?.sortOrder ?? 0) - (stageForObject(a.objectId)?.sortOrder ?? 0))
      .slice(0, 6);
  }, [concreteDeals, pipelineStages]);
"""
s = replace_once(s, old, new, 'Dashboard top deals')
s = replace_once(
    s,
    "  const objectenZonderKandidaten = actieveObjecten.filter(o => !o.isArchived).filter(o => !deals.some(d => d.objectId === o.id && isDealActief(d))).length;",
    "  const objectenZonderKandidaten = actieveObjecten.filter(object => !store.pipelineKandidaten.some(kandidaat => kandidaat.objectId === object.id)).length;",
    'Dashboard objects without candidates',
)
s = replace_once(s, '  const dealsZonderActiviteit = actieveDeals.filter(d => {', '  const dealsZonderActiviteit = concreteDeals.filter(d => {', 'Dashboard stagnation concrete')
# Hero concrete Deals count.
s = replace_once(s, '>{actieveDeals.length}</p>', '>{concreteDeals.length}</p>', 'Dashboard concrete deal count')
# Pipeline header/link.
s = replace_once(s, 'Pipeline momentum</h2>', 'Object Pipeline momentum</h2>', 'Dashboard pipeline title')
s = replace_once(s, 'Live overzicht van transactiefases — klik voor detail', 'Live overzicht van de enige commerciële trajectfase — klik voor Pipeline', 'Dashboard pipeline subtitle')
s = replace_once(s, '<Link to="/deals" className="section-link inline-flex items-center gap-1 group">Alle deals', '<Link to="/pipeline" className="section-link inline-flex items-center gap-1 group">Naar Pipeline', 'Dashboard pipeline link')
# Desktop pipeline render: stage in plaats van fase.
s = replace_once(s, '            {pipelinePerFase.map(({ fase, aantal, waarde, gewogen }, idx) => {', '            {pipelinePerFase.map(({ stage, aantal, waarde, gewogen }, idx) => {', 'Dashboard desktop map')
s = s.replace('(aantal / totaalActieveDeals)', '(aantal / totaalActieveObjecten)')
s = replace_once(
    s,
    '                <Link key={fase} to={`/deals?fase=${fase}`} className={`pipeline-stage rounded-sm ${isFirst ? \'chevron-step-first\' : isLast ? \'chevron-step-last\' : \'chevron-step\'} ${isHotspot ? \'pipeline-stage--active\' : \'\'}`} style={{ backgroundColor: `hsl(var(--accent) / ${intensity})` }} title={`${DEAL_FASE_LABELS[fase]}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)`}>",
    '',
    'placeholder impossible',
) if False else s
# Gebruik gerichte eenvoudige tekstvervangingen voor de JSX-regel.
s = s.replace('key={fase} to={`/deals?fase=${fase}`}', 'key={stage.id} to="/pipeline"')
s = s.replace('title={`${DEAL_FASE_LABELS[fase]}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)}`}', 'title={`${stage.name}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)}`}')
s = s.replace('{DEAL_FASE_LABELS[fase]}</p>', '{stage.name}</p>')
# Mobile map.
s = replace_once(s, '            {pipelinePerFase.map(({ fase, aantal, waarde }) => {', '            {pipelinePerFase.map(({ stage, aantal, waarde }, idx) => {', 'Dashboard mobile map')
s = s.replace('const intensity = 0.04 + (pipelineFases.indexOf(fase) / Math.max(1, pipelineFases.length - 1)) * 0.14;', 'const intensity = 0.04 + (idx / Math.max(1, pipelinePerFase.length - 1)) * 0.14;')
s = s.replace('key={fase} to={`/deals?fase=${fase}`}', 'key={stage.id} to="/pipeline"')
s = s.replace('{DEAL_FASE_LABELS[fase]}</p>', '{stage.name}</p>')
s = s.replace('<span className="text-[10px] text-muted-foreground">deals · {pct}%</span>', '<span className="text-[10px] text-muted-foreground">objecten · {pct}%</span>')
# Concrete transacties section.
s = replace_once(s, '<h2 className="section-title">Actieve deals</h2><p className="text-[11px] text-muted-foreground mt-0.5">{topDeals.length} van {actieveDeals.length} — meest gevorderd</p>', '<h2 className="section-title">Concrete transacties</h2><p className="text-[11px] text-muted-foreground mt-0.5">{topDeals.length} van {concreteDeals.length} — vanaf Preferred bidder / exclusiviteit</p>', 'Dashboard concrete section title')
s = replace_once(s, '<DealFaseBadge fase={deal.fase} />', '<TrajectoryStageBadge objectId={deal.objectId} />', 'Dashboard top deal badge')
s = replace_once(s, 'Geen actieve deals.</p>', 'Geen concrete transacties. Kandidaten vóór Preferred bidder staan op het Object.</p>', 'Dashboard empty deals')
write(path, s)

print('Codemod toegepast.')
