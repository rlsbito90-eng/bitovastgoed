from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1. Centrale quickscan-navigatie: object + juiste quickscan + juiste anchor.
# ---------------------------------------------------------------------------
write(
    "src/lib/vastgoedrekenen/quickscanNavigation.ts",
    """export const QUICKSCAN_QUERY_PARAM = 'calculation';

export function buildQuickscanObjectHref(objectId: string, calculationId: string): string {
  return `/objecten/${encodeURIComponent(objectId)}?tab=vastgoedrekenen&${QUICKSCAN_QUERY_PARAM}=${encodeURIComponent(calculationId)}#vastgoedrekenen`;
}

export function readRequestedQuickscanId(search: string): string | null {
  return new URLSearchParams(search).get(QUICKSCAN_QUERY_PARAM);
}
""",
)

page_path = "src/pages/VastgoedrekenenPage.tsx"
page = read(page_path)
page = replace_once(
    page,
    "import type { Calculation } from '@/lib/vastgoedrekenen/types';",
    "import type { Calculation } from '@/lib/vastgoedrekenen/types';\nimport { buildQuickscanObjectHref } from '@/lib/vastgoedrekenen/quickscanNavigation';",
    "VastgoedrekenenPage import",
)
page = replace_once(
    page,
    '<div className="page-container space-y-6">',
    '<div className="page-shell">',
    "VastgoedrekenenPage shell",
)
page = replace_once(
    page,
    'to={`/objecten/${c.object_id}#vastgoedrekenen`}',
    'to={buildQuickscanObjectHref(c.object_id, c.id)}',
    "VastgoedrekenenPage quickscan href",
)
write(page_path, page)


# ---------------------------------------------------------------------------
# 2. Objecttab: geselecteerde quickscan uit URL respecteren en URL synchroon
#    houden wanneer een andere quickscan wordt gekozen of aangemaakt.
# ---------------------------------------------------------------------------
tab_path = "src/components/vastgoedrekenen/VastgoedrekenenTab.tsx"
tab = read(tab_path)
tab = replace_once(
    tab,
    "import { useState, type ReactNode } from 'react';",
    "import { useEffect, useState, type ReactNode } from 'react';\nimport { useLocation, useNavigate } from 'react-router-dom';",
    "VastgoedrekenenTab react imports",
)
tab = replace_once(
    tab,
    "  objectVraagprijs?: number | null;\n};",
    "  objectVraagprijs?: number | null;\n  initialCalculationId?: string | null;\n};",
    "VastgoedrekenenTab prop",
)
tab = replace_once(
    tab,
    "export default function VastgoedrekenenTab({ objectId, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, objectRawType, objectVraagprijs }: Props) {",
    "export default function VastgoedrekenenTab({ objectId, objectArea, objectWoz, objectEnergyLabel, objectBouwjaar, objectRawType, objectVraagprijs, initialCalculationId }: Props) {",
    "VastgoedrekenenTab signature",
)
tab = replace_once(
    tab,
    "  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();\n  const [activeId, setActiveId] = useState<string | null>(null);\n\n  const active = activeId ?? calculations[0]?.id ?? null;",
    """  const { viewMode, setViewMode } = useVastgoedrekenenPrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(initialCalculationId ?? null);

  useEffect(() => {
    if (initialCalculationId && calculations.some((calculation) => calculation.id === initialCalculationId)) {
      setActiveId(initialCalculationId);
      return;
    }
    setActiveId((current) => (
      current && calculations.some((calculation) => calculation.id === current)
        ? current
        : calculations[0]?.id ?? null
    ));
  }, [calculations, initialCalculationId]);

  const active = activeId ?? calculations[0]?.id ?? null;

  function selectQuickscan(id: string) {
    setActiveId(id);
    const params = new URLSearchParams(location.search);
    params.set('tab', 'vastgoedrekenen');
    params.set('calculation', id);
    navigate({
      pathname: location.pathname,
      search: `?${params.toString()}`,
      hash: '#vastgoedrekenen',
    }, { replace: true });
  }""",
    "VastgoedrekenenTab active selection",
)
tab = replace_once(
    tab,
    "<Button className=\"w-full sm:w-auto\" onClick={async () => { const c = await create({ calculation_name: `Quickscan ${calculations.length + 1}` }); if (c) setActiveId(c.id); }}>",
    "<Button className=\"w-full sm:w-auto\" onClick={async () => { const c = await create({ calculation_name: `Quickscan ${calculations.length + 1}` }); if (c) selectQuickscan(c.id); }}>",
    "VastgoedrekenenTab create selection",
)
tab = replace_once(
    tab,
    "<button key={c.id} onClick={() => setActiveId(c.id)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>",
    "<button key={c.id} onClick={() => selectQuickscan(c.id)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${active === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>",
    "VastgoedrekenenTab pill selection",
)
write(tab_path, tab)


