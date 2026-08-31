from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def one(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: verwacht 1 match, kreeg {count}")
    return content.replace(old, new, 1)


def alln(content: str, old: str, new: str, expected: int, label: str) -> str:
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: verwacht {expected} matches, kreeg {count}")
    return content.replace(old, new)


# --- DealDetailPage ---------------------------------------------------------
path = 'src/pages/DealDetailPage.tsx'
s = read(path)
s = s.replace('  DEAL_FASE_LABELS,\n', '')
s = s.replace('  FASE_KANS,\n', '')
s = one(s,
    "import { DealFaseBadge, LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';",
    "import { LeadStatusBadge, ObjectStatusBadge } from '@/components/StatusBadges';",
    'detail badge import')
s = one(s,
    "import DealKandidatenSectie from '@/components/deal/DealKandidatenSectie';\n",
    '',
    'detail candidates import')
s = one(s,
    "import { getListNavigation } from '@/lib/listNavigation';\n",
    "import { getListNavigation } from '@/lib/listNavigation';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { useObjectTrajectoryStage } from '@/hooks/useObjectTrajectoryStage';\n",
    'detail trajectory imports')
s = one(s,
    "  const object = store.getObjectById(deal.objectId);\n  const isAfgerond = deal.fase === 'afgerond';\n  const isAfgevallen = deal.fase === 'afgevallen';\n  const gewogenCommissie = deal.commissieBedrag != null\n    ? deal.commissieBedrag * (FASE_KANS[deal.fase] ?? 0)\n    : null;",
    "  const object = store.getObjectById(deal.objectId);\n  const { stage: trajectfase, probability: trajectKans, isTransactionPosition } = useObjectTrajectoryStage(deal.objectId);\n  const isAfgerond = deal.fase === 'afgerond';\n  const isAfgevallen = deal.fase === 'afgevallen';\n  const legacyRelatieIsEigenaar = Boolean(object?.eigenaarRelatieId && deal.relatieId === object.eigenaarRelatieId);\n  const gewogenCommissie = deal.commissieBedrag != null\n    ? deal.commissieBedrag * trajectKans\n    : null;",
    'detail canonical state')
s = one(s,
    '            <DealFaseBadge fase={deal.fase} />',
    '            <TrajectoryStageBadge objectId={deal.objectId} showIcon />',
    'detail header stage')
s = one(s,
    '              <Field label="Dealfase">{DEAL_FASE_LABELS[deal.fase]}</Field>',
    '              <Field label="Trajectfase">{trajectfase?.name ?? \'Niet ingesteld\'}</Field>',
    'detail phase field')
s = one(s,
    '                      Gewogen ({Math.round((FASE_KANS[deal.fase] ?? 0) * 100)}%)',
    '                      Gewogen ({Math.round(trajectKans * 100)}%)',
    'detail weighted stage')
s = one(s,
    '          <DealKandidatenSectie dealId={deal.id} primaireRelatieId={deal.relatieId} />\n',
    '',
    'detail remove candidates')
s = one(s,
    '            defaults={{ dealId: deal.id, objectId: deal.objectId, relatieId: deal.relatieId }}',
    '            defaults={{ dealId: deal.id, objectId: deal.objectId, relatieId: isTransactionPosition ? deal.relatieId : undefined }}',
    'detail bidder defaults')
s = one(s,
    '                  <UsersIcon className="h-4 w-4 text-muted-foreground" /> Primaire relatie',
    "                  <UsersIcon className=\"h-4 w-4 text-muted-foreground\" /> {isTransactionPosition ? 'Koper / preferred bidder' : legacyRelatieIsEigenaar ? 'Verkoper / eigenaar · legacy' : 'Oude Deal-relatie · legacy'}",
    'detail party heading')
s = one(s,
    "                {relatie.investeerderSubtype && (\n                  <p className=\"text-xs text-muted-foreground capitalize mt-1\">{relatie.investeerderSubtype.replace('_', ' ')}</p>\n                )}\n              </div>",
    "                {relatie.investeerderSubtype && (\n                  <p className=\"text-xs text-muted-foreground capitalize mt-1\">{relatie.investeerderSubtype.replace('_', ' ')}</p>\n                )}\n                {!isTransactionPosition && (\n                  <p className=\"text-xs text-warning mt-2 leading-relaxed\">\n                    Oude Deal-koppeling; niet leidend voor koper of traject. Kandidaten en voortgang worden via het Object beheerd.\n                  </p>\n                )}\n              </div>",
    'detail party note')
s = one(s,
    '      {/* Banner: gefeliciteerd of afgevallen */}\n',
    "      {!isTransactionPosition && !isAfgerond && !isAfgevallen && (\n        <div className=\"bg-warning/8 border border-warning/30 rounded-md p-4 flex items-start gap-3\">\n          <AlertCircle className=\"h-5 w-5 text-warning shrink-0 mt-0.5\" />\n          <div className=\"flex-1\">\n            <p className=\"font-semibold text-foreground\">Legacy Deal-record</p>\n            <p className=\"text-sm text-muted-foreground mt-0.5\">\n              Dit record komt uit het oude model. De Object Pipeline is leidend; deze relatie is niet automatisch de koper.\n            </p>\n          </div>\n        </div>\n      )}\n\n      {/* Banner: gefeliciteerd of afgevallen */}\n",
    'detail legacy banner')
write(path, s)


# --- DealFormDialog ---------------------------------------------------------
path = 'src/components/forms/DealFormDialog.tsx'
s = read(path)
s = one(s,
    "  const pipelineProbability = currentObjectStage?.probability != null\n    ? currentObjectStage.probability / 100\n    : 0;",
    "  const pipelineProbability = currentObjectStage?.probability != null\n    ? currentObjectStage.probability / 100\n    : 0;\n  const isConcreteTransactionPosition = Boolean(\n    currentObjectStage && preferredBidderStage && (\n      currentObjectStage.isWon || currentObjectStage.isLost || currentObjectStage.sortOrder >= preferredBidderStage.sortOrder\n    ),\n  );\n  const relatieLabel = isEdit && !isConcreteTransactionPosition\n    ? 'Legacy relatie (oude Deal) *'\n    : 'Preferred bidder / koper *';",
    'form position semantics')
s = one(s,
    '                    label="Preferred bidder / koper *"',
    '                    label={relatieLabel}',
    'form relation label')
s = one(s,
    '              <Sectie titel="Koppelingen">\n',
    "              {isEdit && !isConcreteTransactionPosition && (\n                <div className=\"p-3 bg-warning/8 border border-warning/30 rounded-md flex items-start gap-2\">\n                  <AlertTriangle className=\"h-4 w-4 mt-0.5 text-warning shrink-0\" />\n                  <p className=\"text-sm text-muted-foreground leading-relaxed\">\n                    Dit is een oud Deal-record van vóór Preferred bidder / exclusiviteit. De gekoppelde relatie kan verkoper, aanbieder of een oude kandidaatkoppeling zijn en wordt niet als koper geïnterpreteerd.\n                  </p>\n                </div>\n              )}\n\n              <Sectie titel=\"Koppelingen\">\n",
    'form legacy warning')
write(path, s)


# --- DealsPage --------------------------------------------------------------
path = 'src/pages/DealsPage.tsx'
s = read(path)
s = one(s,
    "import { DealFaseBadge } from '@/components/StatusBadges';",
    "import TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';",
    'list stage badge import')
s = one(s,
    "import { smartDealCompare, getDealGewogenCommissie } from '@/lib/sorting/urgency';\n",
    "import { getPreferredBidderStage, getTrajectoryProbability, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
    'list trajectory helpers')
s = one(s,
    "const faseOptions: DealFase[] = ['lead', 'introductie', 'interesse', 'bezichtiging', 'bieding', 'onderhandeling', 'closing', 'afgerond', 'afgevallen'];\n\n",
    '',
    'list legacy options')
s = one(s,
    "  const { deals, getRelatieById, getObjectById, contactpersonen, unarchiveDeal, contactMoments } = useDataStore();",
    "  const { deals, getRelatieById, getObjectById, contactpersonen, unarchiveDeal, contactMoments, getDefaultObjectPipeline, getStagesVoorPipeline } = useDataStore();",
    'list store')
s = one(s,
    "  const [faseFilter, setFaseFilter] = useState<DealFase | ''>(initialView.faseFilter);",
    "  const [faseFilter] = useState<DealFase | ''>('');",
    'list legacy state')
s = one(s,
    "  const [formOpen, setFormOpen] = useState(false);\n\n  useEffect(() => {",
    "  const [formOpen, setFormOpen] = useState(false);\n  const defaultPipeline = getDefaultObjectPipeline();\n  const pipelineStages = defaultPipeline ? getStagesVoorPipeline(defaultPipeline.id) : [];\n  const preferredBidderStage = getPreferredBidderStage(pipelineStages);\n  const stageForDeal = (deal: Deal) => getTrajectoryStage(getObjectById(deal.objectId), pipelineStages);\n  const stageOrderForDeal = (deal: Deal) => stageForDeal(deal)?.sortOrder ?? 0;\n  const weightedFeeForDeal = (deal: Deal) => (deal.commissieBedrag ?? 0) * getTrajectoryProbability(stageForDeal(deal));\n  const concreteForDeal = (deal: Deal) => isConcreteTransactionPosition(stageForDeal(deal), preferredBidderStage);\n\n  useEffect(() => {",
    'list trajectory context')
s = one(s,
    "      { value: 'slim', label: 'Slimme volgorde', compare: smartDealCompare() },",
    "      { value: 'slim', label: 'Slimme volgorde', compare: combine(byNumber<Deal>(stageOrderForDeal, 'desc'), byDate<Deal>(d => d.datumFollowUp, 'asc')) },",
    'list smart sort')
s = one(s,
    "      { value: 'gewogen', label: 'Gewogen commissie hoog-laag', compare: byNumber<Deal>(d => getDealGewogenCommissie(d), 'desc') },",
    "      { value: 'gewogen', label: 'Gewogen commissie hoog-laag', compare: byNumber<Deal>(weightedFeeForDeal, 'desc') },",
    'list weighted sort')
s = one(s,
    "      { value: 'fase', label: 'Fase', compare: combine(byString<Deal>(d => d.fase), byDate<Deal>(d => d.datumFollowUp, 'asc')) },",
    "      { value: 'fase', label: 'Trajectfase', compare: combine(byNumber<Deal>(stageOrderForDeal, 'desc'), byDate<Deal>(d => d.datumFollowUp, 'asc')) },",
    'list stage sort')
s = one(s,
    "      { value: 'status', label: 'Status', compare: combine((a, b) => Number(!!a.isArchived) - Number(!!b.isArchived), byString<Deal>(d => d.fase)) },",
    "      { value: 'status', label: 'Status', compare: combine((a, b) => Number(!!a.isArchived) - Number(!!b.isArchived), byNumber<Deal>(stageOrderForDeal, 'desc')) },",
    'list status sort')
s = one(s,
    "      const matchFase = !faseFilter || d.fase === faseFilter;\n      return matchZoek && matchFase;",
    "      return matchZoek;",
    'list phase filter logic')
s = one(s,
    "        <select className=\"h-10 px-3 rounded-md border border-input bg-card text-sm text-foreground\" value={faseFilter} onChange={e => setFaseFilter(e.target.value as DealFase | '')}>\n          <option value=\"\">Alle fases</option>\n          {faseOptions.map(f => <option key={f} value={f} className=\"capitalize\">{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}\n        </select>\n",
    '',
    'list phase select')
s = alln(s,
    '<DealFaseBadge fase={deal.fase} />',
    "<TrajectoryStageBadge objectId={deal.objectId} />\n                      {!concreteForDeal(deal) && !deal.isArchived && <span className=\"text-[10px] font-semibold text-warning border border-warning/30 bg-warning/10 rounded-full px-1.5 py-0.5\">Legacy</span>}",
    2,
    'list phase badges')
s = one(s,
    '<th className="text-left px-5 py-3 field-label">Fase</th>',
    '<th className="text-left px-5 py-3 field-label">Trajectfase</th>',
    'list heading')
write(path, s)

print('Core trajectory codemod applied')
