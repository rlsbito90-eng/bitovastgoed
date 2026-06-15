// Inline-bewerkbare classificatieblok voor een off-market signaal.
// Werkt direct met `useUpdateOffMarketSignaal` (autosave on change), zodat
// dit blok prominent in de Overzicht-tab kan staan zonder modal.
import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useUpdateOffMarketSignaal } from '@/hooks/useOffMarketSignalen';
import {
  ASSETTYPE_LABEL, ASSETTYPE_VOLGORDE, STRATEGIE_OPTIES,
  STATUS_LABEL, STATUS_VOLGORDE, PRIORITEIT_LABEL, PRIORITEIT_VOLGORDE,
  SIGNAALTYPE_LABEL,
  type OffMarketAssettype, type OffMarketSignaaltype, type OffMarketStatus,
  type OffMarketPrioriteit, type OffMarketSignaal,
} from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  onOpenFullForm?: () => void;
}

export default function SignaalClassificatieBlok({ signaal, onOpenFullForm }: Props) {
  const update = useUpdateOffMarketSignaal();
  const [omschrijving, setOmschrijving] = useState(signaal.omschrijving ?? '');
  const [omschrijvingDirty, setOmschrijvingDirty] = useState(false);

  const isEenVanOpties = STRATEGIE_OPTIES.includes(signaal.potentiele_strategie as any);
  const strategieValue: string = signaal.potentiele_strategie
    ? (isEenVanOpties ? signaal.potentiele_strategie : '__anders__')
    : '';

  const handlePatch = async (patch: Partial<Record<string, any>>, label: string) => {
    try {
      await update.mutateAsync({ id: signaal.id, patch });
      toast.success(`${label} bijgewerkt`);
    } catch (e: any) {
      toast.error(e?.message ?? 'Bijwerken mislukt');
    }
  };

  const slaOmschrijvingOp = async () => {
    await handlePatch({ omschrijving: omschrijving.trim() || null }, 'Omschrijving');
    setOmschrijvingDirty(false);
  };

  return (
    <section className="section-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Classificatie</h2>
        {onOpenFullForm && (
          <Button variant="outline" size="sm" onClick={onOpenFullForm}>
            <Pencil className="h-3.5 w-3.5" /> Volledig bewerken
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Veld label="Assettype">
          <Select
            value={signaal.assettype}
            onValueChange={(v) => handlePatch({ assettype: v as OffMarketAssettype }, 'Assettype')}
            disabled={update.isPending}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              {ASSETTYPE_VOLGORDE.map((a) => (
                <SelectItem key={a} value={a}>{ASSETTYPE_LABEL[a]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Veld>

        <Veld label="Strategie">
          <Select
            value={strategieValue || undefined}
            onValueChange={(v) => {
              if (v === '__anders__') return; // alleen via Input hieronder
              handlePatch({ potentiele_strategie: v }, 'Strategie');
            }}
            disabled={update.isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Kies strategie" />
            </SelectTrigger>
            <SelectContent>
              {STRATEGIE_OPTIES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              <SelectItem value="__anders__">Anders…</SelectItem>
            </SelectContent>
          </Select>
          {strategieValue === '__anders__' && (
            <Input
              className="mt-2"
              defaultValue={signaal.potentiele_strategie ?? ''}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== signaal.potentiele_strategie) {
                  handlePatch({ potentiele_strategie: v }, 'Strategie');
                }
              }}
              placeholder="Eigen strategie…"
            />
          )}
        </Veld>

        <Veld label="Type signaal">
          <Select
            value={signaal.type_signaal}
            onValueChange={(v) => handlePatch({ type_signaal: v as OffMarketSignaaltype }, 'Type signaal')}
            disabled={update.isPending}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(SIGNAALTYPE_LABEL) as OffMarketSignaaltype[]).map((t) => (
                <SelectItem key={t} value={t}>{SIGNAALTYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Veld>

        <div className="grid grid-cols-2 gap-3">
          <Veld label="Status">
            <Select
              value={signaal.status}
              onValueChange={(v) => handlePatch({ status: v as OffMarketStatus }, 'Status')}
              disabled={update.isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_VOLGORDE.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Veld>
          <Veld label="Prioriteit">
            <Select
              value={signaal.prioriteit}
              onValueChange={(v) => handlePatch({ prioriteit: v as OffMarketPrioriteit }, 'Prioriteit')}
              disabled={update.isPending}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITEIT_VOLGORDE.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITEIT_LABEL[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Veld>
        </div>
      </div>

      <Veld label="Omschrijving">
        <Input
          value={omschrijving}
          onChange={(e) => { setOmschrijving(e.target.value); setOmschrijvingDirty(true); }}
          onBlur={() => { if (omschrijvingDirty) slaOmschrijvingOp(); }}
          placeholder="Korte beschrijving van het signaal…"
        />
      </Veld>
    </section>
  );
}

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">{label}</p>
      {children}
    </div>
  );
}
