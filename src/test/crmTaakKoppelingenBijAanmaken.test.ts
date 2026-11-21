// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  countTaskLinks,
  replacePrimaryTaskLink,
  taskLinkSelectionFromLegacy,
} from '@/components/tasks/TaskLinksPickerDialog';

const source = readFileSync(resolve(process.cwd(),'src/components/forms/TaakFormDialog.tsx'),'utf8');

describe('Taken: koppelingen bij aanmaken',()=>{
  it('gebruikt één bron voor gekozen links bij het aanmaken én bewerken',()=>{
    expect(source).toContain('const selectedLinks = taskLinks;');
    expect(source).toContain('await replaceTaskLinks(savedTaskId, taskLinkRows(selectedLinks));');
    expect(source).toContain('taskLinkSelectionFromLegacy({');
    expect(source).toContain('onChange={handleTaskLinksChange}');
    expect(source).toContain('title={isEdit ?');
    expect(source).not.toContain('const selectedLinks = isEdit');
  });

  it('maakt CRM-koppelingen zichtbaar vóór planning en toont meervoudig kiezen bij create',()=>{
    const koppelingen = source.indexOf('>Koppelingen</h3>');
    const planning = source.indexOf('<TaakWerkplanningVelden');
    expect(koppelingen).toBeGreaterThan(0);
    expect(planning).toBeLessThan(koppelingen);
    expect(source).toContain('>Meerdere koppelen</span>');
    expect(source).not.toContain('>Extra koppelingen</p>');
    expect(source).toContain('label="Relatie"');
    expect(source).toContain('label="Object"');
    expect(source).toContain('label="Deal"');
    expect(source).not.toContain('Koppelingen beheren');
    expect(source).toContain("onChange={(id) => changePrimaryLink('relatie', id)}");
    expect(source).toContain('const handleTaskLinksChange = (next: TaskLinkSelection) => {');
    expect(source).toContain('setForm(prev => ({');
  });

  it('bewaart aanvullende koppelingen bij het wijzigen van de primaire selectie',()=>{
    const base=taskLinkSelectionFromLegacy({
      relatieId:'r-a',objectId:'o-a',dealId:'d-a',
    });
    const withMore={
      ...base,
      relatie:['r-a','r-b'],
      object:['o-a','o-b'],
      deal:['d-a','d-b'],
      signaal:['s-a','s-b'],
    };
    const next=replacePrimaryTaskLink(withMore,'relatie','r-c');
    expect(next.relatie).toEqual(['r-c','r-b']);
    expect(next.object).toEqual(['o-a','o-b']);
    expect(next.deal).toEqual(['d-a','d-b']);
    expect(next.signaal).toEqual(['s-a','s-b']);
    expect(countTaskLinks(next)).toBe(8);
  });

  it('ontkoppelen verwijdert alleen de eerste selectie en promoot de volgende',()=>{
    const selection={relatie:['r-a','r-b'],deal:[],object:[],signaal:[]};
    expect(replacePrimaryTaskLink(selection,'relatie','').relatie).toEqual(['r-b']);
    expect(replacePrimaryTaskLink(selection,'relatie','r-b').relatie).toEqual(['r-b']);
    expect(replacePrimaryTaskLink(selection,'relatie','r-a')).toBe(selection);
  });

  it('laat historische deal-relatie niet automatisch als koper registreren',()=>{
    expect(source).toContain('if (selectedDeal && next.object.length === 0)');
    expect(source).toContain("next = replacePrimaryTaskLink(next, 'object', selectedDeal.objectId)");
    expect(source).not.toContain("if (!prev.relatieId) next.relatieId = d.relatieId");
    expect(source).toContain('const [linksDirty, setLinksDirty]');
  });
});
