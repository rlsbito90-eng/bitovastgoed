import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Clock3, MessageCircleReply, MessageSquarePlus, PhoneCall } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EigenaarRegisterRecord } from '@/hooks/useEigenaarsregister';
import { useVastgoedkansBrieven } from '@/hooks/useAcquisitieBrieven';
import {
  useVastgoedkansEigenaarActiviteit,
  type EigenaarContactRichting,
  type EigenaarContactType,
} from '@/hooks/useVastgoedkansEigenaarActiviteit';
import { vindBriefEigenaar } from '@/lib/acquisitie/briefEigenaarMatch';
import { RESPONS_LABEL, type Responsstatus } from '@/lib/offMarket/brieven/respons';

interface Props {
  vastgoedkansId: string;
  eigenaren: EigenaarRegisterRecord[];
  objectId?: string | null;
  contextLabel?: string;
}

const CONTACT_TYPES: Array<[EigenaarContactType, string]> = [
  ['telefoon', 'Telefoongesprek'],
  ['email', 'E-mail'],
  ['whatsapp', 'WhatsApp'],
  ['linkedin', 'LinkedIn'],
  ['notitie', 'Notitie'],
  ['algemeen', 'Algemeen'],
];

function vandaag() { return new Date().toISOString().slice(0, 10); }
function overDagen(dagen: number) {
  const d = new Date();
  d.setDate(d.getDate() + dagen);
  return d.toISOString().slice(0, 10);
}
function eigenaarLabel(e: EigenaarRegisterRecord) { return e.bedrijfsnaam || e.naam; }
function datumNl(value: string | null | undefined) {
  if (!value) return 'Geen datum';
  return new Date(`${value}T12:00:00`).toLocaleDateString('nl-NL');
}
function kanaalLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    telefoon: 'Telefoon',
    email: 'E-mail',
    post: 'Post',
    whatsapp: 'WhatsApp',
    linkedin: 'LinkedIn',
    anders: 'Anders',
  };
  return labels[value ?? ''] ?? value ?? 'Reactie';
}

