import { FileText, Printer, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AcquisitieBriefDossierReadModel } from '@/lib/acquisitieBriefHistorie';

export function AcquisitieBriefHistorieKaart({ model }: { model: AcquisitieBriefDossierReadModel }) {
  return (
    <section className="section-card space-y-4 p-4 sm:p-5" data-testid="acquisitie-brief-historie">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-medium">Brief-, PDF- en verzendhistorie</h2>
          <Badge variant="outline">Read-only</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Geregistreerde dossierhistorie; er wordt vanuit deze kaart niets gegenereerd of verzonden.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Status label="PDF" actief={model.heeftPdfRegistratie} icon={FileText} />
        <Status label="Print" actief={model.heeftPrintregistratie} icon={Printer} />
        <Status label="Verzending" actief={model.heeftVerzendregistratie} icon={Send} />
      </div>

      <dl className="grid gap-3 rounded-md border border-border bg-muted/10 p-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Briefkenmerk</dt><dd className="mt-1">{model.huidigKenmerk || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Geadresseerde</dt><dd className="mt-1">{model.huidigeGeadresseerde || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Verzendwijze</dt><dd className="mt-1">{model.huidigeVerzendwijze || '—'}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Laatst verzonden</dt><dd className="mt-1">{model.laatstVerzondenOp || '—'}</dd></div>
      </dl>

      {model.historie.length === 0 ? (
        <p className="rounded-md bg-muted/20 p-3 text-xs text-muted-foreground">Nog geen afzonderlijke PDF-, print- of verzendgebeurtenissen geregistreerd.</p>
      ) : (
        <div className="space-y-2">
          {model.historie.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.label}</p>
                <time className="text-xs text-muted-foreground">{item.datum}</time>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {[item.briefKenmerk, item.pdfBestandsnaam, item.verzendwijze, item.geadresseerde].filter(Boolean).join(' · ') || 'Geen aanvullende metadata'}
              </p>
              {item.toelichting && <p className="mt-2 text-xs">{item.toelichting}</p>}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{model.veiligheidsmelding}</p>
    </section>
  );
}

function Status({ label, actief, icon: Icon }: { label: string; actief: boolean; icon: typeof FileText }) {
  return <div className="rounded-md border border-border p-3"><div className="flex items-center gap-2"><Icon className="h-4 w-4" /><span className="text-sm font-medium">{label}</span></div><p className="mt-1 text-xs text-muted-foreground">{actief ? 'Registratie aanwezig' : 'Nog niet geregistreerd'}</p></div>;
}
