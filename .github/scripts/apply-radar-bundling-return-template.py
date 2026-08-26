from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 anchor, found {count}')
    return text.replace(old, new, 1)


# 1) Acquisitieselectie: bewaar de Radar-bulkselectie in sessionStorage.
# Filters, sortering, werkvoorraadfilter en scrollpositie worden al apart bewaard;
# hierdoor komt detail -> terug exact terug met dezelfde aangevinkte signalen.
path = Path('src/components/offmarket/acquisitie/AcquisitieSelectieTab.tsx')
text = path.read_text()

import_anchor = """import {
  focusTabVoorWerkbakContext,
  hoortWerkbakContextBijBron,
  werkrondeBronVoorView,
} from '@/lib/offMarket/acquisitie/werkrondeContext';
"""
import_new = import_anchor + """import {
  beperkRadarBulkSelectie,
  leesRadarBulkSelectie,
  schrijfRadarBulkSelectie,
  setsZijnGelijk,
} from '@/lib/offMarket/acquisitie/bulkSelectionPersistence';
"""
text = replace_once(text, import_anchor, import_new, 'AcquisitieSelectieTab import')

state_anchor = """  const [bulkSelectie, setBulkSelectie] = useState<Set<string>>(new Set());
  const [bulkVastgoedkansSelectie, setBulkVastgoedkansSelectie] = useState<Set<string>>(new Set());
"""
state_new = """  const [bulkSelectie, setBulkSelectie] = useState<Set<string>>(() => leesRadarBulkSelectie());
  const [bulkVastgoedkansSelectie, setBulkVastgoedkansSelectie] = useState<Set<string>>(new Set());

  // De handmatige Radar-selectie is onderdeel van de werksituatie. Filters,
  // sortering en scrollpositie werden al bewaard; zonder deze selectie moest
  // de gebruiker na detail -> terug alles opnieuw aanvinken.
  useEffect(() => {
    schrijfRadarBulkSelectie(bulkSelectie);
  }, [bulkSelectie]);

  // Houd een herstelde selectie schoon wanneer dossiers intussen uit de
  // Acquisitieselectie zijn verwijderd. Wacht tot de selectiequery geladen is,
  // anders zou een lege initiële fetch de bewaarde selectie wissen.
  useEffect(() => {
    if (isLoading) return;
    const beperkt = beperkRadarBulkSelectie(
      bulkSelectie,
      geselecteerdeSignalen.map((signaal) => signaal.id),
    );
    if (!setsZijnGelijk(beperkt, bulkSelectie)) setBulkSelectie(beperkt);
  }, [isLoading, geselecteerdeSignalen, bulkSelectie]);
"""
text = replace_once(text, state_anchor, state_new, 'AcquisitieSelectieTab bulk state')
path.write_text(text)


# 2) Brief voorbereiden: expliciet "Herstel standaardtekst" herstelt de hele
# actuele posttemplate (onderwerp + tekst), niet alleen de body. Dit raakt niets
# stilzwijgend: uitsluitend de expliciete gebruikersactie voert deze reset uit.
path = Path('src/components/offmarket/BriefVoorbereidenDialog.tsx')
text = path.read_text()
restore_anchor = """  const herstelStandaard = () => {
    if (kanaal === 'post') {
      const template = bouwPostVariantTemplate({ toewijzing: copyToewijzing, aanhef, objectomschrijving });
      setBrieftekst(template.brieftekst);
    } else {
      setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));
    }
    toast.success('Standaardtekst hersteld');
  };
"""
restore_new = """  const herstelStandaard = () => {
    if (kanaal === 'post') {
      const template = bouwPostVariantTemplate({ toewijzing: copyToewijzing, aanhef, objectomschrijving });
      setOnderwerp(template.onderwerp);
      setOnderwerpHandmatig(false);
      setBrieftekst(template.brieftekst);
    } else {
      setBrieftekst(bouwBriefTekst({ aanhef, objectadres: objectomschrijving }));
    }
    toast.success(kanaal === 'post' ? 'Standaardonderwerp en -tekst hersteld' : 'Standaardtekst hersteld');
  };
"""
text = replace_once(text, restore_anchor, restore_new, 'BriefVoorbereidenDialog herstelStandaard')
path.write_text(text)
