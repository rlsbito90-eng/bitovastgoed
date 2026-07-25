import { useMemo, useState } from 'react';
import { Plus, Trash2, Link2, AlertTriangle, CheckCircle2, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RawNumberInput, RawTextInput, RawTextarea, numberToRaw, parseRawNumber } from '../RawInputs';
import { fmtEur, fmtM2 } from '../format';
import { VR_COMPONENT_LABELS, VR_OVB_CLASSIFICATION_LABELS } from '@/lib/vastgoedrekenen/defaults';
import type { ComputedOutputs, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import type { AcquisitionComponent, AcquisitionUnitLink } from '@/lib/vastgoedrekenen/acquisition';

const ALLOCATION_LABELS: Record<AcquisitionComponent['transfer_tax_allocation_method'], string> = {
  value: 'Huidige waarden bij verkrijging',
  extern: 'Externe verkrijgingswaardeverdeling',
  m2: 'Indicatief op huidige m²',
  manual: 'Handmatig OVB-bedrag',
};

type Props = {
  components: AcquisitionComponent[];
  links: AcquisitionUnitLink[];
  strategyUnits: SellOffUnit[];
  ovbPerComponent: ComputedOutputs['ovbPerComponent'];
  purchasePrice: number;
  onCreate: (patch?: Partial<AcquisitionComponent>) => Promise<AcquisitionComponent | null>;
  onUpdate: (id: string, patch: Partial<AcquisitionComponent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSetLinks: (acquisitionComponentId: string, sellOffUnitIds: string[]) => Promise<void>;
};

function unitLabel(unit: SellOffUnit, index: number): string {
  const record = unit as unknown as Record<string, unknown>;
  return String(record.unit_label ?? record.unit_name ?? '').trim() || `Unit ${index + 1}`;
}

function componentSurface(component: AcquisitionComponent): string {
  const parts: string[] = [];
  if (Number(component.surface_gbo ?? 0) > 0) parts.push(`GBO ${fmtM2(Number(component.surface_gbo))}`);
  if (Number(component.surface_vvo ?? 0) > 0) parts.push(`VVO ${fmtM2(Number(component.surface_vvo))}`);
  if (Number(component.surface_bvo ?? 0) > 0) parts.push(`BVO ${fmtM2(Number(component.surface_bvo))}`);
  return parts.join(' · ') || '—';
}

export default function AcquisitionComponentsTable({
  components,
  links,
  strategyUnits,
  ovbPerComponent,
  purchasePrice,
  onCreate,
  onUpdate,
  onDelete,
  onSetLinks,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openComponent = openId ? components.find((component) => component.id === openId) ?? null : null;
  const totalOvb = ovbPerComponent.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const totalBasis = ovbPerComponent.reduce((sum, row) => sum + Number(row.basisValue ?? 0), 0);

  const linksByComponent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of links) {
      const current = map.get(link.acquisition_component_id) ?? [];
      current.push(link.sell_off_unit_id);
      map.set(link.acquisition_component_id, current);
    }
    return map;
  }, [links]);

  const createComponent = async () => {
    const created = await onCreate({
      component_name: 'Nieuw verkrijgingscomponent',
      component_type: 'overig',
      transfer_tax_allocation_method: 'value',
      transfer_tax_classification: null,
    });
    if (created) setOpenId(created.id);
  };

  return (
    <section className="rounded-lg border border-primary/25 bg-primary/[0.025] p-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Verkrijgingsstructuur & OVB</h4>
          </div>
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
            Leg hier uitsluitend vast wat juridisch en feitelijk wordt verkregen. Eén huidig verkrijgingsdeel kan aan meerdere toekomstige strategie-units worden gekoppeld. OVB wordt niet meer afgeleid uit de toekomstige verkoopstructuur zodra deze tabel is ingevuld.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void createComponent()} className="shrink-0">
          <Plus className="mr-1 h-3.5 w-3.5" /> Verkrijgingscomponent
        </Button>
      </div>

      {components.length === 0 ? (
        <div className="rounded-md border border-dashed bg-background/70 px-3 py-4 text-xs text-muted-foreground">
          Nog geen aparte verkrijgingsstructuur. Totdat je hier een component toevoegt, blijft OVB terugvallen op de bestaande projectcomponenten. Voeg bijvoorbeeld één huidig ontwikkeldeel toe en koppel daar de toekomstige nieuwbouwappartementen aan.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <SummaryTile label="Actuele aankoopbasis" value={purchasePrice > 0 ? fmtEur(purchasePrice) : 'Ontbreekt'} />
            <SummaryTile label="Verdeelde OVB-grondslag" value={fmtEur(totalBasis)} warning={purchasePrice > 0 && totalBasis !== purchasePrice} />
            <SummaryTile label="Totale berekende OVB" value={fmtEur(totalOvb)} accent />
          </div>

          <div className="rounded-md border overflow-x-auto bg-background/80">
            <Table className="text-xs min-w-[860px] xl:min-w-0">
              <TableHeader>
                <TableRow>
                  <TableHead>Verkrijgingscomponent</TableHead>
                  <TableHead>Huidige type</TableHead>
                  <TableHead>Oppervlakte</TableHead>
                  <TableHead>Gekoppelde toekomstunits</TableHead>
                  <TableHead>Verdeling</TableHead>
                  <TableHead className="text-right">Grondslag</TableHead>
                  <TableHead className="text-right">OVB-%</TableHead>
                  <TableHead className="text-right">OVB</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {components.map((component) => {
                  const diag = ovbPerComponent.find((row) => row.id === component.id) ?? null;
                  const linkedIds = linksByComponent.get(component.id) ?? [];
                  const exemptionNeedsSource = component.transfer_tax_classification === 'vrijgesteld'
                    && !String(component.source_note ?? component.notes ?? '').trim();
                  const incomplete = !diag
                    || diag.missingPurchaseBasis
                    || diag.missingValueBasis
                    || diag.missingManualAmount
                    || diag.mixedAllocationMethods
                    || !component.transfer_tax_classification;
                  const status = incomplete ? 'Incompleet' : exemptionNeedsSource ? 'Onderbouwen' : 'Compleet';
                  return (
                    <TableRow
                      key={component.id}
                      id={`acquisition-component-${component.id}`}
                      className="cursor-pointer hover:bg-muted/40 scroll-mt-28"
                      onClick={() => setOpenId(component.id)}
                    >
                      <TableCell className="font-medium">{component.component_name}</TableCell>
                      <TableCell>{VR_COMPONENT_LABELS[component.component_type] ?? component.component_type}</TableCell>
                      <TableCell className="font-mono-data">{componentSurface(component)}</TableCell>
                      <TableCell>{linkedIds.length > 0 ? `${linkedIds.length} unit(s)` : 'Geen koppeling'}</TableCell>
                      <TableCell>{ALLOCATION_LABELS[component.transfer_tax_allocation_method]}</TableCell>
                      <TableCell className="text-right font-mono-data">{diag ? fmtEur(diag.basisValue) : '—'}</TableCell>
                      <TableCell className="text-right font-mono-data">{diag ? `${diag.pct}%` : '—'}</TableCell>
                      <TableCell className="text-right font-mono-data">{diag ? fmtEur(diag.amount) : '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                          incomplete
                            ? 'border-destructive/30 bg-destructive/5 text-destructive'
                            : exemptionNeedsSource
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                        }`}>
                          {incomplete || exemptionNeedsSource
                            ? <AlertTriangle className="h-3 w-3" />
                            : <CheckCircle2 className="h-3 w-3" />}
                          {status}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell colSpan={5}>Totaal {components.length} verkrijgingscomponent(en)</TableCell>
                  <TableCell className="text-right font-mono-data">{fmtEur(totalBasis)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right font-mono-data">{fmtEur(totalOvb)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <Sheet open={openComponent != null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openComponent && (() => {
            const linkedIds = linksByComponent.get(openComponent.id) ?? [];
            const diag = ovbPerComponent.find((row) => row.id === openComponent.id) ?? null;
            const toggleLink = async (unitId: string, checked: boolean) => {
              const next = checked
                ? [...new Set([...linkedIds, unitId])]
                : linkedIds.filter((id) => id !== unitId);
              await onSetLinks(openComponent.id, next);
            };
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{openComponent.component_name}</SheetTitle>
                  <SheetDescription>Huidige situatie bij verkrijging — leidend voor OVB.</SheetDescription>
                </SheetHeader>

                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Naam">
                      <RawTextInput className="h-9" initialValue={openComponent.component_name} onCommit={(raw) => onUpdate(openComponent.id, { component_name: raw.trim() || 'Verkrijgingscomponent' })} />
                    </Field>
                    <Field label="Huidig type">
                      <Select value={openComponent.component_type} onValueChange={(value) => onUpdate(openComponent.id, { component_type: value as AcquisitionComponent['component_type'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Locatie / omschrijving">
                      <RawTextInput className="h-9" initialValue={openComponent.floor_or_location ?? ''} onCommit={(raw) => onUpdate(openComponent.id, { floor_or_location: raw.trim() || null })} />
                    </Field>
                    <Field label="Toerekeningsmethode">
                      <Select value={openComponent.transfer_tax_allocation_method} onValueChange={(value) => onUpdate(openComponent.id, { transfer_tax_allocation_method: value as AcquisitionComponent['transfer_tax_allocation_method'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(ALLOCATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="GBO huidige staat (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(openComponent.surface_gbo)} onCommit={(raw) => onUpdate(openComponent.id, { surface_gbo: parseRawNumber(raw) })} /></Field>
                    <Field label="VVO huidige staat (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(openComponent.surface_vvo)} onCommit={(raw) => onUpdate(openComponent.id, { surface_vvo: parseRawNumber(raw) })} /></Field>
                    <Field label="BVO huidige staat (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(openComponent.surface_bvo)} onCommit={(raw) => onUpdate(openComponent.id, { surface_bvo: parseRawNumber(raw) })} /></Field>
                    <Field label="Huidige waarde bij verkrijging (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(openComponent.allocated_component_value)} onCommit={(raw) => onUpdate(openComponent.id, { allocated_component_value: parseRawNumber(raw) })} /></Field>
                    <Field label="OVB-classificatie">
                      <Select value={openComponent.transfer_tax_classification ?? '__leeg__'} onValueChange={(value) => onUpdate(openComponent.id, { transfer_tax_classification: value === '__leeg__' ? null : value as AcquisitionComponent['transfer_tax_classification'] })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__leeg__">Nog niet gekozen</SelectItem>
                          {Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="OVB-% handmatige override">
                      <RawNumberInput className="h-9" initialValue={numberToRaw(openComponent.transfer_tax_percentage)} onCommit={(raw) => {
                        const value = parseRawNumber(raw);
                        return onUpdate(openComponent.id, {
                          transfer_tax_percentage: value,
                          transfer_tax_manual_override: value != null,
                        });
                      }} />
                    </Field>
                  </div>

                  <div className="rounded-md border bg-muted/25 p-3 text-xs space-y-1">
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Toegerekende OVB-grondslag</span><span className="font-mono-data">{diag ? fmtEur(diag.basisValue) : '—'}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted-foreground">Tarief</span><span className="font-mono-data">{diag ? `${diag.pct}%` : '—'}</span></div>
                    <div className="flex justify-between gap-3 border-t pt-1 font-semibold"><span>OVB voor dit verkrijgingsdeel</span><span className="font-mono-data">{diag ? fmtEur(diag.amount) : '—'}</span></div>
                  </div>

                  <div className="space-y-2 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Gekoppelde toekomstige strategie-units</Label>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Deze koppeling beïnvloedt de OVB niet; zij legt alleen vast welke toekomstige units uit dit huidige verkrijgingsdeel voortkomen.</p>
                    {strategyUnits.length === 0 ? (
                      <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">Nog geen toekomstige strategie-units beschikbaar.</p>
                    ) : (
                      <div className="rounded-md border divide-y">
                        {strategyUnits.map((unit, index) => (
                          <label key={unit.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs hover:bg-muted/40">
                            <Checkbox checked={linkedIds.includes(unit.id)} onCheckedChange={(checked) => void toggleLink(unit.id, checked === true)} />
                            <span>{unitLabel(unit, index)}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <Field label="Bron / onderbouwing huidige waarde of vrijstelling">
                    <RawTextarea initialValue={openComponent.source_note ?? ''} onCommit={(raw) => onUpdate(openComponent.id, { source_note: raw.trim() || null })} />
                  </Field>
                  <Field label="Notities">
                    <RawTextarea initialValue={openComponent.notes ?? ''} onCommit={(raw) => onUpdate(openComponent.id, { notes: raw.trim() || null })} />
                  </Field>

                  <div className="flex justify-between border-t pt-3">
                    <Button variant="destructive" size="sm" onClick={async () => { await onDelete(openComponent.id); setOpenId(null); }}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Verwijderen
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>Sluiten</Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function SummaryTile({ label, value, accent, warning }: { label: string; value: string; accent?: boolean; warning?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${accent ? 'border-primary/35 bg-primary/5' : warning ? 'border-amber-500/40 bg-amber-500/5' : 'bg-background/70'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono-data font-semibold">{value}</p>
    </div>
  );
}
