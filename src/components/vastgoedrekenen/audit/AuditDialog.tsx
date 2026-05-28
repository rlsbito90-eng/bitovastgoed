// Audit & Diagnostics Dialog voor Vastgoedrekenen.
// UI-laag bovenop runScenarioAudit — geen rekenlogica.

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck, AlertTriangle, XCircle, MinusCircle, ClipboardCopy, Download } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditInput } from '@/lib/vastgoedrekenen/audit/runAudit';
import { runScenarioAudit } from '@/lib/vastgoedrekenen/audit/runAudit';
import { exportAuditMarkdown } from '@/lib/vastgoedrekenen/audit/exportMarkdown';
import { CATEGORY_LABELS, type AuditCategory, type AuditCheck } from '@/lib/vastgoedrekenen/audit/types';
import { buildCalcChain, CALC_CHAIN_FASE_LABEL, type CalcChainStep } from '@/lib/vastgoedrekenen/audit/calcChain';
import { computeReliability, reliabilityBadgeClass } from '@/lib/vastgoedrekenen/validation/reliability';
import { detectCaseType, getCaseRequirement } from '@/lib/vastgoedrekenen/validation/caseRequirements';
import { computeScenario } from '@/lib/vastgoedrekenen/compute';
import { FIELD_STATUS_LABEL } from '@/lib/vastgoedrekenen/validation/fieldStatus';

type Props = {
  buildInput: () => AuditInput;
  triggerLabel?: string;
};

