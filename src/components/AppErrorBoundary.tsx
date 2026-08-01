import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { recoverFromStaleAppShell } from '@/lib/appRecovery';

type Props = { children: ReactNode };
type State = { error: Error | null; recovering: boolean; componentStack: string };

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, recovering: false, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, recovering: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Onverwachte frontendfout', error, info);
    this.setState({ componentStack: info.componentStack ?? '' });
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

    const errorMessage = this.state.error.message || this.state.error.name || 'Onbekende frontendfout';
    const componentStack = this.state.componentStack.trim();

    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
          <section className="w-full rounded-xl border border-border bg-card p-6 text-center shadow-lg">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">De app kon niet volledig laden</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              De automatische herstelactie kon de onderliggende fout niet oplossen. De informatie hieronder helpt om de echte oorzaak gericht te herstellen.
            </p>
            <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive">Technische foutmelding</p>
              <code className="mt-1 block break-words text-xs leading-relaxed text-foreground">{errorMessage}</code>
            </div>
            {componentStack && (
              <details className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-left" open>
                <summary className="cursor-pointer text-xs font-semibold">React-componentstack</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">{componentStack}</pre>
              </details>
            )}
            <button
              type="button"
              onClick={this.reload}
              disabled={this.state.recovering}
              className="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${this.state.recovering ? 'animate-spin' : ''}`} />
              {this.state.recovering ? 'Nieuwe versie laden…' : 'Opnieuw herstellen en vernieuwen'}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">
              Maak een screenshot waarop de foutmelding én de componentstack zichtbaar zijn.
            </p>
          </section>
        </div>
      </main>
    );
  }
}
