from pathlib import Path


def read(path): return Path(path).read_text()
def write(path, s): Path(path).write_text(s)

def one(s, old, new, label):
    n=s.count(old)
    if n!=1: raise RuntimeError(f'{label}: verwacht 1, kreeg {n}')
    return s.replace(old,new,1)

# DealDetail hook order + legacy subtitle
p='src/pages/DealDetailPage.tsx'; s=read(p)
s=one(s,
"  const deal = store.getDealById(id!);\n  const [editOpen, setEditOpen] = useState(false);",
"  const deal = store.getDealById(id!);\n  const trajectory = useObjectTrajectoryStage(deal?.objectId);\n  const [editOpen, setEditOpen] = useState(false);",
'detail hook order 1')
s=one(s,
"  const object = store.getObjectById(deal.objectId);\n  const { stage: trajectfase, probability: trajectKans, isTransactionPosition } = useObjectTrajectoryStage(deal.objectId);",
"  const object = store.getObjectById(deal.objectId);\n  const { stage: trajectfase, probability: trajectKans, isTransactionPosition } = trajectory;",
'detail hook order 2')
s=one(s,
"            {relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : '—'} · {object?.plaats}",
"            {isTransactionPosition && relatie ? getRelatieNaamCompact(relatie, store.contactpersonen) : 'Legacy Deal-record'} · {object?.plaats}",
'detail subtitle')
write(p,s)

# DealsPage: legacy telt niet als actief, blijft onder Alles; relation header neutraler
p='src/pages/DealsPage.tsx'; s=read(p)
s=one(s,
"  const aantalArchief = deals.filter(d => d.isArchived).length;\n  const aantalActief = deals.length - aantalArchief;",
"  const aantalArchief = deals.filter(d => d.isArchived).length;\n  const aantalLegacy = deals.filter(d => !d.isArchived && !concreteForDeal(d)).length;\n  const aantalActief = deals.filter(d => !d.isArchived && concreteForDeal(d)).length;",
'list counts')
s=one(s,
"      if (archiefView === 'actief' && d.isArchived) return false;\n      if (archiefView === 'archief' && !d.isArchived) return false;",
"      if (archiefView === 'actief' && (d.isArchived || !concreteForDeal(d))) return false;\n      if (archiefView === 'archief' && !d.isArchived) return false;",
'list active filter')
s=one(s,
"        subtitle={`${aantalActief} actief · ${aantalArchief} gearchiveerd`}",
"        subtitle={`${aantalActief} concrete transacties · ${aantalLegacy} legacy · ${aantalArchief} gearchiveerd`}",
'list subtitle')
s=one(s,
'<th className="text-left px-5 py-3 field-label">Relatie</th>',
'<th className="text-left px-5 py-3 field-label">Partij</th>',
'list party header')
s=s.replace("<p className=\"text-xs text-muted-foreground mt-0.5 truncate\">{getRelatieNaamCompact(rel, contactpersonen)} · {obj?.plaats}</p>",
"<p className=\"text-xs text-muted-foreground mt-0.5 truncate\">{concreteForDeal(deal) ? getRelatieNaamCompact(rel, contactpersonen) : `Legacy partij · ${getRelatieNaamCompact(rel, contactpersonen)}`} · {obj?.plaats}</p>")
s=s.replace('<td className="px-5 py-3.5 text-foreground truncate max-w-[200px]">{getRelatieNaamCompact(rel, contactpersonen)}</td>',
'<td className="px-5 py-3.5 text-foreground truncate max-w-[200px]">{concreteForDeal(deal) ? getRelatieNaamCompact(rel, contactpersonen) : <>Legacy · {getRelatieNaamCompact(rel, contactpersonen)}</>}</td>')
s=one(s,
"  }, [contactMoments, getObjectById]);",
"  }, [contactMoments, getObjectById, pipelineStages]);",
'list sort deps')
write(p,s)

