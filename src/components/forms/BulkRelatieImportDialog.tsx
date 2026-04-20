import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useDataStore } from '@/hooks/useDataStore';
import type { Relatie, LeadStatus, PartijType, AssetClass } from '@/data/mock-data';
import { toast } from 'sonner';
import { Upload, Eye, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Verwachte kolomvolgorde (paste vanuit Excel/CSV):
// bedrijfsnaam | contactpersoon | type | telefoon | email | regio | assetClasses | budgetMin | budgetMax | leadStatus
const KOLOMMEN = [
  'bedrijfsnaam', 'contactpersoon', 'type', 'telefoon', 'email',
  'regio', 'assetClasses', 'budgetMin', 'budgetMax', 'leadStatus',
];

const PARTIJ_TYPES: PartijType[] = ['belegger', 'ontwikkelaar', 'eigenaar', 'makelaar', 'partner', 'overig'];
const LEAD_STATUSES: LeadStatus[] = ['koud', 'lauw', 'warm', 'actief'];

interface ParsedRow {
  raw: string[];
  data: Partial<Relatie>;
  fouten: string[];
}

function splitsRegel(regel: string): string[] {
  // Tab-separated (Excel/Sheets paste) heeft prioriteit, anders comma.
  if (regel.includes('\t')) return regel.split('\t').map(s => s.trim());
  // Eenvoudige CSV (geen geneste quotes)
  return regel.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
}

function parseRows(text: string): ParsedRow[] {
  const regels = text.split(/\r?\n/).map(r => r.trim()).filter(Boolean);
  if (regels.length === 0) return [];

  // Kop overslaan als die letterlijk lijkt op verwachte kolommen
  const eersteVelden = splitsRegel(regels[0]).map(s => s.toLowerCase());
  const heeftHeader = KOLOMMEN.some(k => eersteVelden.includes(k.toLowerCase()));
  const dataRegels = heeftHeader ? regels.slice(1) : regels;

  return dataRegels.map(regel => {
    const velden = splitsRegel(regel);
    const fouten: string[] = [];
    const get = (i: number) => (velden[i] ?? '').trim();

    const typeRaw = get(2).toLowerCase();
    const type = (PARTIJ_TYPES.includes(typeRaw as PartijType) ? typeRaw : 'belegger') as PartijType;
    if (typeRaw && !PARTIJ_TYPES.includes(typeRaw as PartijType)) {
      fouten.push(`Onbekend type "${typeRaw}", gebruikt belegger`);
    }

    const leadRaw = get(9).toLowerCase();
    const leadStatus = (LEAD_STATUSES.includes(leadRaw as LeadStatus) ? leadRaw : 'lauw') as LeadStatus;
    if (leadRaw && !LEAD_STATUSES.includes(leadRaw as LeadStatus)) {
      fouten.push(`Onbekende leadstatus "${leadRaw}", gebruikt lauw`);
    }

    const email = get(4);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fouten.push('Ongeldig e-mailadres');
    }

    const budgetMinRaw = get(7).replace(/[^\d.-]/g, '');
    const budgetMaxRaw = get(8).replace(/[^\d.-]/g, '');
    const budgetMin = budgetMinRaw ? Number(budgetMinRaw) : undefined;
    const budgetMax = budgetMaxRaw ? Number(budgetMaxRaw) : undefined;
    if (budgetMin !== undefined && Number.isNaN(budgetMin)) fouten.push('Budget min ongeldig');
    if (budgetMax !== undefined && Number.isNaN(budgetMax)) fouten.push('Budget max ongeldig');
    if (budgetMin && budgetMax && budgetMin > budgetMax) fouten.push('Budget min > max');

    const data: Partial<Relatie> = {
      bedrijfsnaam: get(0) || 'Onbekend',
      contactpersoon: get(1),
      type,
      telefoon: get(3),
      email,
      regio: get(5).split(/[,;]/).map(s => s.trim()).filter(Boolean),
      assetClasses: get(6).split(/[,;]/).map(s => s.trim()).filter(Boolean) as AssetClass[],
      budgetMin: budgetMin && !Number.isNaN(budgetMin) ? budgetMin : undefined,
      budgetMax: budgetMax && !Number.isNaN(budgetMax) ? budgetMax : undefined,
      leadStatus,
      laatsteContact: new Date().toISOString().split('T')[0],
    };

    return { raw: velden, data, fouten };
  });
}

