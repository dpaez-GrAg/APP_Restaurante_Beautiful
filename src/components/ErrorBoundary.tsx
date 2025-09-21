import React, { Component, ErrorInfo, ReactNode } from "react";
import EmergencyReset from "./EmergencyReset";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });

    // Si es el error de SecurityError específico, limpiar inmediatamente
    if (error.message?.includes("history.replaceState") || error.message?.includes("100 times per 10 seconds")) {
      console.warn("Detected navigation loop error - clearing state");
      localStorage.removeItem("local_admin");
      sessionStorage.clear();
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage = this.state.error?.message || "Error desconocido";

      return <EmergencyReset error={errorMessage} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
