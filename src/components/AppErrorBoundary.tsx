import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { recoverFromStaleAppShell } from '@/lib/appRecovery';

type Props = { children: ReactNode };
type State = { error: Error | null; recovering: boolean };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recovering: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Onverwachte frontendfout', error, info);
    void this.tryAutomaticRecovery(error);
  }

  private async tryAutomaticRecovery(error: Error) {
    this.setState({ recovering: true });
    const started = await recoverFromStaleAppShell(error);
    if (!started) this.setState({ recovering: false });
  }

  private reload = async () => {
    this.setState({ recovering: true });
    const started = await recoverFromStaleAppShell(new Error('Loading chunk failed'));
    if (!started) window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
          <section className="w-full rounded-xl border border-border bg-card p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">De app kon niet volledig laden</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Waarschijnlijk staat er nog een oude appversie in de cache. Je hoeft de webapp niet opnieuw te installeren; vernieuw de app hier gecontroleerd.
            </p>
            <button
              type="button"
              onClick={this.reload}
              disabled={this.state.recovering}
              className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${this.state.recovering ? 'animate-spin' : ''}`} />
              {this.state.recovering ? 'Nieuwe versie laden…' : 'App herstellen en vernieuwen'}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Blijft dit scherm terugkomen, open de website één keer in Safari en meld de fout.
            </p>
          </section>
        </div>
      </main>
    );
  }
}
