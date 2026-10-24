/**
 * ErrorBoundary — from ERP ErrorBoundary.jsx
 */
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
    this.setState({ errorInfo: info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="empty-state" style={{ padding: 48 }}>
          <h3 style={{ color: '#ef4444' }}>Something went wrong</h3>
          <p>{this.state.error?.message || 'An unexpected error occurred.'}</p>
          {this.state.errorInfo?.componentStack && (
            <pre style={{ marginTop: 12, padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 11, textAlign: 'left', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            type="button"
            className="btn-outline"
            style={{ marginTop: 16 }}
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
