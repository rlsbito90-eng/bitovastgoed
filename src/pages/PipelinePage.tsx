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
    <div className="container mx-auto p-4 sm:p-6 space-y-5 max-w-[1600px]">
      <PageHeader
        title="Pipeline"
        subtitle="Object Pipeline volgt het object van Lead naar Closing. Kandidaten Pipeline volgt potentiële kopers per object."
      />

      <Tabs value={tab} onValueChange={v => setTab(v as 'objecten' | 'kandidaten')} className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-xl">
          <TabsTrigger value="objecten" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Object Pipeline
            <span className="text-[10px] font-mono-data bg-muted text-muted-foreground rounded px-1.5 py-0.5 ml-1">
              {aantalObjectenInPipeline}
            </span>
          </TabsTrigger>
          <TabsTrigger value="kandidaten" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Kandidaten Pipeline
            <span className="text-[10px] font-mono-data bg-muted text-muted-foreground rounded px-1.5 py-0.5 ml-1">
              {pipelineKandidaten.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="objecten" className="mt-4">
          <ObjectPipelineKanban />
        </TabsContent>

        <TabsContent value="kandidaten" className="mt-4">
          <KandidatenKanban />
        </TabsContent>
      </Tabs>
    </div>
  );
}
