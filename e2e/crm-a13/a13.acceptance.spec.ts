import { test, expect } from '@playwright/test';

test.beforeEach(async ({page})=>{
 page.on('request',req=>{
  if(/supabase|api\\.vercel|bitovastgoed\\.vercel/i.test(req.url())){
   throw new Error('Verboden extern CRM-verzoek in synthetische acceptatie');
  }
 });
 await page.route('**/fonts.googleapis.com/**',route=>route.abort());
 await page.route('**/fonts.gstatic.com/**',route=>route.abort());
 await page.goto('/a13-acceptance/');
 await expect(page.getByRole('heading',{name:'Partijprofiel A13 — acceptatietest'})).toBeVisible();
});

test('A13 mobiel 320 en 390 px: selectie, meervoudige strategieën, geen horizontale overflow',async({page})=>{
 const section=page.getByRole('region',{name:'A13 partijprofiel browseracceptatie'});
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  await expect(section.getByRole('combobox',{name:'Partijprofiel'})).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow,'Horizontale overflow op '+width+' px').toBeLessThanOrEqual(2);
 }
 await expect(section.getByLabel('A13 formulierwaarde')).toContainText('Profiel: onbekend');
 await section.getByRole('combobox',{name:'Partijprofiel'}).selectOption('bemiddelaar');
 await section.getByRole('checkbox',{name:'Langetermijnbelegging'}).check();
 await section.getByRole('checkbox',{name:'Projectontwikkeling'}).check();
 await expect(section.getByLabel('A13 formulierwaarde')).toContainText('bemiddelaar');
 await expect(section.getByLabel('A13 formulierwaarde')).toContainText('langetermijnbelegging');
 await expect(section.getByLabel('A13 formulierwaarde')).toContainText('projectontwikkeling');
 await section.getByRole('checkbox',{name:'Langetermijnbelegging'}).uncheck();
 await expect(section.getByLabel('A13 formulierwaarde')).not.toContainText('langetermijnbelegging');
 await expect(section.getByTestId('legacy-velden')).toHaveText('Hoofdtype: makelaar · Commerciële rollen: bemiddelaar · Zoekprofielen: 2');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.screenshot({path:'test-results/a13-mobile-390.png',fullPage:true});
});

test('A13 desktop: bestaande profiel- en strategiekeuze opnieuw tonen',async({page})=>{
 await page.setViewportSize({width:1280,height:900});
 const section=page.getByRole('region',{name:'A13 partijprofiel browseracceptatie'});
 await section.getByRole('button',{name:'Laad bestaand voorbeeld'}).click();
 await expect(section.getByRole('combobox',{name:'Partijprofiel'})).toHaveValue('ontwikkelende_belegger');
 await expect(section.getByRole('checkbox',{name:'Value-add'})).toBeChecked();
 await expect(section.getByRole('checkbox',{name:'Transformatie'})).toBeChecked();
 await section.getByRole('combobox',{name:'Partijprofiel'}).selectOption('');
 await expect(section.getByLabel('A13 formulierwaarde')).toContainText('Profiel: onbekend');
 await expect(section.getByRole('checkbox',{name:'Value-add'})).toBeChecked();
 await expect(section.getByTestId('legacy-velden')).toContainText('Zoekprofielen: 2');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.screenshot({path:'test-results/a13-desktop.png',fullPage:true});
});
