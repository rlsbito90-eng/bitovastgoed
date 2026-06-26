// BriefVoorbereidenDialog — V1.3 Off-Market signaal.
//
// Wijzigingen t.o.v. V1.1/V1.2:
//  - Eén centraal viewmodel (`buildBriefViewModel`) gedeeld door modal,
//    kopieeractie en PDF;
//  - Echte PDF-generatie via @react-pdf/renderer (geen iframe / geen
//    about:srcdoc / geen browserheader/-footer);
//  - Verzendadres wordt zichtbaar in de modal als geadresseerde-preview
//    (zelfde data als in de PDF);
//  - "Download PDF" als primaire actie, "Print brief" valt weg;
//  - Bevestiging als verzendadres ontbreekt vóór PDF en vóór verstuurd.
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { pdf } from '@react-pdf/renderer';
import { Copy, FileDown, Send, FileText, Loader2, Save, Mail, Inbox } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ModalActionBar } from '@/components/ui/modal-action-bar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  bouwBriefPrefill, bepaalAanhef, bepaalOnderwerp, bouwBriefTekst,
  buildBriefViewModel, briefAlsPlatteTekst,
  buildKadasterAdresDebug, kadasterAdresKandidaten,
  VERZENDADRES_PLACEHOLDER, type HistorischBriefAdres,
} from '@/lib/offMarket/brief';
import BriefPDF from '@/components/offmarket/BriefPDF';
import {
  useUpsertBrief, useMarkBriefVerstuurd,
  useOffMarketBrievenForSignaal,
} from '@/hooks/useOffMarketBrieven';
import { useUpdateVerzendstatus } from '@/hooks/useUpdateVerzendstatus';
import { useDataStore } from '@/hooks/useDataStore';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { logBriefEvent } from '@/lib/offMarket/brieven/events';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';
import { deadlineOverDagen } from '@/lib/offMarket/eigenaar';
import {
  buildEmailTemplate, defaultFollowupDagen, volgendeEmailStap,
  EMAIL_PROFIEL_LABEL, EMAIL_PROFIEL_VOLGORDE, type EmailProfiel,
} from '@/lib/offMarket/email/emailProfielen';
import type { Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { KadasterDataRecord } from '@/hooks/useKadasterDataRecords';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signaal: OffMarketSignaal;
  kadasterRecords: KadasterDataRecord[];
  historischeBrieven?: HistorischBriefAdres[];
  /**
   * Open een bestaand briefrecord (concept of verstuurd) i.p.v. een nieuw
   * concept aan te maken. Wordt gebruikt vanuit de geadresseerdekaart om
   * te voorkomen dat per klik een nieuw record ontstaat.
   */
  initialBrief?: OffMarketBrief | null;
  /**
   * Forceer een specifieke geadresseerde-kandidaat (op label) bij het
   * starten van een nieuwe brief — zodat "Nieuwe opvolgbrief" voor één
   * eigenaar werkt en niet automatisch voor alle eigenaren tegelijk.
   */
  forceKandidaatLabel?: string | null;
}

function isEchteWaarde(v: string | null | undefined): boolean {
  if (!v) return false;
  const norm = v.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!norm) return false;
  const ph = VERZENDADRES_PLACEHOLDER.replace(/\s+/g, ' ').trim().toLowerCase();
  return norm !== ph;
}

function safeFilename(s: string): string {
  return (s || 'brief')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim().replace(/\s+/g, '-').slice(0, 60) || 'brief';
}