export default function BulkRelatieImportDialog({ open, onOpenChange }: Props) {
  const { bulkInsertRelaties } = useDataStore();
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);
  const [preview, setPreview] = useState(false);

  const rijen = useMemo(() => (preview ? parseRows(tekst) : []), [tekst, preview]);
  const aantalGeldig = rijen.filter(r => r.fouten.length === 0).length;
  const aantalFout = rijen.length - aantalGeldig;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      setTekst((e.target?.result as string) || '');
      setPreview(true);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (rijen.length === 0) {
      toast.error('Geen rijen om te importeren');
      return;
    }
    setBezig(true);
    try {
      const teImporteren = rijen.map(r => r.data);
      const { ok, fout } = await bulkInsertRelaties(teImporteren);
      if (ok > 0) toast.success(`${ok} relatie(s) geïmporteerd`);
      if (fout > 0) toast.error(`${fout} rij(en) niet opgeslagen`);
      if (ok > 0) {
        setTekst('');
        setPreview(false);
        onOpenChange(false);
      }
    } catch (err: any) {
      toast.error(`Import mislukt: ${err.message ?? 'onbekende fout'}`);
    } finally {
      setBezig(false);
    }
  };

  const reset = () => {
    setTekst('');
    setPreview(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relaties bulk importeren</DialogTitle>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Verwachte kolomvolgorde</p>
              <p className="font-mono break-words">
                {KOLOMMEN.join(' | ')}
              </p>
              <p className="mt-2">
                Plak vanuit Excel/Google Sheets (tab-gescheiden) of CSV. Header is optioneel.
                Regio en asset classes mogen kommagescheiden binnen een kolom.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Plak tabelgegevens</Label>
              <Textarea
                value={tekst}
                onChange={e => setTekst(e.target.value)}
                rows={10}
                className="font-mono text-xs"
                placeholder={'Acme BV\tJan Janssen\tbelegger\t0612345678\tjan@acme.nl\tRandstad\twonen,logistiek\t1000000\t5000000\twarm'}
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-sm border border-border rounded-md hover:bg-muted cursor-pointer">
                <Upload className="h-4 w-4" /> CSV uploaden
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <Button
                type="button"
                onClick={() => setPreview(true)}
                disabled={!tekst.trim()}
                className="ml-auto"
              >
                <Eye className="h-4 w-4 mr-1.5" /> Voorbeeld bekijken
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground font-medium">{rijen.length} rij(en) gedetecteerd</span>
              <span className="text-muted-foreground">
                <span className="text-success">{aantalGeldig} ok</span>
                {aantalFout > 0 && <span className="text-destructive ml-3">{aantalFout} met waarschuwing</span>}
              </span>
            </div>

            <div className="border border-border rounded-md overflow-x-auto max-h-[400px]">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-2">#</th>
                    <th className="text-left px-2 py-2">Bedrijf</th>
                    <th className="text-left px-2 py-2">Contact</th>
                    <th className="text-left px-2 py-2">Type</th>
                    <th className="text-left px-2 py-2">E-mail</th>
                    <th className="text-left px-2 py-2">Budget</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-left px-2 py-2">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rijen.map((r, i) => (
                    <tr key={i} className={r.fouten.length > 0 ? 'bg-destructive/5' : ''}>
                      <td className="px-2 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2 font-medium">{r.data.bedrijfsnaam}</td>
                      <td className="px-2 py-2">{r.data.contactpersoon || '—'}</td>
                      <td className="px-2 py-2 capitalize">{r.data.type}</td>
                      <td className="px-2 py-2">{r.data.email || '—'}</td>
                      <td className="px-2 py-2 tabular-nums">
                        {r.data.budgetMin || r.data.budgetMax ? `${r.data.budgetMin ?? '—'} – ${r.data.budgetMax ?? '—'}` : '—'}
                      </td>
                      <td className="px-2 py-2 capitalize">{r.data.leadStatus}</td>
                      <td className="px-2 py-2">
                        {r.fouten.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertCircle className="h-3 w-3" /> {r.fouten.join(', ')}
                          </span>
                        ) : (
                          <span className="text-success">ok</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPreview(false)}>Terug</Button>
              <Button type="button" onClick={handleImport} disabled={bezig || rijen.length === 0}>
                {bezig ? 'Bezig…' : `Importeer ${rijen.length} relatie(s)`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
