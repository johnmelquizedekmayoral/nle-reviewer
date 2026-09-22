"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

export class PanelErrorBoundary extends Component<
  { children: ReactNode; title: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
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
          <p className="page-description">The rest of your offline workspace is safe. Reload once to replace any outdated application files.</p>
          <button className="button" type="button" onClick={() => window.location.reload()}>Reload updated app</button>
        </main>
      );
    }
    return this.props.children;
  }
}
