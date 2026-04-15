import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Algo salió mal</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Ocurrió un error inesperado. Por favor recarga la página o vuelve al inicio.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs text-left bg-muted/50 rounded p-2 mb-4 overflow-auto max-h-32 text-red-600 dark:text-red-400">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recargar
            </Button>
            <Button onClick={this.handleReset}>Ir al inicio</Button>
          </div>
        </div>
      </div>
    );
  }
}