# ObjectDetail: oude lead deal alleen nog concrete deal na transactiedrempel; badge = Object Pipeline
p='src/pages/ObjectDetailPage.tsx'; s=read(p)
s=s.replace('  selectLeadDeal,\n  calculateExpectedFee,\n','')
s=one(s,
"import { ObjectStatusBadge, DealFaseBadge, MatchScoreBadge } from '@/components/StatusBadges';",
"import { ObjectStatusBadge, MatchScoreBadge } from '@/components/StatusBadges';",
'object badge import')
s=one(s,
"import { getObjectIntegriteitVoorObject } from '@/lib/objecten/objectIntegriteit';\n",
"import { getObjectIntegriteitVoorObject } from '@/lib/objecten/objectIntegriteit';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { getPreferredBidderStage, getTrajectoryProbability, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
'object trajectory imports')
s=one(s,
"  // Lead deal voor cockpit — centrale selector (Prompt 3.6)\n  const leadDeal = selectLeadDeal(deals, object.id);\n  // Gewogen verwachte fee voor lead deal — centrale helper\n  const leadDealVerwachteFee = leadDeal ? calculateExpectedFee([leadDeal]) : 0;",
"  // Concrete Deal bestaat pas vanaf Preferred bidder / exclusiviteit.\n  // Oude Deal-rijen vóór die grens blijven historie en sturen de cockpit niet.\n  const defaultPipeline = store.getDefaultObjectPipeline();\n  const trajectoryStages = defaultPipeline ? store.getStagesVoorPipeline(defaultPipeline.id) : [];\n  const currentTrajectoryStage = getTrajectoryStage(object, trajectoryStages);\n  const preferredBidderStage = getPreferredBidderStage(trajectoryStages);\n  const hasTransactionPosition = isConcreteTransactionPosition(currentTrajectoryStage, preferredBidderStage);\n  const activeDealRecords = deals.filter(d => !d.isArchived && !d.softDeletedAt);\n  const leadDeal = hasTransactionPosition && activeDealRecords.length === 1 ? activeDealRecords[0] : null;\n  const leadDealVerwachteFee = leadDeal?.commissieBedrag != null\n    ? leadDeal.commissieBedrag * getTrajectoryProbability(currentTrajectoryStage)\n    : 0;",
'object concrete deal')
s=one(s,
"              {leadDeal && <DealFaseBadge fase={leadDeal.fase} />}",
"              <TrajectoryStageBadge objectId={object.id} />",
'object cockpit badge')
s=one(s,'                Deal cockpit','                Transactie cockpit','object cockpit title')
s=one(s,'                  <p className="field-label">Lead deal</p>','                  <p className="field-label">Koper / preferred bidder</p>','object cockpit party label')
s=one(s,
"                    <p className=\"field-label\">Deals</p>\n                    <p className=\"font-mono-data text-sm font-semibold mt-0.5\">{deals.length}</p>",
"                    <p className=\"field-label\">Concrete deals</p>\n                    <p className=\"font-mono-data text-sm font-semibold mt-0.5\">{leadDeal ? 1 : 0}</p>",
'object cockpit count')
# Fallbacktekst waar geen leadDeal is: voeg concrete uitleg toe door eerste generieke muted paragraph in fallback gericht te vervangen.
s=s.replace('Nog geen actieve deal gekoppeld.', 'Nog geen concrete Deal. Kandidaten en biedingen blijven op het Object tot Preferred bidder / exclusiviteit.')
write(p,s)

# RelatieDetail: alleen concrete Deals als Deal tonen; badge = Object Pipeline
p='src/pages/RelatieDetailPage.tsx'; s=read(p)
s=one(s,
"  LeadStatusBadge, DealFaseBadge, MatchScoreBadge, PrioriteitBadge,",
"  LeadStatusBadge, MatchScoreBadge, PrioriteitBadge,",
'relation badge import')
s=one(s,
"import { getListNavigation } from '@/lib/listNavigation';\n",
"import { getListNavigation } from '@/lib/listNavigation';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { getPreferredBidderStage, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
'relation trajectory imports')
s=one(s,
"  const deals = store.getDealsByRelatie(relatie.id);",
"  const allRelationDeals = store.getDealsByRelatie(relatie.id);\n  const defaultPipeline = store.getDefaultObjectPipeline();\n  const trajectoryStages = defaultPipeline ? store.getStagesVoorPipeline(defaultPipeline.id) : [];\n  const preferredBidderStage = getPreferredBidderStage(trajectoryStages);\n  const deals = allRelationDeals.filter(deal => {\n    if (deal.fase === 'afgerond' || deal.fase === 'afgevallen') return true;\n    const stage = getTrajectoryStage(store.getObjectById(deal.objectId), trajectoryStages);\n    return isConcreteTransactionPosition(stage, preferredBidderStage);\n  });",
'relation concrete deals')
s=s.replace('<DealFaseBadge fase={deal.fase} />','<TrajectoryStageBadge objectId={deal.objectId} />')
write(p,s)

