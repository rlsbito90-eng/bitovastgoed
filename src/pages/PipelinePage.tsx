import PageHeader from '@/components/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import ObjectPipelineKanban from '@/components/pipeline/ObjectPipelineKanban';
import KandidatenKanban from '@/components/pipeline/KandidatenKanban';
import { useDataStore } from '@/hooks/useDataStore';
import { Building2, Users } from 'lucide-react';
import { useState } from 'react';

export default function PipelinePage() {
  const { objecten, pipelineKandidaten } = useDataStore();
  const [tab, setTab] = useState<'objecten' | 'kandidaten'>('objecten');

  const aantalObjectenInPipeline = objecten.filter(o => !!o.pipelineStageId).length;

  return (
    <div className="page-shell-full" data-mobile-kanban>
      <PageHeader
        title="Pipeline"
        subtitle="Object Pipeline volgt het object van Lead naar Closing. Kandidaten Pipeline volgt potentiële kopers per object."
      />

      <Tabs value={tab} onValueChange={v => setTab(v as 'objecten' | 'kandidaten')} className="w-full min-w-0">
        <TabsList className="grid w-full max-w-xl grid-cols-2 overflow-visible">
          <TabsTrigger value="objecten" className="flex min-w-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Object Pipeline</span>
            <span className="ml-0.5 rounded bg-muted px-1.5 py-0.5 font-mono-data text-[10px] text-muted-foreground sm:ml-1">
              {aantalObjectenInPipeline}
            </span>
          </TabsTrigger>
          <TabsTrigger value="kandidaten" className="flex min-w-0 items-center gap-1.5 px-2 sm:gap-2 sm:px-3">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">Kandidaten Pipeline</span>
            <span className="ml-0.5 rounded bg-muted px-1.5 py-0.5 font-mono-data text-[10px] text-muted-foreground sm:ml-1">
              {pipelineKandidaten.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="objecten" className="mt-4 min-w-0">
          <ObjectPipelineKanban />
        </TabsContent>

        <TabsContent value="kandidaten" className="mt-4 min-w-0">
          <KandidatenKanban />
        </TabsContent>
      </Tabs>
    </div>
  );
}