export default function BriefVoorbereidenDialog({
  open, onOpenChange, signaal, kadasterRecords, historischeBrieven = [],
  initialBrief = null, forceKandidaatLabel = null,
}: Props) {
  const prefill = useMemo(
    () => bouwBriefPrefill(signaal, kadasterRecords, historischeBrieven),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signaal.id, kadasterRecords.length, historischeBrieven.length, open],
  );
  const kadasterAdresDebug = useMemo(() => buildKadasterAdresDebug(kadasterRecords), [kadasterRecords]);
  const kadasterAdresOpties = useMemo(() => kadasterAdresKandidaten(kadasterRecords), [kadasterRecords]);
  const overneemAdresOpties = useMemo(() => {
    if (kadasterAdresOpties.length > 0) return kadasterAdresOpties;
    return historischeBrieven
      .filter(b => isEchteWaarde(b.verzendadres))
      .map((b, i) => ({
        naam: b.eigenaar_naam ?? null,
        bedrijfsnaam: b.eigenaar_bedrijfsnaam ?? null,
        verzendadres: b.verzendadres!.trim(),
        recordId: `brief-${i}`,
        fetchedAt: b.updated_at ?? b.created_at ?? null,
        debugBron: 'Eerder opgeslagen briefadres bij dit signaal',
      }));
  }, [kadasterAdresOpties, historischeBrieven]);

  const [kandidaatLabel, setKandidaatLabel] = useState<string>(prefill.kandidaten[0]?.label ?? '');
  const [eigenaarNaam, setEigenaarNaam] = useState(initialBrief?.eigenaar_naam ?? prefill.eigenaarNaam);
  const [eigenaarBedrijfsnaam, setEigenaarBedrijfsnaam] = useState(initialBrief?.eigenaar_bedrijfsnaam ?? prefill.eigenaarBedrijfsnaam);
  const [verzendadres, setVerzendadres] = useState(initialBrief?.verzendadres ?? prefill.verzendadres);
  const [objectadres, setObjectadres] = useState(initialBrief?.objectadres ?? prefill.objectadres);
  const [objectomschrijving, setObjectomschrijving] = useState(initialBrief?.objectomschrijving ?? prefill.objectomschrijving);
  const [aanhef, setAanhef] = useState(initialBrief?.aanhef ?? prefill.aanhef);
  const [onderwerp, setOnderwerp] = useState(initialBrief?.onderwerp ?? prefill.onderwerp);
  const [brieftekst, setBrieftekst] = useState(initialBrief?.brieftekst ?? prefill.brieftekst);
  const [briefId, setBriefId] = useState<string | null>(initialBrief?.id ?? null);
  const [bezig, setBezig] = useState(false);
  const [pdfBezig, setPdfBezig] = useState(false);
  const [kadasterAdresKey, setKadasterAdresKey] = useState('0');
  const [onderwerpHandmatig, setOnderwerpHandmatig] = useState(!!initialBrief);

  // V2.2 — kanaal & e-mailprofiel
  const initialKanaal: Kanaal = (initialBrief?.kanaal as Kanaal | undefined) ?? 'post';
  const [kanaal, setKanaal] = useState<Kanaal>(initialKanaal);
  const [emailProfiel, setEmailProfiel] = useState<EmailProfiel>('algemene_acquisitie');
  // Houd bij of de gebruiker de e-mailtekst handmatig heeft aangepast,
  // zodat we templates niet ongevraagd overschrijven.
  const [emailTekstHandmatig, setEmailTekstHandmatig] = useState(!!initialBrief);

  useEffect(() => {
    if (!open) return;
    if (initialBrief) {
      // Bestaande brief openen — gebruik die data, geen nieuw record aanmaken.
      // Voor het verzendadres geldt een veilige prefill-fallback: alleen
      // wanneer het opgeslagen adres leeg/placeholder is mag de
      // betrouwbare prefill-bron als initiële waarde dienen. Een
      // niet-lege opgeslagen waarde wordt nooit overschreven.
      const opgeslagenAdres = (initialBrief.verzendadres ?? '').trim();
      const adresInitial = isEchteWaarde(opgeslagenAdres)
        ? opgeslagenAdres
        : (prefill.verzendadres ?? '');
      setKandidaatLabel(forceKandidaatLabel ?? '');
      setEigenaarNaam(initialBrief.eigenaar_naam ?? '');
      setEigenaarBedrijfsnaam(initialBrief.eigenaar_bedrijfsnaam ?? '');
      setVerzendadres(adresInitial);
      setObjectadres(initialBrief.objectadres ?? '');
      setObjectomschrijving(initialBrief.objectomschrijving ?? '');
      setAanhef(initialBrief.aanhef ?? '');
      setOnderwerp(initialBrief.onderwerp ?? '');
      setBrieftekst(initialBrief.brieftekst ?? '');
      setBriefId(initialBrief.id);
      setOnderwerpHandmatig(true);
      setKanaal((initialBrief.kanaal as Kanaal | undefined) ?? 'post');
      setEmailTekstHandmatig(true);
      return;
    }
    const forced = forceKandidaatLabel
      ? prefill.kandidaten.find(x => x.label === forceKandidaatLabel) ?? null
      : null;
    const k = forced ?? prefill.kandidaten[0] ?? null;
    setKandidaatLabel(k?.label ?? '');
    setEigenaarNaam(forced?.naam ?? prefill.eigenaarNaam);
    setEigenaarBedrijfsnaam(forced?.bedrijfsnaam ?? prefill.eigenaarBedrijfsnaam);
    setVerzendadres(forced?.verzendadres ?? prefill.verzendadres);
    setObjectadres(prefill.objectadres);
    setObjectomschrijving(prefill.objectomschrijving);
    setAanhef(forced ? bepaalAanhef(forced.naam) : prefill.aanhef);
    setOnderwerp(prefill.onderwerp);
    setBrieftekst(prefill.brieftekst);
    setBriefId(null);
    setOnderwerpHandmatig(false);
    setKanaal('post');
    setEmailTekstHandmatig(false);
  }, [open, prefill, initialBrief, forceKandidaatLabel]);

  // Brieven van dit signaal — voor het bepalen van de volgende e-mailstap.
  const { data: signaalBrieven = [] } = useOffMarketBrievenForSignaal(signaal.id);

  const upsert = useUpsertBrief();
  const markVerstuurd = useMarkBriefVerstuurd();
  const updateVerzendstatus = useUpdateVerzendstatus();

  const { addTaak, taken } = useDataStore();

  // Centraal viewmodel — exact dezelfde data gebruikt door modal-preview,
  // kopieerbrief én PDF.
  const vm = useMemo(
    () => buildBriefViewModel({
      eigenaarNaam, eigenaarBedrijfsnaam,
      verzendadres, objectomschrijving, onderwerp, brieftekst,
    }),
    [eigenaarNaam, eigenaarBedrijfsnaam, verzendadres, objectomschrijving, onderwerp, brieftekst],
  );

  const handleKandidaatWissel = (label: string) => {
    setKandidaatLabel(label);
    const k = prefill.kandidaten.find(x => x.label === label);
    if (k) {
      setEigenaarNaam(k.naam ?? '');
      setEigenaarBedrijfsnaam(k.bedrijfsnaam ?? '');
      if (k.verzendadres) setVerzendadres(k.verzendadres);
      const nieuweAanhef = bepaalAanhef(k.naam);
      setAanhef(nieuweAanhef);
      setBrieftekst(bouwBriefTekst({ aanhef: nieuweAanhef, objectadres: objectomschrijving }));
    }
  };

  const herstelStandaard = () => {
    setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));
    toast.success('Standaardtekst hersteld');
  };

  const neemVerzendadresOverUitKadaster = () => {
    if (overneemAdresOpties.length === 0) {
      toast.error('Geen gestructureerd verzendadres gevonden. Vul het verzendadres handmatig in.');
      return;
    }
    const idx = Number(kadasterAdresKey || 0);
    const k = overneemAdresOpties[Number.isFinite(idx) ? idx : 0] ?? overneemAdresOpties[0];
    if (!k.verzendadres) return;
    if (isEchteWaarde(verzendadres) && verzendadres.trim() !== k.verzendadres.trim()) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Er staat al een verzendadres ingevuld. Wilt u dit overschrijven met het Kadasteradres?')
        : true;
      if (!ok) return;
    }
    setEigenaarNaam(k.naam ?? eigenaarNaam);
    setEigenaarBedrijfsnaam(k.bedrijfsnaam ?? eigenaarBedrijfsnaam);
    setVerzendadres(k.verzendadres);
    toast.success('Verzendadres overgenomen uit Kadasterbericht');
  };

  const verzendadresVoorOpslag = (): string | null =>
    isEchteWaarde(verzendadres) ? verzendadres.trim() : null;

  // Bepaal welke campagne-stap geldt voor een nieuwe brief in dit kanaal.
  const huidigeCampagneStap = useMemo<string>(() => {
    if (initialBrief?.campagne_stap) return initialBrief.campagne_stap as string;
    if (kanaal === 'email') return volgendeEmailStap(signaalBrieven);
    return 'brief_1';
  }, [initialBrief, kanaal, signaalBrieven]);

  const ensureBriefOpgeslagen = async (status: 'concept' | 'verstuurd' = 'concept'): Promise<string | null> => {
    try {
      const res = await upsert.mutateAsync({
        id: briefId ?? undefined,
        signaal_id: signaal.id,
        eigenaar_naam: eigenaarNaam || null,
        eigenaar_bedrijfsnaam: eigenaarBedrijfsnaam || null,
        verzendadres: verzendadresVoorOpslag(),
        objectadres: objectadres || null,
        objectomschrijving: objectomschrijving || null,
        aanhef, onderwerp, brieftekst,
        status,
        kanaal,
        campagne_stap: huidigeCampagneStap as any,
      });
      setBriefId(res.id);
      // E-mailprofiel apart loggen als metadata-event (geen extra kolom).
      if (kanaal === 'email' && !briefId) {
        await logBriefEvent({
          signaal_id: signaal.id,
          brief_id: res.id,
          geadresseerde_key: res.geadresseerde_key ?? null,
          campagne_stap: huidigeCampagneStap,
          kanaal: 'email',
          event_type: 'concept_created',
          status: status,
          metadata: { kanaal: 'email', email_profiel: emailProfiel },
        });
      }
      return res.id;
    } catch (e: any) {
      toast.error(e?.message ?? 'Opslaan brief mislukt');
      return null;
    }
  };

  const opslaanAlsConcept = async () => {
    setBezig(true);
    try {
      const id = await ensureBriefOpgeslagen('concept');
      if (id) toast.success(kanaal === 'email' ? 'E-mailconcept opgeslagen' : 'Brief opgeslagen als concept');
    } finally {
      setBezig(false);
    }
  };

  const kopieer = async () => {
    try {
      await navigator.clipboard.writeText(briefAlsPlatteTekst(vm));
      toast.success('Brief gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  /** V2.2 — kopieer onderwerp + e-mailtekst en log audit-event. Geen verzending. */
  const kopieerEmail = async () => {
    try {
      const tekst = `Onderwerp: ${onderwerp}\n\n${brieftekst}`;
      await navigator.clipboard.writeText(tekst);
      toast.success('E-mailtekst gekopieerd');
      await logBriefEvent({
        signaal_id: signaal.id,
        brief_id: briefId,
        campagne_stap: huidigeCampagneStap,
        kanaal: 'email',
        event_type: 'email_text_copied',
        metadata: { email_profiel: emailProfiel },
      });
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  /** V2.2 — pas template van het gekozen profiel opnieuw toe. */
  const pasTemplateToe = (profiel: EmailProfiel) => {
    const t = buildEmailTemplate({
      profiel,
      adres: objectomschrijving || objectadres || null,
      plaats: signaal.plaats ?? null,
      geadresseerdeNaam: eigenaarNaam || null,
      bedrijfsnaam: eigenaarBedrijfsnaam || null,
    });
    setOnderwerp(t.onderwerp);
    setBrieftekst(t.brieftekst);
    setOnderwerpHandmatig(false);
    setEmailTekstHandmatig(false);
  };

  // Bij switch naar e-mail: vul template in als de tekst nog niet handmatig
  // is aangepast. Bij switch terug naar post wordt de bestaande tekst
  // niet aangeraakt (gebruiker kan handmatig herstellen).
  useEffect(() => {
    if (kanaal !== 'email') return;
    if (emailTekstHandmatig) return;
    pasTemplateToe(emailProfiel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanaal, emailProfiel]);

  const downloadPdf = async () => {
    if (!vm.heeftVerzendadres) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Er is geen verzendadres ingevuld. Wilt u toch doorgaan met het genereren van de PDF?')
        : true;
      if (!ok) return;
    }
    setPdfBezig(true);
    try {
      // PDF-generatie zelf is mutatievrij — geen insert op off_market_brieven.
      const blob = await pdf(<BriefPDF vm={vm} />).toBlob();
      const datum = new Date().toISOString().split('T')[0];
      const naam = safeFilename(vm.geadresseerdeNaam || vm.bedrijfsnaam || vm.objectomschrijving);
      const filename = `Bito-brief-${naam}-${datum}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (briefId) {
        // Alleen wanneer er al een briefrecord bestaat → upgrade verzendstatus
        // van concept naar pdf_gegenereerd + audit-event. Geen insert.
        await updateVerzendstatus.mutateAsync({
          id: briefId,
          signaal_id: signaal.id,
          campagne_stap: (initialBrief?.campagne_stap as any) ?? null,
          kanaal: (initialBrief?.kanaal as any) ?? 'post',
          nieuweStatus: 'pdf_gegenereerd',
          event: 'pdf_generated',
        });
      } else {
        // Geen bestaand record → alleen audit-event loggen, geen insert.
        await logBriefEvent({
          signaal_id: signaal.id,
          brief_id: null,
          event_type: 'pdf_generated',
          status: 'pdf_gegenereerd',
          metadata: { context: 'voorbereiden_zonder_record' },
        });
      }

      toast.success(briefId
        ? 'PDF gegenereerd'
        : 'PDF gegenereerd — sla op als concept om verzendstatus te bewaren');
    } catch (e: any) {
      console.error('PDF genereren mislukt', e);
      toast.error(`PDF genereren mislukt: ${e?.message ?? 'onbekende fout'}`);
    } finally {
      setPdfBezig(false);
    }
  };


  const markeerVerstuurd = async () => {
    const isEmail = kanaal === 'email';
    if (!isEmail && !vm.heeftVerzendadres) {
      const ok = typeof window !== 'undefined'
        ? window.confirm('Er is geen verzendadres ingevuld. Weet u zeker dat u deze brief als verstuurd wilt markeren?')
        : true;
      if (!ok) return;
    }
    setBezig(true);
    try {
      // Altijd huidige formstate persisteren vóór de verzendregistratie,
      // zodat naam/bedrijf/verzendadres/objectomschrijving/aanhef/
      // onderwerp/tekst/kanaal/campagne_stap bewaard blijven — ook bij
      // een bestaand briefrecord. useUpsertBrief raakt status/
      // verzendstatus/kanaal niet aan wanneer er een id is, dus een
      // reeds verstuurd record wordt niet teruggedraaid naar concept.
      const id = await ensureBriefOpgeslagen('concept');
      if (!id) return;


      const vandaag = new Date().toISOString().slice(0, 10);
      const dagen = defaultFollowupDagen(kanaal);
      const opvolgdatum = berekenFollowUpDeadline(vandaag, dagen);
      const geadresseerdeLabel =
        vm.bedrijfsnaam || vm.geadresseerdeNaam || 'eigenaar/rechthebbende';

      // Bouw kanaal-specifieke taakinformatie.
      const stapNummer = huidigeCampagneStap.endsWith('_2') ? 2
        : huidigeCampagneStap.endsWith('_3') ? 3 : 1;
      const taakTitel = isEmail
        ? `E-mail opvolgen — ${geadresseerdeLabel} — E-mail ${stapNummer}`
        : 'Brief 2 voorbereiden / opvolgen';
      const taakRegex = isEmail ? /e-mail opvolgen/i : /brief\s*2|brief opvolgen/i;

      let taakId: string | null = null;
      try {
        const eigenaarKey = (eigenaarNaam || eigenaarBedrijfsnaam || '').trim().toLowerCase();
        const bestaande = (taken ?? []).find((t: any) =>
          t?.offMarketSignaalId === signaal.id
          && t?.status === 'open'
          && typeof t?.titel === 'string'
          && taakRegex.test(t.titel)
          && (!eigenaarKey || (t.notities ?? '').toLowerCase().includes(eigenaarKey)),
        );
        if (bestaande) {
          taakId = bestaande.id ?? null;
        } else {
          const notities = isEmail
            ? `Volg op naar aanleiding van de e-mail aan ${geadresseerdeLabel} (${vm.objectomschrijving || objectadres || signaal.titel}).`
            : `Bereid Brief 2 voor of neem opvolgend contact op naar aanleiding van de eerste brief aan ${geadresseerdeLabel} (${vm.objectomschrijving || objectadres || signaal.titel}).`;
          const nieuw = await addTaak({
            titel: taakTitel,
            type: 'Follow-up',
            deadline: opvolgdatum || deadlineOverDagen(dagen),
            prioriteit: 'normaal',
            status: 'open',
            offMarketSignaalId: signaal.id,
            relatieId: (signaal as any).eigenaar_relatie_id ?? undefined,
            notities,
          } as any);
          taakId = nieuw?.id ?? null;
        }
      } catch (e) { console.warn('Opvolgtaak aanmaken mislukt', e); }

      await markVerstuurd.mutateAsync({
        id, postdatum: vandaag, gekoppelde_taak_id: taakId,
        kanaal,
        email_profiel: isEmail ? emailProfiel : null,
      });

      try {
        await logSystemContactMoment({
          type: isEmail ? 'email' : 'notitie',
          title: isEmail ? 'E-mail verzonden' : 'Brief verzonden',
          description: `${isEmail ? 'E-mail' : 'Brief'} verzonden naar eigenaar/rechthebbende: ${geadresseerdeLabel}${(vm.objectomschrijving || objectadres) ? ` · ${vm.objectomschrijving || objectadres}` : ''}.`,
          offMarketSignaalId: signaal.id,
          relatieId: (signaal as any).eigenaar_relatie_id ?? null,
          systemKey: `off_market_brief_verstuurd:${id}`,
        });
      } catch (e) { console.warn('Contactmoment loggen mislukt', e); }

      toast.success(isEmail ? 'E-mail gemarkeerd als verzonden' : 'Brief gemarkeerd als verstuurd');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Markeren als verstuurd mislukt');
    } finally {
      setBezig(false);
    }
  };


  const kandidaten = prefill.kandidaten;
  const verzendadresOntbreekt = !vm.heeftVerzendadres;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {kanaal === 'email'
              ? <Mail className="h-4 w-4" />
              : <FileText className="h-4 w-4" />}
            {kanaal === 'email' ? 'E-mail voorbereiden' : 'Brief voorbereiden'}
          </DialogTitle>
          <DialogDescription>
            {kanaal === 'email'
              ? 'Stel een e-mailtekst samen via een strategieprofiel. Er wordt geen e-mail verstuurd — gebruik "Kopieer e-mailtekst" of "Markeer verzonden".'
              : 'Controleer de geadresseerde, het verzendadres en de objectomschrijving. De brief wordt als concept opgeslagen en is direct te downloaden als PDF.'}
          </DialogDescription>
        </DialogHeader>
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 space-y-4"
          data-testid="brief-voorbereiden-dialog"
        >
          {/* V2.2 — kanaal segmented control */}
          <div
            data-testid="brief-kanaal-toggle"
            className="glass-tabbar inline-flex gap-1 p-1 rounded-full"
            role="tablist"
            aria-label="Kanaal"
          >
            {(['post', 'email'] as Kanaal[]).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kanaal === k}
                data-state={kanaal === k ? 'active' : 'inactive'}
                data-testid={`brief-kanaal-${k}`}
                onClick={() => setKanaal(k)}
                className="glass-tab-pill text-xs px-3 py-1.5"
              >
                {k === 'post' ? 'Post' : 'E-mail'}
              </button>
            ))}
          </div>

          {kanaal === 'email' && (
            <div className="space-y-1.5" data-testid="brief-email-profiel">
              <Label>Strategieprofiel</Label>
              <Select
                value={emailProfiel}
                onValueChange={(v) => {
                  setEmailProfiel(v as EmailProfiel);
                  // Bij wisselen profiel altijd template opnieuw toepassen,
                  // tenzij de gebruiker tekst expliciet handmatig wil houden.
                  if (!emailTekstHandmatig) pasTemplateToe(v as EmailProfiel);
                }}
              >
                <SelectTrigger data-testid="brief-email-profiel-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_PROFIEL_VOLGORDE.map((p) => (
                    <SelectItem key={p} value={p} data-testid={`brief-email-profiel-optie-${p}`}>
                      {EMAIL_PROFIEL_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Templates zijn bewerkbaar. Onderwerp en tekst worden alleen
                automatisch ingevuld zolang u ze nog niet handmatig hebt aangepast.
              </p>
            </div>
          )}

          {kandidaten.length > 1 && (
            <div className="space-y-1.5">
              <Label>Geadresseerde kiezen</Label>
              <Select value={kandidaatLabel} onValueChange={handleKandidaatWissel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {kandidaten.map(k => (
                    <SelectItem key={k.label} value={k.label}>
                      {k.label}{' '}
                      <span className="text-[10px] text-muted-foreground">
                        ({k.bron === 'kadaster' ? 'Kadaster' : 'Signaal'})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Geadresseerde-preview — exact zoals deze in PDF/kopie verschijnt. */}
          <div
            data-testid="brief-geadresseerde-preview"
            className="rounded-md border bg-muted/30 p-3 text-sm leading-relaxed"
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
              Geadresseerde zoals in PDF
            </div>
            {vm.bedrijfsnaam && <div>{vm.bedrijfsnaam}</div>}
            {vm.geadresseerdeNaam && <div>{vm.geadresseerdeNaam}</div>}
            {vm.verzendadresRegels.map((r, i) => <div key={i}>{r}</div>)}
            {(vm.bedrijfsnaam || vm.geadresseerdeNaam) && vm.verzendadresRegels.length === 0 && (
              <div className="text-muted-foreground italic">Geen verzendadres ingevuld</div>
            )}
            {!vm.bedrijfsnaam && !vm.geadresseerdeNaam && vm.verzendadresRegels.length === 0 && (
              <div className="text-muted-foreground italic">Nog geen geadresseerde-gegevens</div>
            )}
          </div>

          {/* Geadresseerde */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Geadresseerde</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brief-naam">Naam</Label>
                <Input id="brief-naam" value={eigenaarNaam}
                  onChange={(e) => {
                    setEigenaarNaam(e.target.value);
                    setAanhef(bepaalAanhef(e.target.value || null));
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brief-bedrijf">Bedrijfsnaam</Label>
                <Input id="brief-bedrijf" value={eigenaarBedrijfsnaam} onChange={(e) => setEigenaarBedrijfsnaam(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Verzendadres */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Verzendadres</div>
            <Label htmlFor="brief-verzend" className="sr-only">Verzendadres</Label>
            <Textarea
              id="brief-verzend"
              value={verzendadres}
              onChange={(e) => setVerzendadres(e.target.value)}
              placeholder={kanaal === 'email' ? '' : `Bijv. ${VERZENDADRES_PLACEHOLDER}`}
              rows={3}
            />
            {kadasterRecords.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {overneemAdresOpties.length > 1 && (
                  <Select value={kadasterAdresKey} onValueChange={setKadasterAdresKey}>
                    <SelectTrigger className="sm:max-w-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {overneemAdresOpties.map((k, i) => (
                        <SelectItem key={`${k.recordId ?? 'rec'}-${i}`} value={String(i)}>
                          {[k.naam ?? k.bedrijfsnaam, ...(k.verzendadres ?? '').split(/\r?\n/)].filter(Boolean).join(' · ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button type="button" variant="outline" size="sm" onClick={neemVerzendadresOverUitKadaster}>
                  Verzendadres overnemen uit Kadasterbericht
                </Button>
              </div>
            )}
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer select-none">Details Kadasteradres</summary>
              <div className="pt-1">
                Kadasteradres: {kadasterAdresDebug.gevonden ? 'gevonden' : 'niet gevonden'}
                {kadasterAdresDebug.bronLabel ? <><br />Bron: {kadasterAdresDebug.bronLabel}</> : null}
                {kadasterAdresDebug.parsedLabel ? <><br />Parsed: {kadasterAdresDebug.parsedLabel}</> : null}
              </div>
            </details>
            {verzendadresOntbreekt && (
              <p className="text-[11px] text-amber-600">
                Geen verzendadres bekend. Vul dit handmatig aan voordat u de PDF genereert.
              </p>
            )}
          </div>

          {/* Objectomschrijving */}
          <div className="space-y-1.5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Objectomschrijving in brief</div>
            <Label htmlFor="brief-objomschrijving" className="sr-only">Objectomschrijving</Label>
            <Input
              id="brief-objomschrijving"
              value={objectomschrijving}
              onChange={(e) => {
                const nieuw = e.target.value;
                setObjectomschrijving(nieuw);
                setBrieftekst(bouwBriefTekst({ aanhef, objectadres: nieuw }));
                // Onderwerp volgt automatisch zolang de gebruiker het niet
                // handmatig heeft aangepast.
                if (!onderwerpHandmatig) setOnderwerp(bepaalOnderwerp(nieuw));
              }}
            />
            <p className="text-[11px] text-muted-foreground">
              Gebaseerd op signaaladres / Kadasteradres. Pas dit aan als het
              signaal meerdere adressen of een breder pand betreft.
            </p>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Intern objectadres (feitelijk)</summary>
            <div className="pt-2">
              <Input value={objectadres} onChange={(e) => setObjectadres(e.target.value)} />
              <p className="mt-1 text-[11px]">
                Wordt bewaard voor administratie. De brief gebruikt "Objectomschrijving in brief".
              </p>
            </div>
          </details>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="brief-aanhef">Aanhef</Label>
              <Input id="brief-aanhef" value={aanhef} onChange={(e) => setAanhef(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brief-onderwerp">Onderwerp</Label>
              <Input
                id="brief-onderwerp"
                value={onderwerp}
                onChange={(e) => {
                  setOnderwerp(e.target.value); setOnderwerpHandmatig(true);
                  if (kanaal === 'email') setEmailTekstHandmatig(true);
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="brief-tekst">
                {kanaal === 'email' ? 'E-mailtekst' : 'Brieftekst'}
              </Label>
              {kanaal === 'email' ? (
                <button
                  type="button"
                  onClick={() => pasTemplateToe(emailProfiel)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  data-testid="brief-email-template-opnieuw"
                >
                  Template opnieuw toepassen
                </button>
              ) : (
                <button
                  type="button"
                  onClick={herstelStandaard}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Herstel standaardtekst
                </button>
              )}
            </div>
            <Textarea
              id="brief-tekst"
              value={brieftekst}
              onChange={(e) => {
                setBrieftekst(e.target.value);
                if (kanaal === 'email') setEmailTekstHandmatig(true);
              }}
              rows={18}
              className="font-mono text-xs leading-relaxed"
            />
          </div>
        </div>

        <ModalActionBar
          className="shrink-0"
          onCancel={() => onOpenChange(false)}
          cancelLabel="Sluiten"
          secondary={[
            <Button
              key="concept"
              variant="outline" onClick={opslaanAlsConcept} disabled={bezig}
              data-testid="brief-opslaan-concept"
            >
              <Save className="h-4 w-4" />
              {kanaal === 'email' ? 'Opslaan als e-mailconcept' : 'Opslaan als concept'}
            </Button>,
            ...(kanaal === 'email'
              ? [
                  <Button key="kopieer-email" variant="outline" onClick={kopieerEmail} data-testid="brief-kopieer-email">
                    <Copy className="h-4 w-4" /> Kopieer e-mailtekst
                  </Button>,
                ]
              : [
                  <Button key="kopieer" variant="outline" onClick={kopieer}>
                    <Copy className="h-4 w-4" /> Kopieer brief
                  </Button>,
                  <Button
                    key="pdf"
                    variant="outline" onClick={downloadPdf} disabled={pdfBezig}
                    data-testid="brief-download-pdf"
                  >
                    {pdfBezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                    Download PDF
                  </Button>,
                ]),
          ]}
          primary={
            <Button
              onClick={markeerVerstuurd}
              disabled={bezig}
              data-testid={kanaal === 'email' ? 'brief-markeer-verzonden' : 'brief-markeer-verstuurd'}
            >
              <Send className="h-4 w-4" />
              {kanaal === 'email' ? 'Markeer verzonden' : 'Markeer als verstuurd'}
            </Button>
          }
        />



      </DialogContent>
    </Dialog>
  );
}