function StatusIcon({ s }: { s: AuditCheck['status'] }) {
  if (s === 'ok') return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
  if (s === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  if (s === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
  return <MinusCircle className="h-4 w-4 text-muted-foreground" />;
}

function statusBadge(s: AuditCheck['status']) {
  const m = {
    ok: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
    warning: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
    error: 'bg-destructive/10 text-destructive',
    na: 'bg-muted text-muted-foreground',
  } as const;
  const lab = { ok: 'OK', warning: 'Waarschuwing', error: 'Fout', na: 'N.v.t.' }[s];
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${m[s]}`}>{lab}</span>;
}

export default function AuditDialog({ buildInput, triggerLabel = 'Controleer scenario' }: Props) {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  const report = useMemo(() => (open ? runScenarioAudit(buildInput()) : null), [open, tick, buildInput]);

  const grouped = useMemo(() => {
    if (!report) return new Map<AuditCategory, AuditCheck[]>();
    const m = new Map<AuditCategory, AuditCheck[]>();
    for (const c of report.checks) {
      if (!m.has(c.category)) m.set(c.category, []);
      m.get(c.category)!.push(c);
    }
    return m;
  }, [report]);

  // Rekenketen + casustype + betrouwbaarheid worden lokaal afgeleid uit dezelfde input.
  const derived = useMemo(() => {
    if (!open || !report) return null;
    const input = buildInput();
    const computed = computeScenario({
      scenario: input.scenario,
      components: input.components,
      costs: input.costs,
      wwsUnits: input.wwsUnits,
      strategyUnits: input.strategyUnits,
      taxSettings: input.taxSettings,
      objectType: input.objectType,
      objectArea: input.objectArea,
      objectWoz: input.objectWoz,
      objectEnergyLabel: input.objectEnergyLabel,
      objectBouwjaar: input.objectBouwjaar,
      propertyType: input.propertyType,
    });
    const chain = buildCalcChain(input.scenario, computed);
    const caseType = detectCaseType(input.scenario, input.components, input.strategyUnits, input.objectType);
    const requirement = getCaseRequirement(caseType);
    const reliability = computeReliability({
      validation: [],
      audit: report,
      requirement,
      manualWithoutSource: !!input.scenario.assumptions_manual && !input.scenario.assumptions_source,
    });
    return { chain, requirement, reliability };
  }, [open, tick, report, buildInput]);


  async function copyMd() {
    if (!report) return;
    const md = exportAuditMarkdown(report);
    try {
      await navigator.clipboard.writeText(md);
      toast.success('Auditrapport naar klembord gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  }
  function downloadMd() {
    if (!report) return;
    const md = exportAuditMarkdown(report);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auditrapport-${report.scenarioName.replace(/[^a-z0-9-]+/gi, '_')}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const categories: AuditCategory[] = [
    'save_state', 'object_data', 'scenario_settings', 'components',
    'wws_mapping', 'strategy_mapping', 'rent_source', 'wws',
    'ovb', 'costs', 'exit', 'strategy_mix',
    'engine', 'snapshot', 'max_bid', 'doable',
    'double_counting', 'onderbouwing', 'formatting', 'hinthamerstraat',
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full lg:w-auto">
          <ShieldCheck className="h-4 w-4 mr-1" />{triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Audit & Diagnostics — {report?.scenarioName ?? '…'}</DialogTitle>
        </DialogHeader>

        {report && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200">{report.summary.ok} OK</Badge>
              <Badge variant="outline" className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">{report.summary.warning} waarschuwingen</Badge>
              <Badge variant="outline" className="bg-destructive/10 text-destructive">{report.summary.error} fouten</Badge>
              <Badge variant="outline" className="bg-muted text-muted-foreground">{report.summary.na} n.v.t.</Badge>
              <Button size="sm" variant="ghost" onClick={() => setTick((t) => t + 1)} className="ml-auto">Herberekenen</Button>
            </div>
            <p className="text-sm text-muted-foreground">{report.conclusion}</p>

            <Tabs defaultValue="overzicht" className="flex-1 flex flex-col min-h-0">
              <TabsList className="flex-wrap h-auto justify-start">
                <TabsTrigger value="overzicht">Overzicht</TabsTrigger>
                <TabsTrigger value="bronnen">Bron van waarheid</TabsTrigger>
                <TabsTrigger value="maxbid">Maximale bieding</TabsTrigger>
                <TabsTrigger value="categorieen">Per categorie</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-3 pr-2">
                <TabsContent value="overzicht" className="space-y-2 m-0">
                  {report.checks
                    .filter((c) => c.status === 'error' || c.status === 'warning')
                    .map((c) => (
                      <div key={c.id} className="flex items-start gap-2 p-2 rounded border bg-muted/30">
                        <StatusIcon s={c.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            {statusBadge(c.status)}
                            <span className="font-medium">{c.section}</span>
                            {c.record && <span className="text-muted-foreground">· {c.record}</span>}
                          </div>
                          <p className="text-sm mt-0.5">{c.problem}</p>
                          {c.advice && <p className="text-xs text-muted-foreground mt-0.5">Advies: {c.advice}</p>}
                          {c.technical && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.technical}</p>}
                        </div>
                      </div>
                    ))}
                  {report.summary.error === 0 && report.summary.warning === 0 && (
                    <p className="text-sm text-muted-foreground">Geen openstaande aandachtspunten.</p>
                  )}
                </TabsContent>

                <TabsContent value="bronnen" className="m-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="py-2 pr-3">Onderdeel</th>
                          <th className="py-2 pr-3">Actieve bron</th>
                          <th className="py-2 pr-3">Alternatief gevuld</th>
                          <th className="py-2 pr-3">Risico</th>
                          <th className="py-2">Toelichting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.sourcesOfTruth.map((row, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 font-medium">{row.onderdeel}</td>
                            <td className="py-1.5 pr-3">{row.actieveBron}</td>
                            <td className="py-1.5 pr-3">{row.alternatieveBron ?? '—'}</td>
                            <td className="py-1.5 pr-3">{row.risico}</td>
                            <td className="py-1.5 text-muted-foreground">{row.toelichting ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="maxbid" className="m-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="py-2 pr-3">Stap</th>
                          <th className="py-2 pr-3 text-right">Waarde</th>
                          <th className="py-2">Formule / toelichting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.maxBidExplain.map((s, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-3">{s.label}</td>
                            <td className="py-1.5 pr-3 text-right font-mono">{typeof s.value === 'number' ? s.value.toLocaleString('nl-NL') : (s.value ?? '—')}</td>
                            <td className="py-1.5 text-muted-foreground">{s.formula ?? s.note ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="categorieen" className="m-0 space-y-4">
                  {categories.map((cat) => {
                    const list = grouped.get(cat) ?? [];
                    if (list.length === 0) return null;
                    return (
                      <div key={cat}>
                        <h4 className="text-sm font-semibold mb-1">{CATEGORY_LABELS[cat]}</h4>
                        <div className="space-y-1.5">
                          {list.map((c) => (
                            <div key={c.id} className="flex items-start gap-2 p-2 rounded border">
                              <StatusIcon s={c.status} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 text-xs">
                                  {statusBadge(c.status)}
                                  <span className="font-medium">{c.section}</span>
                                  {c.record && <span className="text-muted-foreground">· {c.record}</span>}
                                </div>
                                <p className="text-sm mt-0.5">{c.problem}</p>
                                {c.advice && <p className="text-xs text-muted-foreground mt-0.5">Advies: {c.advice}</p>}
                                {c.technical && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{c.technical}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button variant="outline" size="sm" onClick={copyMd}><ClipboardCopy className="h-4 w-4 mr-1" />Kopieer Markdown</Button>
              <Button variant="default" size="sm" onClick={downloadMd}><Download className="h-4 w-4 mr-1" />Download .md</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
