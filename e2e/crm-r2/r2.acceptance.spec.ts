import { test, expect } from '@playwright/test';

test.beforeEach(async ({page}) => {
  // Vermijd externe fonts en garandeer dat er geen productie-API wordt benaderd.
  page.on('request', request => {
    const url = request.url();
    if (/supabase|api\.vercel|bitovastgoed\.vercel/i.test(url)) {
      throw new Error('Onverwacht extern productie-/databaseverzoek: ' + url);
    }
  });
  await page.route('**/fonts.googleapis.com/**',route=>route.abort());
  await page.route('**/fonts.gstatic.com/**',route=>route.abort());
  await page.goto('/r2-acceptance/');
  await expect(page.getByRole('heading',{name:'Matching R2 – acceptatieomgeving'})).toBeVisible();
});

test('desktop: meerdere zoekmandaten per bemiddelaar en geen dubbele kandidaatrecords',async ({page})=>{
  await page.setViewportSize({width:1280,height:900});
  await expect(page.getByText('2 contactrelaties met mogelijke matches')).toBeVisible();
  const broker=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Horecamakelaar Nederland'})});
  await expect(broker.locator('details')).toHaveCount(3);
  await expect(page.getByRole('heading',{name:'Reeds gekoppelde relatie'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Afwijkende partij'})).toHaveCount(0);
  await expect(broker).toContainText('Direct benaderbare partij');
  const gekozenMandaat=broker.locator('details').filter({hasText:'Woningen tot €800k'});
  await gekozenMandaat.locator('summary').click();
  await expect(gekozenMandaat.getByText('Deze relatie kan rechtstreeks worden benaderd.')).toBeVisible();
  await gekozenMandaat.getByRole('button',{name:'Bereid keuze voor (geen opslag)'}).click();
  await expect(page.getByRole('status').filter({hasText:'Gekozen contact:'})).toContainText('Gekozen contact: Horecamakelaar Nederland');
  await expect(page.getByRole('status').filter({hasText:'Gekozen contact:'})).toContainText('eindkoper: later vaststellen');
  await expect(page.getByRole('button',{name:/Verstuur|Toevoegen|Opslaan/})).toHaveCount(0);
  await page.screenshot({path:'test-results/r2-desktop.png',fullPage:true});
});
test('afwijkende profielen blijven verborgen tenzij expliciet gekozen',async ({page})=>{
  await expect(page.getByRole('heading',{name:'Afwijkende partij'})).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Toon afwijkende profielen'}).check();
  await expect(page.getByText('3 contactrelaties met mogelijke matches')).toBeVisible();
  const item=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Afwijkende partij'})});
  await item.getByText('Budget buiten bandbreedte',{exact:false}).click();
  await expect(item.getByRole('button',{name:'Bereid keuze voor (geen opslag)'})).toBeDisabled();
});
test('mobiel: kaarten en keuzes binnen het scherm bij 390 pixels',async ({page})=>{
  await page.setViewportSize({width:390,height:844});
  await expect(page.getByText('2 contactrelaties met mogelijke matches')).toBeVisible();
  const broker=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Horecamakelaar Nederland'})});
  await broker.getByText('Woningen tot €800k',{exact:false}).click();
  await expect(broker.getByRole('button',{name:'Bereid keuze voor (geen opslag)'}).first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow,'Horizontaal uitklappen op mobiel').toBeLessThanOrEqual(2);
  await page.screenshot({path:'test-results/r2-mobile.png',fullPage:true});
});

test('provincie naar gemeente: zoeken, selecteren, bewaren en afwijkende provincie tonen',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const geo=page.getByRole('region',{name:'Provincie en gemeente acceptatie'});
 await expect(geo.getByRole('textbox',{name:'Gemeente zoeken'})).toBeVisible();
 await geo.getByRole('textbox',{name:'Gemeente zoeken'}).fill('Oisterwijk');
 await geo.getByRole('checkbox',{name:'Oisterwijk'}).check();
 await expect(geo.getByLabel('Geselecteerde gemeenten')).toContainText('Oisterwijk');
 await geo.getByRole('combobox',{name:'Provincie voorbeeld'}).selectOption('Utrecht');
 await expect(geo.getByText(/Een eerder geselecteerde gemeente valt buiten/)).toBeVisible();
 await geo.getByRole('textbox',{name:'Gemeente zoeken'}).fill('De Ronde Venen');
 await geo.getByRole('checkbox',{name:'De Ronde Venen'}).check();
 await expect(geo.getByLabel('Geselecteerde gemeenten')).toContainText('De Ronde Venen');
 const over=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 expect(over).toBeLessThanOrEqual(2);
 await page.screenshot({path:'test-results/r2-gemeenten-mobiel.png',fullPage:true});
});

// Test the actual roles UI in isolation with synthetic data.
test('meerdere rollen, onbekend versus leeg en geen mandaatpoort op mobiel',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const section=page.getByRole('region',{name:'Commerciële rollen acceptatie'});
 await expect(section.getByRole('status')).toContainText('onbekend');
 await section.getByRole('checkbox',{name:'Nog niet vastgesteld'}).uncheck();
 await expect(section.getByRole('status')).toContainText('bewust leeg');
 await section.getByRole('checkbox',{name:'Koper',exact:true}).check();
 await section.getByRole('checkbox',{name:'Verkoper',exact:true}).check();
 await section.getByRole('checkbox',{name:'Bemiddelaar',exact:true}).check();
 await expect(section.getByRole('status')).toContainText('koper, verkoper, bemiddelaar');
 await expect(section).toContainText('Bestaand type partij: makelaar');
 await section.getByRole('checkbox',{name:'Nog niet vastgesteld'}).check();
 await expect(section.getByRole('status')).toContainText('onbekend');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 expect(overflow).toBeLessThanOrEqual(2);
 await page.screenshot({path:'test-results/r2-rollen-mobiel.png',fullPage:true});
});
