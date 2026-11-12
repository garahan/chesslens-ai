import { Component, type ReactNode } from "react";
/** Keep Home and navigation available if a deferred scanner chunk cannot download. */
export class ScannerBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="scan-recovery" role="alert">
        <p>
          Couldn’t open the scanner. Go online and reload the app to try again.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          Reload app
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
