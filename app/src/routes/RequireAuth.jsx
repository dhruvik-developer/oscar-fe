import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { hasStoredSession } from '../utils/authUtils';

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
    const returnTo = location.pathname + location.search;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  return <Outlet />;
}