# Dashboard: Object Pipeline als enige momentum/fasebron
p='src/pages/DashboardPage.tsx'; s=read(p)
s=s.replace('  FASE_KANS,\n','').replace('  DEAL_FASE_LABELS,\n','')
s=s.replace("import type { DealFase, Taak } from '@/data/mock-data';","import type { Taak } from '@/data/mock-data';")
s=s.replace('  DealFaseBadge,\n','')
s=one(s,
"import PageHeader from '@/components/PageHeader';\n",
"import PageHeader from '@/components/PageHeader';\nimport TrajectoryStageBadge from '@/components/pipeline/TrajectoryStageBadge';\nimport { getPreferredBidderStage, getTrajectoryProbability, getTrajectoryStage, isConcreteTransactionPosition } from '@/lib/lifecycle/trajectory';\n",
'dashboard trajectory imports')
old="""/* ------------------------------------------------------------------ */
/* Pipeline stages (operationele dealflow)                             */
/* ------------------------------------------------------------------ */

const pipelineFases: DealFase[] = [
  'lead',
  'introductie',
  'interesse',
  'bezichtiging',
  'bieding',
  'onderhandeling',
  'closing',
];

"""
if old not in s: raise RuntimeError('dashboard old pipeline const missing')
s=s.replace(old,'',1)
s=one(s,
"  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);\n  const actieveDeals    = useMemo(() => deals.filter(isDealActief), [deals]);",
"  const actieveObjecten = useMemo(() => objecten.filter(o => !o.isArchived), [objecten]);\n  const actieveDeals    = useMemo(() => deals.filter(isDealActief), [deals]);\n  const defaultPipeline = store.getDefaultObjectPipeline();\n  const pipelineStages = defaultPipeline\n    ? store.getStagesVoorPipeline(defaultPipeline.id).filter(stage => stage.isActive && !stage.isLost)\n    : [];\n  const preferredBidderStage = getPreferredBidderStage(pipelineStages);\n  const stageForObject = (objectId: string) => getTrajectoryStage(store.getObjectById(objectId), pipelineStages);\n  const concreteDeals = actieveDeals.filter(deal =>\n    isConcreteTransactionPosition(stageForObject(deal.objectId), preferredBidderStage)\n  );",
'dashboard context')
# verwijder ongebruikte legacy closingDeals
legacy="""  const closingDeals = useMemo(
    () => actieveDeals.filter(d => d.fase === 'bieding' || d.fase === 'onderhandeling' || d.fase === 'closing'),
    [actieveDeals],
  );

"""
s=s.replace(legacy,'')
old="""  const pipelinePerFase = useMemo(() => {
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
new="""  const feeByObject = new Map(unifiedFees.rows.map(row => [row.objectId, row.pipelineFee]));
  const pipelinePerFase = pipelineStages
    .map(stage => {
      const faseObjecten = actieveObjecten.filter(object => object.pipelineStageId === stage.id);
      const waarde = faseObjecten.reduce((som, object) => som + (object.vraagprijs ?? 0), 0);
      const fee = faseObjecten.reduce((som, object) => som + (feeByObject.get(object.id) ?? 0), 0);
      const gewogen = fee * getTrajectoryProbability(stage);
      return { stage, aantal: faseObjecten.length, waarde, fee, gewogen };
    })
    .filter(item => item.aantal > 0);
  const totaalActieveObjecten = pipelinePerFase.reduce((som, item) => som + item.aantal, 0) || 1;
  const maxAantal = Math.max(1, ...pipelinePerFase.map(item => item.aantal));
  const maxGewogen = Math.max(0, ...pipelinePerFase.map(item => item.gewogen));
