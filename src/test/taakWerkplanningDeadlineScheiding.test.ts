import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(resolve(process.cwd(),path),'utf8');
const form=read('src/components/forms/TaakFormDialog.tsx');
const quick=read('src/components/tasks/QuickTaskCapture.tsx');
const reminders=read('src/lib/tasks/reminders.ts');
const dashboard=read('src/pages/DashboardPage.tsx');
const taken=read('src/pages/TakenPage.tsx');
const work=read('src/lib/tasks/workView.ts');

describe('Volledig taakformulier: dezelfde werkplanning als snelle invoer',()=>{
  it('laadt bestaande werkplanning op taak-ID en schrijft die niet blind leeg',()=>{
    expect(form).toContain('getTaskPlanning(taak.id)');
    expect(form).toContain('setWorkPlanLoaded(!taak?.id)');
    expect(form).toContain('reminderMode:row.reminderMode');
  });

  it('heeft een aparte werkplan-editor en harde deadline',()=>{
    expect(form).toContain('<TaakWerkplanningVelden');
    expect(form).toContain('Uiterste datum</h3>');
    expect(form).toContain('Datum (optioneel)');
    expect(form).toContain('setWorkPlanDirty(true)');
    expect(form).toContain('workPlanDirty');
    expect(form).toContain('disabled={bezig||!workPlanLoaded||!linksLoaded}');
    expect(form).toContain('setLinksLoaded(!taak?.id)');
    expect(form).toContain('setLinksLoaded(true)');
    expect(form).toContain('setLinksLoadError(');
    expect(form).toContain('<fieldset disabled={!linksLoaded||bezig}');
    expect(form.indexOf('>Taakgegevens</h3>')).toBeLessThan(form.indexOf('<TaakWerkplanningVelden'));
    expect(form.indexOf('<TaakWerkplanningVelden')).toBeLessThan(form.indexOf('>Koppelingen</h3>'));
    expect(form.indexOf('>Koppelingen</h3>')).toBeLessThan(form.indexOf('>Uiterste datum</h3>'));
    expect(form.indexOf('>Uiterste datum</h3>')).toBeLessThan(form.indexOf('>Notities</h3>'));
    expect(form).not.toContain('Collapsible');
  });

  it('maakt werkplan en taak in één insert en past bij bewerken alleen gewijzigde planning aan',()=>{
    expect(reminders).toContain('plan_datum: planning.planDatum');
    expect(reminders).toContain('planning_bucket: planning.planningBucket');
    expect(form).toContain('createManualTaskWithReminder(data,workPlan)');
    expect(form).toContain('if(workPlanDirty)await updateTaskPlanning(taak.id,workPlan)');
    expect(form).toContain('pendingCreatedTaskId.current');
  });

  it('ververst actieve Taken- en Dashboard-weergave na opslaan',()=>{
    expect(form).toContain('onSaved?.(savedTaskId)');
    expect(taken).toContain('onSaved={()=>{');
    expect(dashboard).toContain('onSaved={()=>{');
    expect(taken).toContain('void listTaskPlanning().then(setPlanningRows)');
    expect(dashboard).toContain('void listTaskPlanning().then(setPlanningRows)');
    expect(work).toContain('planning.planDatum <= today');
  });

  it('slaat ook bij Quick Capture werkdatum direct atomair op',()=>{
    expect(quick).toContain('planningForTarget(target, planDate, planTime, workReminderMode));');
    expect(quick).toContain('if (restoringExistingTask)');
    expect(quick).toContain('await updateTaskPlanning(taskId, planningForTarget(');
    expect(quick).toContain('pendingTaskIdRef.current');
  });
});
