import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router';

interface State {
  error: Error | null;
}

class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('page crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="msg msg-error" role="alert">
        This page stopped working: {this.state.error.message}. The rest of the app still works: pick another page, or reload.
      </div>
    );
  }
}

/**
 * Keeps one broken page from blanking the whole app (menu, top bar, live
 * updates). Resets when the user opens another page.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