"""
s=one(s,old,new,'dashboard pipeline calc')
s=one(s,'    for (const d of actieveDeals) {','    for (const d of concreteDeals) {','dashboard forecast deals')
s=one(s,'      const gewogen = d.commissieBedrag * FASE_KANS[d.fase];','      const gewogen = d.commissieBedrag * getTrajectoryProbability(stageForObject(d.objectId));','dashboard forecast weight')
s=one(s,'  }, [actieveDeals, nu]);','  }, [concreteDeals, nu, objecten]);','dashboard forecast deps')
old="""  const topDeals = useMemo(() => {
    const fasePrio: Record<DealFase, number> = {
      closing: 0, onderhandeling: 1, bieding: 2, bezichtiging: 3,
      interesse: 4, introductie: 5, lead: 6, afgerond: 9, afgevallen: 9,
    };
    return [...actieveDeals].sort((a, b) => (fasePrio[a.fase] ?? 9) - (fasePrio[b.fase] ?? 9)).slice(0, 6);
  }, [actieveDeals]);
"""
new="""  const topDeals = [...concreteDeals]
    .sort((a, b) => (stageForObject(b.objectId)?.sortOrder ?? 0) - (stageForObject(a.objectId)?.sortOrder ?? 0))
    .slice(0, 6);
"""
s=one(s,old,new,'dashboard top deals')
s=one(s,
"  const objectenZonderKandidaten = actieveObjecten.filter(o => !o.isArchived).filter(o => !deals.some(d => d.objectId === o.id && isDealActief(d))).length;",
"  const objectenZonderKandidaten = actieveObjecten.filter(object => !store.pipelineKandidaten.some(kandidaat => kandidaat.objectId === object.id)).length;",
'dashboard no candidates')
s=one(s,'  const dealsZonderActiviteit = actieveDeals.filter(d => {','  const dealsZonderActiviteit = concreteDeals.filter(d => {','dashboard stagnation')
s=one(s,'>{actieveDeals.length}</p>','>{concreteDeals.length}</p>','dashboard concrete count')
s=one(s,'Pipeline momentum</h2>','Object Pipeline momentum</h2>','dashboard title')
s=one(s,'Live overzicht van transactiefases — klik voor detail','Live overzicht van de enige commerciële trajectfase — klik voor Pipeline','dashboard subtitle')
s=one(s,'<Link to="/deals" className="section-link inline-flex items-center gap-1 group">Alle deals','<Link to="/pipeline" className="section-link inline-flex items-center gap-1 group">Naar Pipeline','dashboard link')
s=one(s,'            {pipelinePerFase.map(({ fase, aantal, waarde, gewogen }, idx) => {','            {pipelinePerFase.map(({ stage, aantal, waarde, gewogen }, idx) => {','dashboard desktop map')
s=s.replace('(aantal / totaalActieveDeals)', '(aantal / totaalActieveObjecten)')
s=s.replace('key={fase} to={`/deals?fase=${fase}`}', 'key={stage.id} to="/pipeline"')
s=s.replace('title={`${DEAL_FASE_LABELS[fase]}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)}`}', 'title={`${stage.name}: ${aantal} · ${formatCurrencyCompact(waarde)} · fee ${formatCurrencyCompact(gewogen)}`}')
s=s.replace('{DEAL_FASE_LABELS[fase]}</p>', '{stage.name}</p>')
s=one(s,'            {pipelinePerFase.map(({ fase, aantal, waarde }) => {','            {pipelinePerFase.map(({ stage, aantal, waarde }, idx) => {','dashboard mobile map')
s=s.replace('const intensity = 0.04 + (pipelineFases.indexOf(fase) / Math.max(1, pipelineFases.length - 1)) * 0.14;', 'const intensity = 0.04 + (idx / Math.max(1, pipelinePerFase.length - 1)) * 0.14;')
s=s.replace('<span className="text-[10px] text-muted-foreground">deals · {pct}%</span>','<span className="text-[10px] text-muted-foreground">objecten · {pct}%</span>')
s=one(s,'<h2 className="section-title">Actieve deals</h2><p className="text-[11px] text-muted-foreground mt-0.5">{topDeals.length} van {actieveDeals.length} — meest gevorderd</p>','<h2 className="section-title">Concrete transacties</h2><p className="text-[11px] text-muted-foreground mt-0.5">{topDeals.length} van {concreteDeals.length} — vanaf Preferred bidder / exclusiviteit</p>','dashboard concrete heading')
s=one(s,'<DealFaseBadge fase={deal.fase} />','<TrajectoryStageBadge objectId={deal.objectId} />','dashboard deal badge')
s=one(s,'Geen actieve deals.</p>','Geen concrete transacties. Kandidaten vóór Preferred bidder staan op het Object.</p>','dashboard empty')
write(p,s)

# Rapportage: huidige funnel op Object Pipeline; canonieke fee-pipeline
p='src/pages/RapportagePage.tsx'; s=read(p)
s=s.replace('  DEAL_FASE_LABELS,\n','').replace('  FASE_KANS,\n','')
s=s.replace("import type { Deal, DealFase } from '@/data/mock-data';","import type { Deal } from '@/data/mock-data';")
s=one(s,
"import { Link } from 'react-router-dom';\n\nconst FASE_VOLGORDE: DealFase[] = [\n  'lead', 'introductie', 'interesse', 'bezichtiging', 'bieding',\n  'onderhandeling', 'closing', 'afgerond',\n];\n",
"import { Link } from 'react-router-dom';\nimport { useUnifiedFeeReporting } from '@/hooks/useUnifiedFeeReporting';\nimport { getTrajectoryProbability, getTrajectoryStage } from '@/lib/lifecycle/trajectory';\n",
'report imports')
s=one(s,
"  const [jaar, setJaar] = useState(huidigJaar);",
"  const [jaar, setJaar] = useState(huidigJaar);\n  const unifiedFees = useUnifiedFeeReporting(jaar);\n  const defaultPipeline = store.getDefaultObjectPipeline();\n  const pipelineStages = defaultPipeline ? store.getStagesVoorPipeline(defaultPipeline.id) : [];",
'report pipeline context')
start=s.index('  // Conversie funnel - deals ooit in elke fase')
end=s.index('  // Top bronnen', start)
replacement="""  // Huidige Object Pipeline — de enige commerciële trajectfase.
  const funnel = useMemo(() => {
    const actieveObjecten = store.objecten.filter(object => !object.isArchived);
    return pipelineStages
      .filter(stage => stage.isActive && !stage.isLost)
      .map(stage => ({
        fase: stage.name,
        aantal: actieveObjecten.filter(object => object.pipelineStageId === stage.id).length,
      }))
      .filter(row => row.aantal > 0);
  }, [store.objecten, pipelineStages]);

  const pipelineBedragTotaal = unifiedFees.stats.pipelineBedrag;
  const pipelineBedragGewogen = unifiedFees.rows.reduce((som, row) => {
    const object = store.getObjectById(row.objectId);
    const stage = getTrajectoryStage(object, pipelineStages);
    return som + row.pipelineFee * getTrajectoryProbability(stage);
  }, 0);
  const pipelineAantalObjecten = unifiedFees.rows.filter(row => row.pipelineFee > 0).length;

