import { Landmark, Mail, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SignaalOnderzoeksacties from '@/components/offmarket/SignaalOnderzoeksacties';
import SignaalGebiedsindeling from '@/components/offmarket/SignaalGebiedsindeling';
import BagOverzichtKaart from '@/components/offmarket/bag/BagOverzichtKaart';
import SignaalKadasterKaart from '@/components/offmarket/kadaster/SignaalKadasterKaart';
import { KadasterAdresPreferenceProvider } from '@/components/offmarket/kadaster/KadasterAdresPreferenceContext';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import SignaalBrievenSectie from '@/components/offmarket/SignaalBrievenSectie';
import AutomatischeKadasterPdfEigenaarVerrijking from './AutomatischeKadasterPdfEigenaarVerrijking';
import KadasterBronOverzicht from './KadasterBronOverzicht';
import KadasterBerichtOpenKnop from './KadasterBerichtOpenKnop';
import ProductiekernBriefActies from './ProductiekernBriefActies';
import { parseObjectAdres } from '@/lib/kadaster/adres';
import {
  VERGUNNINGTYPE_LABEL,
  type OffMarketSignaal,
  type OffMarketVergunningtype,
} from '@/lib/offMarket/types';
import type { FocusContextInfo } from '@/lib/offMarket/acquisitie/focusContext';

interface Props {
  signaal: OffMarketSignaal;
  focusContext: FocusContextInfo;
}

function scrollNaar(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function Kernwaarde({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2 min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground break-words">{waarde || '—'}</p>
    </div>
  );
}

export default function FocusWerkInhoud({ signaal, focusContext }: Props) {
  if (focusContext.context !== 'onderzoeken') {
    return (
      <section data-testid="focus-brieven-inhoud" className="space-y-2 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Brieven &amp; opvolging is de primaire werkcontext voor deze stap.
          </div>
          <KadasterBerichtOpenKnop signaalId={signaal.id} hideWhenMissing />
        </div>
        <SignaalBrievenSectie signaal={signaal} />
        <ProductiekernBriefActies signaalId={signaal.id} />
      </section>
    );
  }

  const vergunningtype = signaal.vergunningtype
    ? VERGUNNINGTYPE_LABEL[signaal.vergunningtype as OffMarketVergunningtype]
    : '—';
  const aiScore = typeof signaal.ai_score === 'number' ? String(signaal.ai_score) : '—';
  const verkoopkans = typeof signaal.ai_verkoopkans === 'number'
    ? `${Math.round(Number(signaal.ai_verkoopkans) * 100)}%`
    : '—';
  const omschrijving = signaal.omschrijving?.trim() || 'Nog geen omschrijving vastgelegd.';
  const parsedAdres = parseObjectAdres(
    signaal.adres ?? signaal.titel ?? '',
    signaal.postcode ?? null,
    signaal.plaats ?? null,
  );
  const eersteHuisnummer = parsedAdres.huisnummers[0] ?? null;
  // Alleen een expliciete letter/toevoeging uit het signaal mag de H → 1 → A-regel overrulen.
  // Een kaal nummer "11" is dus GEEN expliciete voorkeur.
  const voorkeursHuisnummerLabel = eersteHuisnummer && (eersteHuisnummer.huisletter || eersteHuisnummer.toevoeging)
    ? eersteHuisnummer.label
    : null;

  return (
    <div data-testid="focus-onderzoeken-inhoud" className="space-y-4 min-w-0 w-full overflow-x-hidden">
      <nav className="grid grid-cols-3 gap-2 w-full" aria-label="Onderzoekssecties">
        <Button type="button" variant="outline" size="sm" onClick={() => scrollNaar('focus-onderzoek')} className="min-w-0 px-2">
          <Search className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Onderzoek</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => scrollNaar('focus-bag')} className="min-w-0 px-2">
          BAG
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => scrollNaar('focus-kadaster')} className="min-w-0 px-2">
          <Landmark className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Kadaster</span>
        </Button>
      </nav>

      <section className="space-y-2 min-w-0" aria-label="Onderzoekskern">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 min-w-0">
          <Kernwaarde label="Vergunningtype" waarde={vergunningtype} />
          <Kernwaarde label="AI-score" waarde={aiScore} />
          <Kernwaarde label="Verkoopkans" waarde={verkoopkans} />
        </div>
        <div className="rounded-md border border-border bg-card px-3 py-2 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Omschrijving uit classificatie</p>
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{omschrijving}</p>
        </div>
      </section>

      {/*
       * Een formeel dossier start generiek bij eigenaar_achterhalen. Bestaande
       * CRM-selecties kunnen echter al een volledig postconcept bevatten. Mount
       * de Productiekern-bridge daarom ook hier: het component rendert zelf
       * uitsluitend bij een geldige selectie + postconcept en blijft anders
       * volledig onzichtbaar. De expliciete BR-actie verplaatst het dossier pas
       * na bevestiging transactioneel naar brief_opstellen.
       */}
      <ProductiekernBriefActies signaalId={signaal.id} />

      <div id="focus-onderzoek" className="scroll-mt-4 space-y-4 min-w-0">
        <SignaalOnderzoeksacties signaal={signaal} />
        <SignaalGebiedsindeling signaal={signaal} />
      </div>

      <details id="focus-bag" className="scroll-mt-4 rounded-lg border border-border bg-card/40 min-w-0 overflow-hidden">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
          BAG-overzicht
          <span className="ml-2 text-xs font-normal text-muted-foreground">standaard ingeklapt</span>
        </summary>
        <div className="px-2 pb-2 min-w-0">
          <BagOverzichtKaart signaal={signaal} onOpenKadaster={() => scrollNaar('focus-kadaster')} />
        </div>
      </details>

      <div id="focus-kadaster" className="scroll-mt-4 space-y-4 min-w-0">
        <AutomatischeKadasterPdfEigenaarVerrijking signaalId={signaal.id} />
        <KadasterAdresPreferenceProvider value={voorkeursHuisnummerLabel}>
          <SignaalKadasterKaart key={`kadaster-${signaal.id}`} signaal={signaal} />
        </KadasterAdresPreferenceProvider>
        <KadasterBronOverzicht signaalId={signaal.id} />
        <SignaalEigenaarsonderzoekSectie key={`eigenaar-${signaal.id}`} signaal={signaal} focusMode />
      </div>
    </div>
  );
}
