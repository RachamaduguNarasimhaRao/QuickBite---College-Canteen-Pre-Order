import React from "react";

type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, State> {
  constructor(props: { children?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console (and you can forward to an error reporting service)
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1 style={{ color: "#b91c1c" }}>Application Error</h1>
          <pre style={{ whiteSpace: "pre-wrap", color: "#111" }}>
            {this.state.error?.message}
            {this.state.error?.stack ? "\n\n" + this.state.error.stack : null}
          </pre>
          <p>If this persists, paste the error shown here into the chat.</p>
        </div>
      );
    }

    return this.props.children as React.ReactElement;
  }
}