# ---------------------------------------------------------------------------
# 3. Objectdetail: React Router als enige bron voor tab-/hashnavigatie.
#    Geen native replaceState meer dat URL en React-state uit elkaar trekt.
# ---------------------------------------------------------------------------
obj_path = "src/pages/ObjectDetailPage.tsx"
obj = read(obj_path)
obj = replace_once(
    obj,
    "import { useParams, Link, useNavigate } from 'react-router-dom';",
    "import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';",
    "ObjectDetail router import",
)
obj = replace_once(
    obj,
    "  const navigate = useNavigate();\n  const store = useDataStore();",
    "  const navigate = useNavigate();\n  const location = useLocation();\n  const store = useDataStore();",
    "ObjectDetail location",
)
obj = replace_once(
    obj,
    "  const [activeTab, setActiveTabState] = useState<WorkspaceTabId>(readInitialTab);\n\n  const setActiveTab = (id: WorkspaceTabId) => {\n    setActiveTabState(id);\n    try { window.localStorage.setItem(WORKSPACE_TAB_STORAGE_KEY, id); } catch { /* ignore */ }\n    try {\n      const url = new URL(window.location.href);\n      url.searchParams.set('tab', id);\n      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);\n    } catch { /* ignore */ }\n  };",
    """  const [activeTab, setActiveTabState] = useState<WorkspaceTabId>(readInitialTab);
  const requestedCalculationId = useMemo(
    () => new URLSearchParams(location.search).get('calculation'),
    [location.search],
  );

  const setActiveTab = (id: WorkspaceTabId) => {
    setActiveTabState(id);
    try { window.localStorage.setItem(WORKSPACE_TAB_STORAGE_KEY, id); } catch { /* ignore */ }
    const params = new URLSearchParams(location.search);
    params.set('tab', id);
    if (id !== 'vastgoedrekenen') params.delete('calculation');
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
      hash: '',
    }, { replace: true });
  };""",
    "ObjectDetail active tab navigation",
)
obj = replace_once(
    obj,
    "  }, [visibleTabs, activeTab]);\n\n  // Nummering alleen op hoofdworkspace-niveau",
    """  }, [visibleTabs, activeTab]);

  // Browser back/forward en externe deep-links blijven in sync met de zichtbare tab.
  useEffect(() => {
    const fromQuery = new URLSearchParams(location.search).get('tab');
    const fromHash = ANCHOR_TO_TAB[location.hash.replace(/^#/, '')];
    const requested = (fromQuery && WORKSPACE_TABS.some((tab) => tab.id === fromQuery)
      ? fromQuery
      : fromHash) as WorkspaceTabId | undefined;
    if (requested && requested !== activeTab && visibleTabs.some((tab) => tab.id === requested)) {
      setActiveTabState(requested);
    }
  }, [activeTab, location.hash, location.search, visibleTabs]);

  // Nummering alleen op hoofdworkspace-niveau""",
    "ObjectDetail location sync",
)
obj, count = re.subn(
    r"  const goToAnchor = \(anchorId: string\) => \{.*?\n  \};\n\n  const openDossierTab",
    """  const goToAnchor = (anchorId: string) => {
    const tab = ANCHOR_TO_TAB[anchorId];
    if (tab && tab !== activeTab) {
      setActiveTabState(tab);
      try { window.localStorage.setItem(WORKSPACE_TAB_STORAGE_KEY, tab); } catch { /* ignore */ }
    }

    const params = new URLSearchParams(location.search);
    if (tab) params.set('tab', tab);
    if (tab !== 'vastgoedrekenen') params.delete('calculation');
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : '',
      hash: `#${anchorId}`,
    }, { replace: true });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => performScroll(anchorId));
      setTimeout(() => performScroll(anchorId), 180);
      setTimeout(() => performScroll(anchorId), 420);
    });
  };

  const openDossierTab""",
    obj,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError(f"ObjectDetail goToAnchor: expected 1 match, found {count}")
obj = replace_once(
    obj,
    "        if (tab !== activeTab) setActiveTab(tab);",
    "        if (tab !== activeTab) setActiveTabState(tab);",
    "ObjectDetail hash state",
)
obj = replace_once(
    obj,
    "  // Bij eerste mount: als URL al een hash heeft, scroll ernaartoe na render\n  useEffect(() => {\n    const hash = window.location.hash.replace(/^#/, '');\n    if (hash && ANCHOR_TO_TAB[hash]) {\n      setTimeout(() => performScroll(hash), 120);\n    }\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, []);",
    """  // Deep-links scrollen pas nadat de juiste tabinhoud daadwerkelijk is gemount.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '');
    if (!hash || !ANCHOR_TO_TAB[hash]) return;
    const first = window.setTimeout(() => performScroll(hash), 140);
    const retry = window.setTimeout(() => performScroll(hash), 420);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, location.hash]);""",
    "ObjectDetail deep link scroll",
)
obj = replace_once(
    obj,
    "<VastgoedrekenenTab\n                  objectId={object.id}",
    "<VastgoedrekenenTab\n                  initialCalculationId={requestedCalculationId}\n                  objectId={object.id}",
    "ObjectDetail selected calculation prop",
)
write(obj_path, obj)


# ---------------------------------------------------------------------------
# 4. Globale scrollreset alleen bij een echte routewisseling. Search/hash binnen
#    dezelfde objectpagina mag de gerichte tab- of anchorscroll niet overrulen.
# ---------------------------------------------------------------------------
write(
    "src/components/ScrollToTop.tsx",
    """import { useEffect, useRef } from \"react\";
import { useLocation } from \"react-router-dom\";

const SCROLL_RESTORE_PAIRS: Array<[RegExp, RegExp]> = [
  [/^\\/off-market$/, /^\\/off-market\\/[^/]+$/],
];

function isOptOut(prev: string | null, next: string): boolean {
  if (!prev) return false;
  for (const [a, b] of SCROLL_RESTORE_PAIRS) {
    if ((a.test(prev) && b.test(next)) || (b.test(prev) && a.test(next))) return true;
  }
  return false;
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const previous = useRef<{ pathname: string; search: string; hash: string } | null>(null);

  useEffect(() => {
    const prior = previous.current;
    previous.current = { pathname, search, hash };

    // Tab- en quickscanselectie binnen dezelfde objectroute behouden hun positie.
    if (prior && prior.pathname === pathname) return;
    if (isOptOut(prior?.pathname ?? null, pathname)) return;

    // Een deep link regelt zijn eigen gerichte scroll nadat de inhoud is gemount.
    if (hash) return;

    window.scrollTo({ top: 0, left: 0, behavior: \"auto\" });
    const main = document.querySelector(\"main\");
    if (main) main.scrollTo({ top: 0, left: 0, behavior: \"auto\" });
  }, [hash, pathname, search]);

  return null;
}
""",
)


# ---------------------------------------------------------------------------
# 5. Scenariovergelijking: dezelfde children als de editor gebruiken en voor
#    ontwikkelscenario's de residuele KPI's tonen in plaats van generieke ROI.
# ---------------------------------------------------------------------------
write(
    "src/components/vastgoedrekenen/ScenarioVergelijking.tsx",
    r"""import { useMemo, useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Scenario, TaxSettings, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, fmtEurPerM2, DEAL_BADGE } from './format';
import { VR_STRATEGY_LABELS, VR_STATUS_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { useScenarioChildren } from '@/hooks/useVastgoedrekenen';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { mapToAssumptionType } from '@/lib/vastgoedrekenen/profiles';
import { Trophy, TrendingUp, ShieldCheck, Target, Coins, ChevronDown, ChevronRight } from 'lucide-react';

type SharedProps = {
  taxSettings: TaxSettings | null;
  objectType: 'enkelvoudig' | 'mixed_use';
  objectArea: number | null;
  objectWoz?: number | null;
  objectEnergyLabel?: string | null;
  objectBouwjaar?: number | null;
  objectRawType?: string | null;
};

type RowData = { scenario: Scenario; outputs: ComputedOutputs };

export type DevelopmentComparisonMetrics = {
  isDevelopment: boolean;
  complete: boolean;
  maxPurchasePrice: number | null;
  grossDevelopmentValue: number | null;
  netDevelopmentProceeds: number | null;
  nonAcquisitionCosts: number | null;
  totalInvestment: number | null;
  profit: number | null;
  profitOnGdvPct: number | null;
  profitOnCostPct: number | null;
  statusLabel: string;
  bindingLabel: string;
};

const positiveOrNull = (value: number | null | undefined): number | null => (
  value != null && Number.isFinite(value) && value > 0 ? value : null
);

export function getDevelopmentComparisonMetrics(outputs: ComputedOutputs): DevelopmentComparisonMetrics {
  const residual = outputs.residual;
  const isDevelopment = outputs.assessmentType === 'verkoop' || outputs.strategyEnabled || outputs.saleHasInput;

  if (residual) {
    const nonAcquisitionCosts = residual.componentDispositionCosts
      + residual.componentDevelopmentCosts
      + residual.sharedScenarioCosts
      + residual.financingCosts;
    const bindingLabel = residual.bindingTarget === 'winst_op_gdv'
      ? 'Winst op GDV'
      : residual.bindingTarget === 'winst_op_kosten'
        ? 'Winst op kosten'
        : residual.bindingTarget === 'vaste_winst'
          ? 'Vaste doelwinst'
          : 'Geen geldige doelwinst';
    return {
      isDevelopment: true,
      complete: residual.maxPurchasePrice > 0 && residual.criticalIssues.length === 0,
      maxPurchasePrice: positiveOrNull(residual.maxPurchasePrice),
      grossDevelopmentValue: positiveOrNull(residual.grossDevelopmentValue),
      netDevelopmentProceeds: positiveOrNull(residual.grossDevelopmentValue - residual.componentDispositionCosts),
      nonAcquisitionCosts: positiveOrNull(nonAcquisitionCosts),
      totalInvestment: positiveOrNull(residual.totalInvestmentAtMaxPurchase),
      profit: Number.isFinite(residual.profitAtMaxPurchase) ? residual.profitAtMaxPurchase : null,
      profitOnGdvPct: residual.profitOnGdvPct,
      profitOnCostPct: residual.profitOnCostPct,
      statusLabel: residual.status === 'voor_bieding' ? 'Residueel bepaald' : 'Indicatief / incompleet',
      bindingLabel,
    };
  }

  const gdv = positiveOrNull(outputs.grossSaleProceeds);
  const profit = outputs.netMargin;
  return {
    isDevelopment,
    complete: isDevelopment && positiveOrNull(outputs.leadingMaxValue) != null && gdv != null && profit != null,
    maxPurchasePrice: positiveOrNull(outputs.leadingMaxValue),
    grossDevelopmentValue: gdv,
    netDevelopmentProceeds: positiveOrNull(outputs.netSaleProceeds ?? outputs.saleNetProceedsUnits),
    nonAcquisitionCosts: positiveOrNull(outputs.totalCosts),
    totalInvestment: positiveOrNull(outputs.totalInvestment),
    profit,
    profitOnGdvPct: gdv && profit != null ? Number(((profit / gdv) * 100).toFixed(2)) : null,
    profitOnCostPct: outputs.roi,
    statusLabel: outputs.scoreLabel,
    bindingLabel: outputs.leadingMaxBasisLabel,
  };
}

function ScenarioComputer({
  s, shared, onReady,
}: { s: Scenario; shared: SharedProps; onReady: (id: string, data: RowData | null) => void }) {
  const { components, costs, wwsUnits, sellOffUnits, loading } = useScenarioChildren(s.id);
  const propertyType = useMemo(
    () => mapToAssumptionType(shared.objectRawType ?? null, shared.objectType),
    [shared.objectRawType, shared.objectType],
  );
  const outputs = useMemo(() => computeScenario({
    scenario: s,
    components,
    costs,
    wwsUnits,
    strategyUnits: sellOffUnits,
    taxSettings: shared.taxSettings,
    objectType: shared.objectType,
    objectArea: shared.objectArea,
    objectWoz: shared.objectWoz,
    objectEnergyLabel: shared.objectEnergyLabel,
    objectBouwjaar: shared.objectBouwjaar,
    propertyType,
  }), [
    s, components, costs, wwsUnits, sellOffUnits, propertyType,
    shared.taxSettings, shared.objectType, shared.objectArea, shared.objectWoz,
    shared.objectEnergyLabel, shared.objectBouwjaar,
  ]);

  useEffect(() => {
    if (loading) return;
    onReady(s.id, { scenario: s, outputs });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, s, outputs]);

  return null;
}

const eur = (value: number | null): string => value == null ? '—' : fmtEur(value);
const pct = (value: number | null): string => value == null ? '—' : `${value.toFixed(1)}%`;

function bidVsAsking(maxPurchasePrice: number | null, asking: number): { label: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (maxPurchasePrice == null) return { label: 'Onvoldoende data', tone: 'neutral' };
  if (!asking || asking <= 0) return { label: 'Vraagprijs onbekend', tone: 'neutral' };
  const diff = maxPurchasePrice - asking;
  const percentage = (diff / asking) * 100;
  if (Math.abs(percentage) < 2) return { label: 'Rond vraagprijs', tone: 'neutral' };
  if (diff > 0) return { label: 'Boven vraagprijs', tone: 'positive' };
  if (percentage > -10) return { label: 'Onder vraagprijs', tone: 'negative' };
  return { label: 'Alleen interessant bij lagere aankoopprijs', tone: 'negative' };
}

function comparableRows(rows: RowData[]) {
  return rows
    .map((row) => ({ ...row, metrics: getDevelopmentComparisonMetrics(row.outputs) }))
    .filter((row) => row.metrics.complete && row.outputs.dealScore !== 'reject');
}

function pickBest(rows: RowData[]) {
  const pool = comparableRows(rows);
  if (pool.length === 0) return null;
  const riskRank: Record<string, number> = { laag: 0, middel: 1, hoog: 2 };
  const byBid = [...pool].sort((a, b) => (b.metrics.maxPurchasePrice ?? -Infinity) - (a.metrics.maxPurchasePrice ?? -Infinity))[0];
  const byProfit = [...pool].sort((a, b) => (b.metrics.profit ?? -Infinity) - (a.metrics.profit ?? -Infinity))[0];
  const byProfitOnCost = [...pool].sort((a, b) => (b.metrics.profitOnCostPct ?? -Infinity) - (a.metrics.profitOnCostPct ?? -Infinity))[0];
  const byRisk = [...pool].sort((a, b) => (riskRank[a.outputs.riskScore] ?? 99) - (riskRank[b.outputs.riskScore] ?? 99))[0];
  return { byBid, byProfit, byProfitOnCost, byRisk, count: pool.length };
}

function DiffBlock({ maximum, asking }: { maximum: number | null; asking: number }) {
  if (maximum == null || !asking || asking <= 0) return <span className="text-muted-foreground">—</span>;
  const diff = maximum - asking;
  const percentage = (diff / asking) * 100;
  const positive = diff >= 0;
  const cls = positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300';
  const sign = positive ? '+' : '−';
  return (
    <span className={`font-mono-data ${cls}`}>
      {sign} {fmtEur(Math.abs(diff))} <span className="opacity-75">/ {sign}{Math.abs(percentage).toFixed(1)}%</span>
    </span>
  );
}

function ScenarioCard({ row, onSelect }: { row: RowData; onSelect?: (id: string) => void }) {
  const { scenario, outputs } = row;
  const metrics = getDevelopmentComparisonMetrics(outputs);
  const asking = Number(scenario.asking_price ?? 0);
  const position = bidVsAsking(metrics.maxPurchasePrice, asking);
  const deal = DEAL_BADGE[outputs.dealScore];
  const tone = position.tone === 'positive'
    ? 'border-emerald-500/40 bg-emerald-500/5'
    : position.tone === 'negative'
      ? 'border-amber-500/40 bg-amber-500/5'
      : 'border-muted';
  const clickable = Boolean(onSelect);

  return (
    <Card
      className={clickable ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
      onClick={clickable ? () => onSelect?.(scenario.id) : undefined}
      onKeyDown={clickable ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect?.(scenario.id);
      } : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold leading-snug break-words">{scenario.scenario_name}</p>
            <p className="text-xs text-muted-foreground">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</p>
          </div>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${deal.cls}`}>{metrics.statusLabel}</span>
        </div>

        <div className={`rounded-md border p-3 ${tone}`}>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Maximale aankoopprijs</p>
          <p className="text-xl font-semibold font-mono-data mt-0.5">{eur(metrics.maxPurchasePrice)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{metrics.bindingLabel}</p>
          <div className="mt-2 text-xs">
            <p className="text-muted-foreground">Verschil met vraagprijs</p>
            <DiffBlock maximum={metrics.maxPurchasePrice} asking={asking} />
            <p className="mt-1 text-[11px] text-muted-foreground">{position.label}</p>
          </div>
        </div>

        {metrics.isDevelopment ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">GDV</p><p className="font-mono-data">{eur(metrics.grossDevelopmentValue)}</p></div>
            <div><p className="text-muted-foreground">Netto ontwikkelopbrengst</p><p className="font-mono-data">{eur(metrics.netDevelopmentProceeds)}</p></div>
            <div><p className="text-muted-foreground">Kosten excl. verwerving</p><p className="font-mono-data">{eur(metrics.nonAcquisitionCosts)}</p></div>
            <div><p className="text-muted-foreground">Investering bij maximum</p><p className="font-mono-data">{eur(metrics.totalInvestment)}</p></div>
            <div><p className="text-muted-foreground">Ontwikkelaarswinst</p><p className={`font-mono-data ${metrics.profit != null && metrics.profit < 0 ? 'text-destructive' : ''}`}>{eur(metrics.profit)}</p></div>
            <div><p className="text-muted-foreground">Winst op GDV</p><p className="font-mono-data">{pct(metrics.profitOnGdvPct)}</p></div>
            <div><p className="text-muted-foreground">Winst op kosten</p><p className="font-mono-data">{pct(metrics.profitOnCostPct)}</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><p className="text-muted-foreground">Totale investering</p><p className="font-mono-data">{fmtEur(outputs.totalInvestment)}</p></div>
            <div><p className="text-muted-foreground">BAR op investering</p><p className="font-mono-data">{fmtPct(outputs.barTotalInvestment)}</p></div>
            <div><p className="text-muted-foreground">NOI</p><p className="font-mono-data">{fmtEur(outputs.noi)}</p></div>
            {outputs.annualRentPerM2 != null && <div><p className="text-muted-foreground">Jaarhuur /m²</p><p className="font-mono-data">{fmtEurPerM2(outputs.annualRentPerM2)}</p></div>}
          </div>
        )}

        {outputs.scoreAttentionPoints.length > 0 && (
          <p className="text-[11px] text-muted-foreground leading-snug">⚠ {outputs.scoreAttentionPoints[0]}</p>
        )}
        <p className="text-[11px] text-muted-foreground">Quickscanstatus: {VR_STATUS_LABELS[scenario.status]} · betrouwbaarheid {outputs.inputReliability}</p>
      </CardContent>
    </Card>
  );
}

export default function ScenarioVergelijking({ scenarios, onSelectScenario, ...shared }: { scenarios: Scenario[]; onSelectScenario?: (id: string) => void } & SharedProps) {
  const [showFullTable, setShowFullTable] = useState(false);
  const [map, setMap] = useState<Record<string, RowData>>({});

  const handleReady = useCallback((id: string, data: RowData | null) => {
    setMap((previous) => {
      if (!data) {
        if (!(id in previous)) return previous;
        const next = { ...previous };
        delete next[id];
        return next;
      }
      const existing = previous[id];
      if (existing && existing.scenario === data.scenario && existing.outputs === data.outputs) return previous;
      return { ...previous, [id]: data };
    });
  }, []);

  useEffect(() => {
    const ids = new Set(scenarios.map((scenario) => scenario.id));
    setMap((previous) => {
      const next: Record<string, RowData> = {};
      let changed = false;
      for (const [id, data] of Object.entries(previous)) {
        if (ids.has(id)) next[id] = data;
        else changed = true;
      }
      return changed ? next : previous;
    });
  }, [scenarios]);

  const rows = useMemo(
    () => scenarios.map((scenario) => map[scenario.id]).filter(Boolean) as RowData[],
    [map, scenarios],
  );
  const best = useMemo(() => pickBest(rows), [rows]);

  if (scenarios.length === 0) return null;

  return (
    <>
      {scenarios.map((scenario) => (
        <ScenarioComputer key={scenario.id} s={scenario} shared={shared} onReady={handleReady} />
      ))}

      {best && best.count >= 2 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Vergelijkbare, complete scenario's</p>
              <span className="text-[10px] text-muted-foreground">Onvolledige scenario's worden niet als winnaar gerangschikt.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" /> Hoogste maximale aankoopprijs</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byBid.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(best.byBid.metrics.maxPurchasePrice)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Coins className="h-3 w-3" /> Hoogste ontwikkelaarswinst</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byProfit.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{eur(best.byProfit.metrics.profit)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Hoogste winst op kosten</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byProfitOnCost.scenario.scenario_name}</p>
                <p className="text-xs font-mono-data text-muted-foreground">{pct(best.byProfitOnCost.metrics.profitOnCostPct)}</p>
              </div>
              <div className="rounded-md border bg-card p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Laagste risicoscore</p>
                <p className="text-sm font-semibold mt-1 leading-snug">{best.byRisk.scenario.scenario_name}</p>
                <p className="text-xs text-muted-foreground capitalize">Risico: {best.byRisk.outputs.riskScore}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {rows.length === 0 && (
        <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">Scenario's worden berekend…</CardContent></Card>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
          {rows.map((row) => <ScenarioCard key={row.scenario.id} row={row} onSelect={onSelectScenario} />)}
        </div>
      )}

      {rows.length > 0 && (
        <Card className="hidden lg:block mt-3">
          <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="text-base">Scenariovergelijking</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Ontwikkelscenario's worden vergeleken op residuele aankoopruimte, GDV en ontwikkelaarswinst.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFullTable((value) => !value)} className="shrink-0">
              {showFullTable
                ? <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Toon compact</>
                : <><ChevronRight className="h-3.5 w-3.5 mr-1" /> Toon volledige vergelijking</>}
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className={`w-full text-sm border-separate border-spacing-0 ${showFullTable ? 'min-w-[1450px]' : 'min-w-[1120px]'}`}>
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 sticky left-0 bg-card z-10 border-b">Scenario</th>
                  <th className="px-3 py-2 border-b">Strategie</th>
                  <th className="px-3 py-2 border-b">Status</th>
                  <th className="px-3 py-2 text-right border-b bg-primary/5">Max. aankoopprijs</th>
                  <th className="px-3 py-2 text-right border-b">GDV / waarde</th>
                  <th className="px-3 py-2 text-right border-b">Netto opbrengst</th>
                  <th className="px-3 py-2 text-right border-b">Kosten excl. verwerving</th>
                  <th className="px-3 py-2 text-right border-b">Investering bij maximum</th>
                  <th className="px-3 py-2 text-right border-b">Winst / NOI</th>
                  <th className="px-3 py-2 text-right border-b">Winst op GDV</th>
                  <th className="px-3 py-2 text-right border-b">Winst op kosten / BAR</th>
                  {showFullTable && (
                    <>
                      <th className="px-3 py-2 text-right border-b">Δ vraagprijs</th>
                      <th className="px-3 py-2 border-b">Bindend criterium</th>
                      <th className="px-3 py-2 border-b">Risico</th>
                      <th className="px-3 py-2 border-b">Betrouwbaarheid</th>
                      <th className="px-3 py-2 border-b">Belangrijkste aandachtspunt</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const { scenario, outputs } = row;
                  const metrics = getDevelopmentComparisonMetrics(outputs);
                  const asking = Number(scenario.asking_price ?? 0);
                  const development = metrics.isDevelopment;
                  const clickable = Boolean(onSelectScenario);
                  return (
                    <tr
                      key={scenario.id}
                      className={`hover:bg-muted/30 ${clickable ? 'cursor-pointer' : ''}`}
                      onClick={clickable ? () => onSelectScenario?.(scenario.id) : undefined}
                    >
                      <td className="px-3 py-2 sticky left-0 bg-card font-medium border-b">{scenario.scenario_name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground border-b">{VR_STRATEGY_LABELS[scenario.strategy_type] ?? scenario.strategy_type}</td>
                      <td className="px-3 py-2 text-xs border-b">{metrics.statusLabel}</td>
                      <td className="px-3 py-2 font-mono-data text-right font-semibold bg-primary/5 border-b">{eur(metrics.maxPurchasePrice)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.grossDevelopmentValue) : eur(positiveOrNull(outputs.exitValue ?? outputs.maximumAllInValue))}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.netDevelopmentProceeds) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.nonAcquisitionCosts) : eur(positiveOrNull(outputs.totalCosts))}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? eur(metrics.totalInvestment) : eur(positiveOrNull(outputs.totalInvestment))}</td>
                      <td className={`px-3 py-2 font-mono-data text-right border-b ${development && metrics.profit != null && metrics.profit < 0 ? 'text-destructive' : ''}`}>{development ? eur(metrics.profit) : fmtEur(outputs.noi)}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? pct(metrics.profitOnGdvPct) : '—'}</td>
                      <td className="px-3 py-2 font-mono-data text-right border-b">{development ? pct(metrics.profitOnCostPct) : fmtPct(outputs.barTotalInvestment)}</td>
                      {showFullTable && (
                        <>
                          <td className="px-3 py-2 text-right border-b text-xs"><DiffBlock maximum={metrics.maxPurchasePrice} asking={asking} /></td>
                          <td className="px-3 py-2 text-xs border-b">{metrics.bindingLabel}</td>
                          <td className="px-3 py-2 text-xs border-b capitalize">{outputs.riskScore}</td>
                          <td className="px-3 py-2 text-xs border-b capitalize">{outputs.inputReliability}</td>
                          <td className="px-3 py-2 text-xs border-b max-w-[280px]">{outputs.scoreAttentionPoints[0] ?? outputs.residual?.criticalIssues[0] ?? '—'}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
""",
)


# ---------------------------------------------------------------------------
# 6. Regressietests voor URL-doel en residuele vergelijking.
# ---------------------------------------------------------------------------
write(
    "src/test/vastgoedrekenen/quickscanNavigation.test.ts",
    """import { describe, expect, it } from 'vitest';
import { buildQuickscanObjectHref, readRequestedQuickscanId } from '@/lib/vastgoedrekenen/quickscanNavigation';

describe('quickscan navigation', () => {
  it('neemt object, quickscan, tab en anchor expliciet mee', () => {
    expect(buildQuickscanObjectHref('object 1', 'quickscan/1')).toBe(
      '/objecten/object%201?tab=vastgoedrekenen&calculation=quickscan%2F1#vastgoedrekenen',
    );
  });

  it('leest het aangeklikte quickscan-id uit de query', () => {
    expect(readRequestedQuickscanId('?tab=vastgoedrekenen&calculation=abc-123')).toBe('abc-123');
    expect(readRequestedQuickscanId('?tab=vastgoedrekenen')).toBeNull();
  });
});
""",
)

write(
    "src/test/vastgoedrekenen/scenarioVergelijkingMetrics.test.ts",
    """import { describe, expect, it } from 'vitest';
import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { getDevelopmentComparisonMetrics } from '@/components/vastgoedrekenen/ScenarioVergelijking';

function outputWithResidual(): ComputedOutputs {
  return {
    assessmentType: 'verkoop',
    strategyEnabled: true,
    saleHasInput: true,
    grossSaleProceeds: 4_000_000,
    netSaleProceeds: 3_940_000,
    saleNetProceedsUnits: 3_940_000,
    leadingMaxValue: 1_815_770,
    totalCosts: 2_000_000,
    totalInvestment: 121_910,
    netMargin: null,
    roi: null,
    scoreLabel: 'Residueel bepaald',
    leadingMaxBasisLabel: 'Componentstrategie',
    residual: {
      source: 'componentstrategie',
      grossDevelopmentValue: 4_000_000,
      componentDispositionCosts: 60_000,
      componentDevelopmentCosts: 1_000_000,
      sharedScenarioCosts: 121_910,
      financingCosts: 80_000,
      targetProfitAmount: 600_000,
      bindingTarget: 'winst_op_gdv',
      allowedTotalInvestment: 3_400_000,
      maxPurchasePrice: 1_815_770,
      transferTaxAtMaxPurchase: 188_840,
      acquisitionCostsAtMaxPurchase: 193_480,
      totalInvestmentAtMaxPurchase: 3_400_000,
      profitAtMaxPurchase: 600_000,
      profitOnCostPct: 17.65,
      profitOnGdvPct: 15,
      status: 'voor_bieding',
      criticalIssues: [],
      warnings: [],
      iterations: 20,
      converged: true,
    },
  } as unknown as ComputedOutputs;
}

describe('scenariovergelijking ontwikkel-KPI’s', () => {
  it('gebruikt de controleerbare residuele uitkomst in plaats van de lege huidige investering', () => {
    const metrics = getDevelopmentComparisonMetrics(outputWithResidual());
    expect(metrics.complete).toBe(true);
    expect(metrics.maxPurchasePrice).toBe(1_815_770);
    expect(metrics.grossDevelopmentValue).toBe(4_000_000);
    expect(metrics.netDevelopmentProceeds).toBe(3_940_000);
    expect(metrics.nonAcquisitionCosts).toBe(1_261_910);
    expect(metrics.totalInvestment).toBe(3_400_000);
    expect(metrics.profit).toBe(600_000);
    expect(metrics.profitOnGdvPct).toBe(15);
    expect(metrics.profitOnCostPct).toBe(17.65);
  });

  it('presenteert een nulkoopsom niet als een echte waarde', () => {
    const outputs = outputWithResidual();
    outputs.residual = { ...outputs.residual!, maxPurchasePrice: 0, criticalIssues: ['Geen positieve koopsom.'] };
    const metrics = getDevelopmentComparisonMetrics(outputs);
    expect(metrics.complete).toBe(false);
    expect(metrics.maxPurchasePrice).toBeNull();
  });
});
""",
)

print("Vastgoedrekenen navigation/comparison patch applied successfully")
