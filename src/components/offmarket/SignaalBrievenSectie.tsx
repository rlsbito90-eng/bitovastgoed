// Tab "Brieven & opvolging" — gegroepeerd per geadresseerde/eigenaar.
//
// Per geadresseerde wordt Brief 1 / Brief 2 / Brief 3 getoond; nooit
// globale Brief 4/5/6-nummering. Conceptversies worden samengeklapt en
// veilige testconcepten kunnen worden opgeschoond.
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import { Mail, Inbox, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOffMarketBrievenForSignaal } from '@/hooks/useOffMarketBrieven';
import { useKadasterDataRecordsForSignaal } from '@/hooks/useKadasterDataRecords';
import { useDataStore } from '@/hooks/useDataStore';
import BriefVoorbereidenKnop from '@/components/offmarket/BriefVoorbereidenKnop';
import BriefVoorbereidenDialog from '@/components/offmarket/BriefVoorbereidenDialog';
import GeadresseerdeKaart, { type EmailContactRegel }
  from '@/components/offmarket/brieven/GeadresseerdeKaart';
import BrievenSamenvattingRegel from '@/components/offmarket/brieven/BrievenSamenvatting';
import OpschoonConceptenDialog from '@/components/offmarket/brieven/OpschoonConceptenDialog';
import MarkeerVerstuurdDialog from '@/components/offmarket/brieven/MarkeerVerstuurdDialog';
import RegistreerResponsDialog from '@/components/offmarket/brieven/RegistreerResponsDialog';
import BriefPDF from '@/components/offmarket/BriefPDF';
import {
  buildBriefViewModel, briefAlsPlatteTekst,
} from '@/lib/offMarket/brief';
import {
  groepeerBrievenPerGeadresseerde, samenvatting,
  type CampagneStap, type GeadresseerdeGroep,
} from '@/lib/offMarket/brieven/groepering';
import type { Responsstatus } from '@/lib/offMarket/brieven/respons';

import { veiligeOpschoonkandidaten } from '@/lib/offMarket/brieven/opschoon';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { ContactMoment } from '@/lib/contactMoments';


interface Props {
  signaal: OffMarketSignaal;
}

function safeFilename(s: string): string {
  return (s || 'brief')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 60) || 'brief';
}

/**
 * Koppel een e-mail-contactmoment aan een geadresseerde-key. We doen dit
 * conservatief op naam-/bedrijfsnaam-substring; geen match → 'overig'.
 */
function emailMatchKey(
  cm: ContactMoment,
  groepen: GeadresseerdeGroep[],
): string | null {
  const hay = `${cm.title ?? ''} ${cm.description ?? ''}`.toLowerCase();
  for (const g of groepen) {
    const naam = (g.naam ?? '').toLowerCase().trim();
    const bedrijf = (g.bedrijfsnaam ?? '').toLowerCase().trim();
    if (naam && naam.length > 2 && hay.includes(naam)) return g.key;
    if (bedrijf && bedrijf.length > 2 && hay.includes(bedrijf)) return g.key;
  }
  return null;
}

