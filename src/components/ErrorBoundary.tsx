import { Component, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, an uncaught render error unmounts the whole tree, leaving
 * nothing but the pure-black/white CSS background — indistinguishable from
 * a frozen or broken app. This turns that into a recoverable screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    invoke("log_client_error", {
      message: `[render] ${error.message}\n${error.stack}\n${info.componentStack}`,
    }).catch(() => {});
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash-screen">
          <p className="crash-title">Algo salió mal.</p>
          <p className="crash-message">{this.state.error.message}</p>
          <button className="crash-reload" onClick={() => window.location.reload()}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
