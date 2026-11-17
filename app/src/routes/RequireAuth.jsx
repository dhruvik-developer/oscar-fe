import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { hasStoredSession } from '../utils/authUtils';
import { useAppStore } from '../stores/appStore';

/**
 * RequireAuth — Route guard that verifies a session still exists.
 *
 * A refresh token is enough to keep the route open: the API client mints a new
 * access token on the first 401. The guard only redirects once both tokens are
 * gone (i.e. after the refresh itself failed) or were cleared by sign-out.
 */
export default function RequireAuth() {
  const location = useLocation();
  const [signedIn, setSignedIn] = useState(() => hasStoredSession());
  const mustChangePassword = useAppStore((s) => Boolean(s.currentUser?.mustChangePassword));

  useEffect(() => {
    // Re-verify on every route change.
    if (!hasStoredSession()) setSignedIn(false);

    const handleAuthChange = () => setSignedIn(hasStoredSession());

    window.addEventListener('evenmore:unauthorized', handleAuthChange);
    window.addEventListener('evenmore:authorized', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      window.removeEventListener('evenmore:unauthorized', handleAuthChange);
      window.removeEventListener('evenmore:authorized', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, [location]);

  if (!signedIn) {
    // If scanning a batch QR code or A-to-Z traceability without sign-in, redirect directly to public passport
    const batchMatch = location.pathname.match(/^\/inventory\/batches\/([^/]+)(\/a-to-z)?\/?$/i);
    if (batchMatch) {
      return <Navigate to={`/public/batch/${encodeURIComponent(batchMatch[1])}${location.search}`} replace />;
    }
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (mustChangePassword && location.pathname !== '/change-password') {
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/change-password?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <Outlet />;
}
