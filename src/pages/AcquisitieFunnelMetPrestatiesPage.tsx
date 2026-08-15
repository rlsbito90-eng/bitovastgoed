import AcquisitiePrestaties from '@/components/acquisitie/AcquisitiePrestaties';
import AcquisitieFunnelPage from '@/pages/AcquisitieFunnelPage';

export default function AcquisitieFunnelMetPrestatiesPage() {
  return (
    <>
      <div className="page-shell-full pb-0">
        <AcquisitiePrestaties />
      </div>
      <AcquisitieFunnelPage />
    </>
  );
}
