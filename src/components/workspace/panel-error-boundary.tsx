"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class PanelErrorBoundary extends Component<
  { children: ReactNode; title: string },
  { failed: boolean; message: string }
> {
  state = { failed: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { failed: true, message: error.message || "Unknown rendering error" };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Workspace panel failed", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="workspace-panel">
          <p className="eyebrow">Local panel recovery</p>
          <h1>{this.props.title} could not open.</h1>
          <p className="page-description">The rest of your offline workspace is safe. Reload once to replace any outdated application files. If it happens again, the detail below identifies the exact record or component that needs attention.</p>
          <button className="button" type="button" onClick={() => window.location.reload()}>Reload updated app</button>
          <details className="panel-error-details">
            <summary>Technical details</summary>
            <code>{this.state.message}</code>
          </details>
        </main>
      );
    }
    return this.props.children;
  }
}
