from pathlib import Path

page = Path('src/pages/VastgoedkansenVindenPage.tsx')
text = page.read_text()
text = text.replace("const [gemeente, setGemeente] = useState('Oisterwijk');", "const [gemeente, setGemeente] = useState('Amsterdam');")
page.write_text(text)

path = Path('src/lib/pdokBagSelectie.ts')
text = path.read_text()
text = text.replace("const MAX_PAGINAS = 12;\nconst PAGINA_LIMIET = 100;", "const RASTER_GROOTTE = 4;\nconst MAX_PAGINAS_PER_VAK = 3;\nconst PAGINA_LIMIET = 100;")
marker = "export async function zoekGemeenteBbox(gemeente: string): Promise<Bbox> {\n  return (await zoekGemeenteGebied(gemeente)).bbox;\n}\n"
insertion = marker + "\nexport function verdeelBboxInVakken(bbox: Bbox, rasterGrootte = RASTER_GROOTTE): Bbox[] {\n  const [minX, minY, maxX, maxY] = bbox;\n  const breedte = (maxX - minX) / rasterGrootte;\n  const hoogte = (maxY - minY) / rasterGrootte;\n  const vakken: Bbox[] = [];\n  for (let rij = 0; rij < rasterGrootte; rij += 1) {\n    for (let kolom = 0; kolom < rasterGrootte; kolom += 1) {\n      vakken.push([minX + kolom * breedte, minY + rij * hoogte, kolom === rasterGrootte - 1 ? maxX : minX + (kolom + 1) * breedte, rij === rasterGrootte - 1 ? maxY : minY + (rij + 1) * hoogte]);\n    }\n  }\n  const midden = (rasterGrootte - 1) / 2;\n  return vakken.sort((a, b) => {\n    const ax = ((a[0] + a[2]) / 2 - minX) / breedte - midden;\n    const ay = ((a[1] + a[3]) / 2 - minY) / hoogte - midden;\n    const bx = ((b[0] + b[2]) / 2 - minX) / breedte - midden;\n    const by = ((b[1] + b[3]) / 2 - minY) / hoogte - midden;\n    return ax * ax + ay * ay - (bx * bx + by * by);\n  });\n}\n"
if marker not in text:
    raise SystemExit('bbox helper marker niet gevonden')
text = text.replace(marker, insertion, 1)
start = text.index("  const eersteParams = new URLSearchParams({")
end = text.index("  const kandidaten = [...unique.values()].slice(0, criteria.limiet);", start)
replacement = '''  const vakken = verdeelBboxInVakken(gebied.bbox);
  const unique = new Map<string, BagKandidaat>();
  const gezieneFeatures = new Set<string>();
  const statistiek: BagSelectieStatistiek = {
    onderzocht: 0,
    technischAfgevallen: 0,
    buitenGemeente: 0,
    criteriaAfgevallen: 0,
    kandidaten: 0,
    paginas: 0,
  };

  for (const vak of vakken) {
    if (unique.size >= criteria.limiet) break;
    const params = new URLSearchParams({
      bbox: vak.join(','),
      'bbox-crs': CRS84,
      crs: CRS84,
      limit: String(PAGINA_LIMIET),
      f: 'json',
    });
    let url: string | null = `${BAG_PANDEN_URL}?${params}`;
    let paginasInVak = 0;

    while (url && paginasInVak < MAX_PAGINAS_PER_VAK && unique.size < criteria.limiet) {
      const data = await fetchJson(url);
      paginasInVak += 1;
      statistiek.paginas += 1;
      const features = (data?.features ?? []).filter((feature: any) => {
        const id = String(feature?.properties?.identificatie ?? feature?.id ?? '');
        if (id && gezieneFeatures.has(id)) return false;
        if (id) gezieneFeatures.add(id);
        return true;
      });
      statistiek.onderzocht += features.length;

      const voorVerrijking = features.filter((feature: any) => {
        const voldoet = voldoetVoorVerrijking(feature, criteria);
        if (!voldoet) statistiek.criteriaAfgevallen += 1;
        return voldoet;
      });
      const enriched = await mapBegrensd(voorVerrijking, 6, verrijkMetAdres);
      for (const item of enriched) {
        if (!item) { statistiek.technischAfgevallen += 1; continue; }
        if (!pastGebruiksdoel(item.gebruiksdoel, criteria.gebruiksdoelen)) { statistiek.criteriaAfgevallen += 1; continue; }
        if (item.longitude == null || item.latitude == null) { statistiek.technischAfgevallen += 1; continue; }
        if (!puntInGemeente([item.longitude, item.latitude], gebied.ringen)) { statistiek.buitenGemeente += 1; continue; }
        const key = item.bagPandId || `${item.adres}|${item.postcode}`;
        if (!unique.has(key)) unique.set(key, item);
        if (unique.size >= criteria.limiet) break;
      }
      url = volgendePagina(data);
    }
  }

'''
text = text[:start] + replacement + text[end:]
path.write_text(text)

test = Path('src/test/vastgoedkansen/pdokBagSelectie.test.ts')
t = test.read_text()
if 'verdeelBboxInVakken' not in t:
    t = t.replace('puntInGemeente,', 'puntInGemeente,\n  verdeelBboxInVakken,')
    t += """\n\ndescribe('gebiedsdekkend raster', () => {\n  it('verdeelt een bbox in zestien unieke vakken met volledige dekking', () => {\n    const vakken = verdeelBboxInVakken([4, 51, 8, 55], 4);\n    expect(vakken).toHaveLength(16);\n    expect(new Set(vakken.map(vak => vak.join(','))).size).toBe(16);\n    expect(Math.min(...vakken.map(vak => vak[0]))).toBe(4);\n    expect(Math.min(...vakken.map(vak => vak[1]))).toBe(51);\n    expect(Math.max(...vakken.map(vak => vak[2]))).toBe(8);\n    expect(Math.max(...vakken.map(vak => vak[3]))).toBe(55);\n  });\n});\n"""
test.write_text(t)
