from pathlib import Path

# 1) AcquisitieSelectieTab: neem uitgaande contactmomenten mee in de opvolgkaart.
p = Path('src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx')
s = p.read_text()
s = s.replace('  const { taken } = useDataStore();', '  const { taken, contactMoments } = useDataStore();')
s = s.replace(
"""      respons: null | {\n        status: Responsstatus;\n        datum: string | null;\n        kanaal: Kanaal | null;\n        samenvatting: string | null;\n      };\n""",
"""      respons: null | {\n        status: Responsstatus;\n        datum: string | null;\n        kanaal: Kanaal | null;\n        samenvatting: string | null;\n      };\n      laatsteUitgaandContact: null | {\n        kanaal: Kanaal;\n        datum: string | null;\n        titel: string | null;\n      };\n""")
s = s.replace(
"""      const laatste = reacties[0];\n      m.set(s.id, {\n""",
"""      const laatste = reacties[0];\n      const laatsteUitgaand = (contactMoments ?? [])\n        .filter((cm) =>\n          cm.offMarketSignaalId === s.id\n          && cm.direction === 'uitgaand'\n          && ['email', 'telefoon', 'whatsapp', 'linkedin'].includes(cm.type),\n        )\n        .sort((a, b) => String(b.momentDate ?? b.createdAt ?? '')\n          .localeCompare(String(a.momentDate ?? a.createdAt ?? '')))[0];\n      const laatsteUitgaandContact = laatsteUitgaand ? {\n        kanaal: laatsteUitgaand.type as Kanaal,\n        datum: laatsteUitgaand.momentDate ?? null,\n        titel: laatsteUitgaand.title || null,\n      } : null;\n      m.set(s.id, {\n""")
s = s.replace(
"""        respons: laatste ? {\n          status: laatste.responsstatus as Responsstatus,\n          datum: laatste.responsdatum ?? null,\n          kanaal: (laatste.respons_kanaal as Kanaal | null | undefined) ?? null,\n          samenvatting: laatste.respons_samenvatting ?? null,\n        } : null,\n      });\n""",
"""        respons: laatste ? {\n          status: laatste.responsstatus as Responsstatus,\n          datum: laatste.responsdatum ?? null,\n          kanaal: (laatste.respons_kanaal as Kanaal | null | undefined) ?? null,\n          samenvatting: laatste.respons_samenvatting ?? null,\n        } : null,\n        laatsteUitgaandContact,\n      });\n""")
s = s.replace('  }, [geselecteerdeSignalen, brievenPerSignaal, taken]);', '  }, [geselecteerdeSignalen, brievenPerSignaal, taken, contactMoments]);')
s = s.replace(
"""                geadresseerden={r.geadresseerden}\n                hoofdinhoud={(\n""",
"""                geadresseerden={r.geadresseerden}\n                laatsteUitgaandContact={briefInfo?.laatsteUitgaandContact ?? null}\n                hoofdinhoud={(\n""")
p.write_text(s)