export default function VastgoedkansEigenaarActiviteitKaart({ vastgoedkansId, eigenaren, objectId, contextLabel }: Props) {
  const [eigenaarId, setEigenaarId] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [taakOpen, setTaakOpen] = useState(false);

  useEffect(() => {
    if (eigenaren.length === 1) setEigenaarId(eigenaren[0].id);
    else if (!eigenaren.some((e) => e.id === eigenaarId)) setEigenaarId('');
  }, [eigenaren, eigenaarId]);

  const eigenaar = eigenaren.find((e) => e.id === eigenaarId) ?? null;
  const activiteit = useVastgoedkansEigenaarActiviteit(vastgoedkansId, eigenaar?.id ?? null);
  const brieven = useVastgoedkansBrieven(vastgoedkansId);

  const [contact, setContact] = useState({
    type: 'telefoon' as EigenaarContactType,
    direction: 'uitgaand' as EigenaarContactRichting,
    datum: vandaag(),
    titel: '',
    beschrijving: '',
    uitkomst: '',
    maakTaak: false,
    vervolgdatum: overDagen(7),
  });
  const [taak, setTaak] = useState({ titel: '', deadline: overDagen(7), notities: '', prioriteit: 'normaal' as const });

  function openContact() {
    if (!eigenaar) return;
    const typeLabel = CONTACT_TYPES.find(([type]) => type === contact.type)?.[1] ?? 'Contact';
    setContact((prev) => ({ ...prev, datum: vandaag(), titel: `${typeLabel} – ${eigenaarLabel(eigenaar)}`, beschrijving: '', uitkomst: '', maakTaak: false, vervolgdatum: overDagen(7) }));
    setContactOpen(true);
  }

  function openTaak() {
    if (!eigenaar) return;
    setTaak({ titel: `Opvolgen: ${eigenaarLabel(eigenaar)}`, deadline: overDagen(7), notities: contextLabel ? `Vastgoedkans: ${contextLabel}` : '', prioriteit: 'normaal' });
    setTaakOpen(true);
  }

  async function contactOpslaan() {
    if (!eigenaar || !contact.titel.trim()) return;
    try {
      await activiteit.voegContactToe.mutateAsync({
        vastgoedkansId,
        eigenaarId: eigenaar.id,
        relatieId: eigenaar.crm_relatie_id,
        objectId,
        type: contact.type,
        direction: contact.direction,
        datum: contact.datum,
        titel: contact.titel,
        beschrijving: contact.beschrijving,
        uitkomst: contact.uitkomst,
        vervolgdatum: contact.maakTaak ? contact.vervolgdatum : null,
      });
      if (contact.maakTaak && contact.vervolgdatum) {
        await activiteit.voegTaak.mutateAsync({
          vastgoedkansId,
          eigenaarId: eigenaar.id,
          relatieId: eigenaar.crm_relatie_id,
          objectId,
          titel: `Opvolgen: ${eigenaarLabel(eigenaar)}`,
          type: 'Follow-up',
          deadline: contact.vervolgdatum,
          prioriteit: 'normaal',
          notities: contextLabel ? `Vastgoedkans: ${contextLabel}` : null,
        });
      }
      toast.success(contact.maakTaak ? 'Contactmoment en vervolgtaak opgeslagen.' : 'Contactmoment opgeslagen.');
      setContactOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Contactmoment opslaan mislukt.');
    }
  }

  async function taakOpslaan() {
    if (!eigenaar || !taak.titel.trim() || !taak.deadline) return;
    try {
      await activiteit.voegTaak.mutateAsync({
        vastgoedkansId,
        eigenaarId: eigenaar.id,
        relatieId: eigenaar.crm_relatie_id,
        objectId,
        titel: taak.titel,
        type: 'Follow-up',
        deadline: taak.deadline,
        prioriteit: taak.prioriteit,
        notities: taak.notities,
      });
      toast.success('Vervolgtaak opgeslagen.');
      setTaakOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Taak opslaan mislukt.');
    }
  }

  const briefReacties = useMemo(() => {
    if (!eigenaar) return [];
    return (brieven.data ?? []).filter((brief) => {
      if (!brief.responsstatus || !brief.responsdatum) return false;
      return vindBriefEigenaar(brief, eigenaren)?.id === eigenaar.id;
    });
  }, [brieven.data, eigenaar, eigenaren]);

  const tijdlijn = useMemo(() => {
    const contactItems = activiteit.contacten.map((item) => ({
      key: `contact:${item.id}`,
      sort: `${item.moment_date}T${item.moment_time || '23:59:59'}`,
      soort: 'contact' as const,
      titel: item.title,
      meta: `${datumNl(item.moment_date)} · ${CONTACT_TYPES.find(([type]) => type === item.type)?.[1] ?? item.type}`,
      detail: item.outcome || item.description || '',
    }));
    const taakItems = activiteit.taken.map((item) => ({
      key: `taak:${item.id}`,
      sort: `${item.deadline || '9999-12-31'}T00:00:00`,
      soort: 'taak' as const,
      titel: item.titel,
      meta: `${item.status === 'afgerond' ? 'Afgerond' : 'Taak'} · ${datumNl(item.deadline)}`,
      detail: item.notities || '',
    }));
    const reactieItems = briefReacties.map((brief) => ({
      key: `brief-reactie:${brief.id}`,
      sort: `${brief.responsdatum}T23:59:58`,
      soort: 'brief-reactie' as const,
      titel: RESPONS_LABEL[brief.responsstatus as Responsstatus] ?? 'Reactie op brief',
      meta: `${datumNl(brief.responsdatum)} · Reactie via ${kanaalLabel(brief.respons_kanaal)}`,
      detail: brief.respons_samenvatting || `Reactie geregistreerd op ${brief.campagne_stap === 'brief_2' ? 'Brief 2' : 'Brief 1'}.`,
    }));
    return [...contactItems, ...taakItems, ...reactieItems].sort((a, b) => b.sort.localeCompare(a.sort)).slice(0, 10);
  }, [activiteit.contacten, activiteit.taken, briefReacties]);

  const isLoading = activiteit.isLoading || brieven.isLoading;

  return (
    <div className="rounded-md border bg-background p-3 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Eigenaaropvolging</p>
          <p className="mt-1 text-xs text-muted-foreground">Contactmomenten, taken en geregistreerde briefreacties worden in één eigenaarstijdlijn getoond. Een CRM-relatie is niet vereist.</p>
        </div>
        {eigenaar && <Badge variant="outline">{eigenaar.crm_relatie_id ? 'CRM gekoppeld' : 'Acquisitie-eigenaar'}</Badge>}
      </div>

      {eigenaren.length > 1 && (
        <div>
          <Label>Eigenaar</Label>
          <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={eigenaarId} onChange={(e) => setEigenaarId(e.target.value)}>
            <option value="">Kies bewust een eigenaar…</option>
            {eigenaren.map((e) => <option key={e.id} value={e.id}>{eigenaarLabel(e)}</option>)}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Bij meerdere rechthebbenden wordt geen eigenaar automatisch gekozen.</p>
        </div>
      )}

      {eigenaar ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openContact}><MessageSquarePlus className="mr-1.5 h-4 w-4" />Contactmoment loggen</Button>
            <Button size="sm" variant="outline" onClick={openTaak}><CalendarPlus className="mr-1.5 h-4 w-4" />Vervolgtaak</Button>
          </div>
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium">Recente activiteit</p>
            {isLoading ? <p className="text-xs text-muted-foreground">Activiteit laden…</p> : tijdlijn.length ? (
              <div className="space-y-2">
                {tijdlijn.map((item) => (
                  <div key={item.key} className="rounded-md border bg-muted/10 p-2.5">
                    <div className="flex items-start gap-2">
                      {item.soort === 'contact'
                        ? <PhoneCall className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                        : item.soort === 'brief-reactie'
                          ? <MessageCircleReply className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          : <Clock3 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{item.titel}</p>
                        <p className="text-[11px] text-muted-foreground">{item.meta}</p>
                        {item.detail && <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-muted-foreground">Nog geen contactmomenten, taken of briefreacties voor deze eigenaar in deze Vastgoedkans.</p>}
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{eigenaren.length ? 'Kies eerst de eigenaar waarop de actie betrekking heeft.' : 'Nog geen eigenaar in het Eigenaarsregister.'}</p>
      )}

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Contactmoment loggen</DialogTitle><DialogDescription>Dit contactmoment blijft gekoppeld aan de acquisitie-eigenaar, ook zonder CRM-relatie.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Type</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={contact.type} onChange={(e) => setContact((p) => ({ ...p, type: e.target.value as EigenaarContactType }))}>{CONTACT_TYPES.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div><Label>Richting</Label><select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={contact.direction} onChange={(e) => setContact((p) => ({ ...p, direction: e.target.value as EigenaarContactRichting }))}><option value="uitgaand">Uitgaand</option><option value="inkomend">Inkomend</option><option value="intern">Intern</option></select></div>
            </div>
            <div><Label>Datum</Label><Input type="date" value={contact.datum} onChange={(e) => setContact((p) => ({ ...p, datum: e.target.value }))} /></div>
            <div><Label>Titel</Label><Input value={contact.titel} onChange={(e) => setContact((p) => ({ ...p, titel: e.target.value }))} /></div>
            <div><Label>Notitie</Label><Textarea rows={4} value={contact.beschrijving} onChange={(e) => setContact((p) => ({ ...p, beschrijving: e.target.value }))} /></div>
            <div><Label>Uitkomst</Label><Input value={contact.uitkomst} onChange={(e) => setContact((p) => ({ ...p, uitkomst: e.target.value }))} placeholder="Bijv. terugbellen, geen interesse, gesprek gepland" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contact.maakTaak} onChange={(e) => setContact((p) => ({ ...p, maakTaak: e.target.checked }))} />Direct een vervolgtaak aanmaken</label>
            {contact.maakTaak && <div><Label>Vervolgdatum</Label><Input type="date" value={contact.vervolgdatum} onChange={(e) => setContact((p) => ({ ...p, vervolgdatum: e.target.value }))} /></div>}
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContactOpen(false)}>Annuleren</Button><Button onClick={contactOpslaan} disabled={activiteit.voegContactToe.isPending || !contact.titel.trim()}>Opslaan</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={taakOpen} onOpenChange={setTaakOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Vervolgtaak aanmaken</DialogTitle><DialogDescription>De taak wordt gekoppeld aan de eigenaar en Vastgoedkans; een CRM-relatie blijft optioneel.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Titel</Label><Input value={taak.titel} onChange={(e) => setTaak((p) => ({ ...p, titel: e.target.value }))} /></div>
            <div><Label>Deadline</Label><Input type="date" value={taak.deadline} onChange={(e) => setTaak((p) => ({ ...p, deadline: e.target.value }))} /></div>
            <div><Label>Notities</Label><Textarea rows={4} value={taak.notities} onChange={(e) => setTaak((p) => ({ ...p, notities: e.target.value }))} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setTaakOpen(false)}>Annuleren</Button><Button onClick={taakOpslaan} disabled={activiteit.voegTaak.isPending || !taak.titel.trim() || !taak.deadline}>Opslaan</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
