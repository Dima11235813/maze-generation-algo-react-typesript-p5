import React, { ErrorInfo } from "react";
import errorReporter from "../utils/errorReporting";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
}
class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ hasError: true });
    errorReporter.reportError(error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ margin: "1rem" }}>
          <h1>Application Encountered An Error</h1>
          <h2>
            Please try again, and if you keep seeing this screen, contact tech
            support.
          </h2>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