export default function SignaalBrievenSectie({ signaal }: Props) {
  const { data: brieven = [], isLoading } = useOffMarketBrievenForSignaal(signaal.id);
  const { data: kadasterRecords = [] } = useKadasterDataRecordsForSignaal(signaal.id);
  const { taken, contactMoments } = useDataStore();

  const groepen = useMemo(() => groepeerBrievenPerGeadresseerde(brieven), [brieven]);
  const sv = useMemo(() => samenvatting(groepen, taken ?? [], signaal.id), [groepen, taken, signaal.id]);
  const kandidaten = useMemo(() => veiligeOpschoonkandidaten(brieven, taken ?? []), [brieven, taken]);

  // E-mailcontactmomenten voor dit signaal, gegroepeerd per geadresseerde-key.
  const emailsPerKey = useMemo(() => {
    const map = new Map<string, EmailContactRegel[]>();
    const overig: EmailContactRegel[] = [];
    const items = (contactMoments ?? []).filter(
      (cm) => cm.offMarketSignaalId === signaal.id && cm.type === 'email',
    );
    for (const cm of items) {
      const regel: EmailContactRegel = {
        id: cm.id,
        datum: cm.momentDate,
        titel: cm.title || 'E-mail',
      };
      const k = emailMatchKey(cm, groepen);
      if (k) {
        const arr = map.get(k) ?? [];
        arr.push(regel);
        map.set(k, arr);
      } else {
        overig.push(regel);
      }
    }
    return { map, overig };
  }, [contactMoments, signaal.id, groepen]);

  // Brief-openen / opvolg-knop state
  const [openBrief, setOpenBrief] = useState<OffMarketBrief | null>(null);
  const [opvolgVoor, setOpvolgVoor] = useState<{ groep: GeadresseerdeGroep; stap: CampagneStap } | null>(null);
  const [markeerBrief, setMarkeerBrief] = useState<OffMarketBrief | null>(null);
  const [responsBrief, setResponsBrief] = useState<{ brief: OffMarketBrief; initialStatus?: Responsstatus } | null>(null);
  const [opschoonOpen, setOpschoonOpen] = useState(false);


  // ---- Acties op een bestaande brief ----
  const handleOpen = (b: OffMarketBrief) => setOpenBrief(b);

  const handleNieuw = (g: GeadresseerdeGroep, stap: CampagneStap) => {
    // Controleer eerst of er al een actief concept bestaat voor dezelfde
    // geadresseerde + stap — open dat dan in plaats van een nieuw record.
    const actief = g.stappen[stap].actiefConcept;
    if (actief) {
      setOpenBrief(actief);
      return;
    }
    setOpvolgVoor({ groep: g, stap });
  };

  const handleDownloadPdf = async (b: OffMarketBrief) => {
    try {
      const vm = buildBriefViewModel({
        eigenaarNaam: b.eigenaar_naam ?? '',
        eigenaarBedrijfsnaam: b.eigenaar_bedrijfsnaam ?? '',
        verzendadres: b.verzendadres ?? '',
        objectomschrijving: b.objectomschrijving ?? '',
        onderwerp: b.onderwerp ?? '',
        brieftekst: b.brieftekst ?? '',
      });
      const blob = await pdf(<BriefPDF vm={vm} />).toBlob();
      const datum = (b.verzonden_op ?? b.created_at ?? new Date().toISOString()).split('T')[0];
      const naam = safeFilename(vm.geadresseerdeNaam || vm.bedrijfsnaam || vm.objectomschrijving);
      const filename = `Bito-brief-${naam}-${datum}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('PDF gegenereerd');
    } catch (e: any) {
      toast.error(`PDF genereren mislukt: ${e?.message ?? 'onbekende fout'}`);
    }
  };

  const handleKopieer = async (b: OffMarketBrief) => {
    try {
      const vm = buildBriefViewModel({
        eigenaarNaam: b.eigenaar_naam ?? '',
        eigenaarBedrijfsnaam: b.eigenaar_bedrijfsnaam ?? '',
        verzendadres: b.verzendadres ?? '',
        objectomschrijving: b.objectomschrijving ?? '',
        onderwerp: b.onderwerp ?? '',
        brieftekst: b.brieftekst ?? '',
      });
      await navigator.clipboard.writeText(briefAlsPlatteTekst(vm));
      toast.success('Brief gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const handleMarkeerVerstuurd = (b: OffMarketBrief) => setMarkeerBrief(b);

  // Label voor forceKandidaatLabel — exposeert in BriefVoorbereidenDialog
  // de juiste geadresseerde-context bij "Nieuwe opvolgbrief".
  const forceLabel = useMemo(() => {
    if (!opvolgVoor) return null;
    const g = opvolgVoor.groep;
    return g.bedrijfsnaam || g.naam;
  }, [opvolgVoor]);

  return (
    <section className="section-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Brieven & opvolging
        </h2>
        <div className="flex items-center gap-2">
          {kandidaten.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpschoonOpen(true)}
              data-testid="brieven-opschonen-knop"
              className="text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Opschonen ({kandidaten.length})
            </Button>
          )}
          <BriefVoorbereidenKnop signaal={signaal} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Brieven laden…</p>
      ) : groepen.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nog geen brieven voorbereid voor dit signaal.
        </p>
      ) : (
        <>
          <BrievenSamenvattingRegel data={sv} />
          <div className="space-y-3">
            {groepen.map((g) => (
              <GeadresseerdeKaart
                key={g.key}
                groep={g}
                emails={emailsPerKey.map.get(g.key) ?? []}
                onOpenBrief={handleOpen}
                onNieuweBrief={handleNieuw}
                onDownloadPdf={handleDownloadPdf}
                onKopieer={handleKopieer}
                onMarkeerVerstuurd={handleMarkeerVerstuurd}
              />
            ))}
          </div>
        </>
      )}

      {emailsPerKey.overig.length > 0 && (
        <div className="rounded-md border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Overige contactpogingen
          </p>
          <ul className="space-y-1">
            {emailsPerKey.overig.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-xs text-foreground">
                <Inbox className="h-3 w-3 text-muted-foreground" />
                <span className="tabular-nums text-muted-foreground">
                  {new Date(e.datum).toLocaleDateString('nl-NL')}
                </span>
                <span className="opacity-40">·</span>
                <span className="truncate">{e.titel}</span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] text-muted-foreground italic">
            Niet betrouwbaar te koppelen aan een specifieke geadresseerde.
          </p>
        </div>
      )}

      {/* Open bestaande brief (concept of verstuurd) */}
      {openBrief && (
        <BriefVoorbereidenDialog
          open={!!openBrief}
          onOpenChange={(v) => { if (!v) setOpenBrief(null); }}
          signaal={signaal}
          kadasterRecords={kadasterRecords}
          historischeBrieven={brieven}
          initialBrief={openBrief}
        />
      )}

      {/* Nieuwe opvolgbrief voor één specifieke geadresseerde */}
      {opvolgVoor && (
        <BriefVoorbereidenDialog
          open={!!opvolgVoor}
          onOpenChange={(v) => { if (!v) setOpvolgVoor(null); }}
          signaal={signaal}
          kadasterRecords={kadasterRecords}
          historischeBrieven={brieven}
          forceKandidaatLabel={forceLabel}
        />
      )}

      {/* Markeer als verstuurd */}
      <MarkeerVerstuurdDialog
        open={!!markeerBrief}
        onOpenChange={(v) => { if (!v) setMarkeerBrief(null); }}
        brief={markeerBrief}
        signaalId={signaal.id}
        relatieId={(signaal as any).eigenaar_relatie_id ?? null}
      />

      {/* Opschoon-dialoog */}
      <OpschoonConceptenDialog
        open={opschoonOpen}
        onOpenChange={setOpschoonOpen}
        kandidaten={kandidaten}
      />

    </section>
  );
}