"""
s=s[:start]+replacement+s[end:]
# KPI pipeline legacy stats vervangen
s=s.replace('value={formatCurrencyCompact(stats.pipelineBedragGewogen)}','value={formatCurrencyCompact(pipelineBedragGewogen)}')
s=s.replace('subtext={`${stats.pipelineAantalDeals} actief · totaal ${formatCurrencyCompact(stats.pipelineBedragTotaal)}`}', 'subtext={`${pipelineAantalObjecten} objecten · totaal ${formatCurrencyCompact(pipelineBedragTotaal)}`}')
# Conversie KPI is geen historische funnel meer, maak huidig momentum.
s=s.replace('label="Conversie funnel"','label="Object Pipeline"')
s=s.replace('value={`${conversiePct}%`}', 'value={`${funnel.length} actieve fases`}')
s=s.replace('subtext={`${funnel[0].aantal} leads → ${funnel[funnel.length - 1].aantal} closes`}', 'subtext={`${store.objecten.filter(object => !object.isArchived).length} actieve objecten`}')
# Verwijder conversiePct blok indien nog aanwezig
import re
s=re.sub(r"\n  const conversiePct = funnel\[0\]\.aantal > 0\n    \? Math\.round\(\(funnel\[funnel\.length - 1\]\.aantal / funnel\[0\]\.aantal\) \* 100\)\n    : 0;\n",'\n',s)
# Funnel sectietitels indien aanwezig
s=s.replace('Conversie funnel','Object Pipeline momentum')
write(p,s)

print('legacy deal phase codemod applied')
