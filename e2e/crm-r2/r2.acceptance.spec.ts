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
  await expect(broker.locator('details')).toHaveCount(2);
  await expect(page.getByRole('heading',{name:'Reeds gekoppelde relatie'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Afwijkende partij'})).toHaveCount(0);
  await broker.getByText('Horeca namens belegger',{exact:false}).click();
  await expect(broker.getByText('Uiteindelijke koper nog niet vastgesteld.')).toBeVisible();
  await broker.getByRole('button',{name:'Bereid keuze voor (geen opslag)'}).first().click();
  await expect(page.getByRole('status').last()).toContainText('Gekozen contact: Horecamakelaar Nederland');
  await expect(page.getByRole('status').last()).toContainText('koper: niet bevestigd');
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
  await broker.getByText('Horeca namens belegger',{exact:false}).click();
  await expect(broker.getByRole('button',{name:'Bereid keuze voor (geen opslag)'}).first()).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow,'Horizontaal uitklappen op mobiel').toBeLessThanOrEqual(2);
  await page.screenshot({path:'test-results/r2-mobile.png',fullPage:true});
});
