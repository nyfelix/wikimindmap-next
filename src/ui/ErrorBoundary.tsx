import { Component, type ErrorInfo, type ReactNode } from "react";
import styles from "./ErrorBoundary.module.css";

interface State {
  error?: Error;
}

/** Catches render errors anywhere in the app: a friendly message, never a blank screen (TS-11). */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("WikiMindMap crashed:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className={styles.page} role="alert">
        <p className={styles.caps}>Something went wrong</p>
        <h1 className={styles.title}>This map couldn’t be drawn.</h1>
        <p className={styles.text}>
          It’s our mistake, not Wikipedia’s. Reload the page, or start again from the start page.
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className={styles.button} href={import.meta.env.BASE_URL}>
            Start page
          </a>
        </div>
      </main>
    );
  }
}