# 2) AcquisitieDossierRij: kanaalbewuste samenvatting + Contact & verzending.
p = Path('src/components/offmarket/acquisitie/AcquisitieDossierRij.tsx')
s = p.read_text()
s = s.replace(
"""  geadresseerden: GeadresseerdeVoorDossierRij[];\n  hoofdinhoud: ReactNode;\n""",
"""  geadresseerden: GeadresseerdeVoorDossierRij[];\n  laatsteUitgaandContact?: {\n    kanaal: string;\n    datum: string | null;\n    titel: string | null;\n  } | null;\n  hoofdinhoud: ReactNode;\n""")
s = s.replace(
"""function opvolgStatusRegel(procesDatum: string | null, heeftRespons: boolean): string | null {\n""",
"""const CONTACT_KANAAL_LABEL: Record<string, string> = {\n  email: 'E-mail verstuurd',\n  telefoon: 'Telefonisch benaderd',\n  whatsapp: 'WhatsApp verstuurd',\n  linkedin: 'LinkedIn-contact',\n  post: 'Brief verstuurd',\n  anders: 'Benadering geregistreerd',\n};\n\nfunction datumKortNl(iso: string | null | undefined): string | null {\n  if (!iso) return null;\n  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);\n  if (Number.isNaN(d.getTime())) return iso;\n  return new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(d);\n}\n\nfunction contactRegel(contact: { kanaal: string; datum: string | null } | null | undefined): string | null {\n  if (!contact) return null;\n  const label = CONTACT_KANAAL_LABEL[contact.kanaal] ?? 'Benadering geregistreerd';\n  const datum = datumKortNl(contact.datum);\n  return datum ? `${label} · ${datum}` : label;\n}\n\nfunction opvolgStatusRegel(procesDatum: string | null, heeftRespons: boolean): string | null {\n""")
s = s.replace(
"""  geadresseerden,\n  hoofdinhoud,\n""",
"""  geadresseerden,\n  laatsteUitgaandContact = null,\n  hoofdinhoud,\n""")
s = s.replace(
"""  const statusRegel = opvolging ? opvolgStatusRegel(procesDatum, heeftRespons) : null;\n""",
"""  const statusRegel = opvolging ? opvolgStatusRegel(procesDatum, heeftRespons) : null;\n  const laatsteContactRegel = opvolging ? contactRegel(laatsteUitgaandContact) : null;\n""")
s = s.replace(
"""  const verbergFormeleBriefstatus = opvolging && productie.briefnummers.length > 0;\n""",
"""  const verbergFormeleBriefstatus = opvolging && (\n    productie.briefnummers.length > 0\n    || Boolean(laatsteUitgaandContact && briefstatus?.toLowerCase().includes('geen brief'))\n  );\n""")
s = s.replace(
"""              {(eigenaar || statusRegel || aiAdviesLabel) && (\n""",
"""              {(eigenaar || laatsteContactRegel || statusRegel || aiAdviesLabel) && (\n""")
s = s.replace(
"""                  {(statusRegel || aiAdviesLabel) && (\n                    <div className={`${eigenaar ? 'mt-1.5' : ''} flex flex-wrap items-center gap-1.5`}>\n                      {statusRegel && (\n""",
"""                  {(laatsteContactRegel || statusRegel || aiAdviesLabel) && (\n                    <div className={`${eigenaar ? 'mt-1.5' : ''} flex flex-wrap items-center gap-1.5`}>\n                      {laatsteContactRegel && (\n                        <span className=\"font-medium text-foreground\" data-testid=\"acquisitie-opvolgen-laatste-contact\">\n                          {laatsteContactRegel}\n                        </span>\n                      )}\n                      {statusRegel && (\n""")
s = s.replace('                    Brief &amp; verzending', "                    {laatsteUitgaandContact ? 'Contact & verzending' : 'Brief & verzending'}")
s = s.replace(
"""                  <div className=\"border-t border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground\">\n                    {briefstatus && (\n""",
"""                  <div className=\"border-t border-border/60 px-2.5 py-2 text-[10px] text-muted-foreground\">\n                    {laatsteContactRegel && (\n                      <p className=\"mb-1.5\" data-testid=\"acquisitie-opvolgen-contact-detail\">\n                        <span className=\"font-medium text-foreground\">Laatste contact:</span> {laatsteContactRegel}\n                      </p>\n                    )}\n                    {briefstatus && (\n""")
s = s.replace('<span className="font-medium text-foreground">Status:</span> {briefstatus}', '<span className="font-medium text-foreground">Briefstatus:</span> {briefstatus}')
s = s.replace('                      <p>Er is nog geen formeel BR- of BAT-nummer gekoppeld.</p>', "                      <p>{laatsteUitgaandContact ? 'Geen formele briefproductie gekoppeld.' : 'Er is nog geen formeel BR- of BAT-nummer gekoppeld.'}</p>")
p.write_text(s)

# 3) GeadresseerdenLijst: een e-mailadres in legacy verzendadres als e-mail tonen, niet als fout postadres.
p = Path('src/components/offmarket/acquisitie/GeadresseerdenLijst.tsx')
s = p.read_text()
s = s.replace(
"""export function weergaveadresGeadresseerde(adres:string|null|undefined):string|null { const schoon=adres?.replace(/\\s+/g,' ').trim(); return schoon||null; }\n""",
"""export function weergaveadresGeadresseerde(adres:string|null|undefined):string|null { const schoon=adres?.replace(/\\s+/g,' ').trim(); return schoon||null; }\nexport function isEmailContactwaarde(waarde:string|null|undefined):boolean { const s=waarde?.trim()??''; return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(s); }\n""")
s = s.replace(
"""   {adres?<div data-testid=\"acquisitie-rij-geadresseerde-adres\"><span className=\"text-muted-foreground/80\">Postadres:</span> {adres}{!g.volledigPostadres&&<span className=\"text-destructive\"> · adres onvolledig</span>}</div>:<div className=\"text-destructive\" data-testid=\"acquisitie-rij-geadresseerde-adres-ontbreekt\">Postadres ontbreekt</div>}\n""",
"""   {adres?(isEmailContactwaarde(adres)?<div data-testid=\"acquisitie-rij-geadresseerde-email\"><span className=\"text-muted-foreground/80\">E-mail:</span> {adres}</div>:<div data-testid=\"acquisitie-rij-geadresseerde-adres\"><span className=\"text-muted-foreground/80\">Postadres:</span> {adres}{!g.volledigPostadres&&<span className=\"text-destructive\"> · adres onvolledig</span>}</div>):<div className=\"text-destructive\" data-testid=\"acquisitie-rij-geadresseerde-adres-ontbreekt\">Postadres ontbreekt</div>}\n""")
p.write_text(s)

# 4) Regressietest op legacy e-mailwaarde.
p = Path('src/test/offMarket/acquisitieGeadresseerdeContact.test.ts')
p.write_text("""import { describe, expect, it } from 'vitest';\nimport { isEmailContactwaarde } from '@/components/offmarket/acquisitie/GeadresseerdenLijst';\n\ndescribe('acquisitie geadresseerde contactpresentatie', () => {\n  it('herkent een legacy e-mailadres in verzendadres als e-mailcontact', () => {\n    expect(isEmailContactwaarde('info@berlagevastgoed.com')).toBe(true);\n    expect(isEmailContactwaarde('De Lairessestraat 145-A 1075 HJ AMSTERDAM')).toBe(false);\n  });\n});\n""")"}