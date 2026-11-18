import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const lees=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');

describe('Compacte dossierkaarten behouden details',()=>{
  it('groepeert administratieve relatievelden zonder ze te verwijderen',()=>{
    const pagina=lees('src/pages/RelatieDetailPage.tsx');
    expect(pagina).toContain('Administratie en overige gegevens');
    for(const naam of ['BEDRIJFSVELDEN','VESTIGINGSVELDEN','COMMUNICATIEVELDEN']){
      expect(pagina).toContain('velden={'+naam+'}');
    }
    expect(pagina).toContain('Activiteit en opvolging');
    expect(pagina.indexOf('Open taken')).toBeLessThan(pagina.indexOf('<RelatiePipelineSectie'));
  });
  it('laat identificatie op objectkaart achter een uitklapbare regel bestaan',()=>{
    const pagina=lees('src/pages/ObjectDetailPage.tsx');
    expect(pagina).toContain('<details className="rounded-lg border border-border/60 bg-card/50 p-4 min-w-0">');
    expect(pagina).toContain('Identificatie en bron');
    expect(pagina).toContain('CRM-object-ID');
    expect(pagina).toContain('<ObjectCommercieelInline object={object}');
    expect(pagina).not.toContain('<Field label="Objectstatus">');
  });
  it('verwijdert geen invoervelden uit de inline relatie-editor',()=>{
    const component=lees('src/components/relatie/InlineRelatieSectie.tsx');
    // Geen groot sectieformulier meer: alleen het gekozen veld gaat in editmodus.
    expect(component).toContain('v.key===actief||toonAlleVelden');
    expect(component).toContain('velden.map(veld=>');
    expect(component).toContain('<EditableValueButton');
    expect(component).toContain('const patch={[veld.key]:next} as Partial<Relatie>');
  });
});
