import AcquisitieCockpit from '@/components/acquisitie/AcquisitieCockpit';
import AcquisitiePrestaties from '@/components/acquisitie/AcquisitiePrestaties';
import AcquisitieFunnelPage from '@/pages/AcquisitieFunnelPage';

export default function AcquisitieFunnelMetPrestatiesPage() {
  return (
    <>
      <div className="page-shell-full pb-0 space-y-6">
        <AcquisitieCockpit />
        <div id="acquisitie-prestaties-detail" className="scroll-mt-4">
          <AcquisitiePrestaties />
        </div>
      </div>
      <div id="acquisitie-funnel-detail" className="scroll-mt-4">
        <AcquisitieFunnelPage />
      </div>
    </>
  );
}
