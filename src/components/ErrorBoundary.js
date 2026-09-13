import React from 'react';

/**
 * App-level error boundary. A render error in any route shows a calm, branded
 * recovery screen instead of a blank page. The error is logged to the console
 * (and, once a monitoring provider is configured, forwarded there — see
 * docs/PRODUCTION-CHECKLIST "Monitoring").
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[app] render error', error, info?.componentStack);
    if (typeof window !== 'undefined' && typeof window.__BUKUR_REPORT_ERROR === 'function') {
      window.__BUKUR_REPORT_ERROR(error, info);
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="state" role="alert">
        <p className="u-eyebrow">Something went wrong</p>
        <h1 className="u-title">This page didn’t load properly</h1>
        <p className="u-lede" style={{ marginInline: 'auto', textAlign: 'center' }}>
          Please refresh the page. If it keeps happening, contact us and we’ll help.
        </p>
        <button
          className="btn btn--ghost btn--sm"
          style={{ justifySelf: 'center' }}
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>
    );
  }
}
