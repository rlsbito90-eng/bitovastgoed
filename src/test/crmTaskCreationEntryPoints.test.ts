import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const taken=read('src/pages/TakenPage.tsx');
const dashboard=read('src/pages/DashboardPage.tsx');
const app=read('src/components/AppLayout.tsx');
const relatie=read('src/pages/RelatieDetailPage.tsx');
const object=read('src/pages/ObjectDetailPage.tsx');
const deal=read('src/pages/DealDetailPage.tsx');
const dossier=read('src/components/tasks/DossierTakenPanel.tsx');
const quick=read('src/components/tasks/QuickTaskCapture.tsx');
const form=read('src/components/forms/TaakFormDialog.tsx');

describe('CRM-brede taakcreatie: zichtbare ingangen en één veilige opslagflow',()=>{
  it('heeft een zichtbare Nieuwe taak op Taken, ook zonder desktopbreedte',()=>{
    expect(taken).toContain('actions={<button onClick');
    expect(taken).toContain('type="button" className="inline-flex w-full sm:w-auto');
    expect(taken).not.toContain('hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2');
    expect(taken).toContain('<TaakFormDialog open={formOpen}');
  });

  it('heeft rechtstreekse taakingangen op Dashboard en in de globale header',()=>{
    expect(dashboard).toContain('setNieuweTaakOpen(true)');
    expect(dashboard).toContain('<TaakFormDialog open={nieuweTaakOpen}');
    expect(app).toContain('aria-label="Nieuw item aanmaken"');
    expect(app).toContain('onSelect={()=>setNieuweTaakOpen(true)}');
    expect(app).toContain('<TaakFormDialog open={nieuweTaakOpen}');
    expect(app).toContain('onSelect={()=>setNieuweRelatieOpen(true)}');
    expect(app).toContain('onSelect={()=>setNieuwObjectOpen(true)}');
    expect(app).not.toContain('<Link to="/taken" className="btn-premium ml-2">');
  });

  it('neemt bij aanmaken de actieve relatie mee, zonder alle relaties verplicht te maken',()=>{
    expect(relatie).toContain('setNieuweTaakOpen(true)');
    expect(relatie).toContain('defaultRelatieId={relatie.id}');
    expect(dossier).toContain('defaultRelatieId={defaultRelatieId}');
  });

  it('neemt het object mee en maakt Taak toevoegen ook op mobiel bereikbaar',()=>{
    expect(object).toContain('className="inline-flex h-10 w-full items-center justify-center');
    expect(object).toContain('defaultObjectId={object.id}');
  });

  it('koppelt deal en object maar behandelt legacy relatie niet automatisch als koper',()=>{
    expect(deal).toContain('defaultDealId={deal.id} defaultObjectId={deal.objectId}');
    expect(deal).toContain('defaultRelatieId={isTransactionPosition?deal.relatieId:undefined}');
  });

  it('behoudt de compacte capture naast de volledige taakdialoog en de herinneringslogica',()=>{
    expect(quick).toContain('createManualTaskWithReminder');
    expect(quick).toContain('updateTaskPlanning');
    expect(form).toContain('updateManualTaskWithReminder');
    expect(form).toContain('replaceTaskLinks');
  });
});
