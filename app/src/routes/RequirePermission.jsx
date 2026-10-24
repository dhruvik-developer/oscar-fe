import React, { useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { isRequirementMet } from '../components/layout/Sidebar';
import { getRouteRequirement } from './permissions';
import ForbiddenPage from '../components/ui/ForbiddenPage';
import { hasStoredSession } from '../utils/authUtils';

/**
 * RequirePermission — route-level counterpart to the sidebar's nav filter.
 *
 * On its own it derives the requirement for the current pathname from the same
 * `NAV` data the sidebar uses. It can also gate an explicit `permission` or
 * `anyOf` when wrapping a single element. A user who lacks the permission sees
 * the 403 page instead of the screen, even when the URL was typed directly.
 *
 * The guard defers judgement while the user is being resolved so that a token
 * refresh in flight (currentUser briefly null while SessionGate re-fetches
 * /auth/me/) does not incorrectly flash the 403 page. Once both the user and
 * the requirement are resolved the gate is authoritative.
 */
export default function RequirePermission({ permission = null, anyOf = null, children }) {
  const { pathname } = useLocation();
  const currentUser = useAppStore((s) => s.currentUser);
  const permissions = useAppStore((s) => s.permissions) || [];
  const hasPermission = useAppStore((s) => s.hasPermission);

  const requirement = useMemo(() => {
    if (permission) return { allOf: [permission] };
    if (anyOf?.length) return { anyOf };
    return getRouteRequirement(pathname);
  }, [permission, anyOf, pathname]);

  // A path with no requirement (dashboard, self-service portal, settings) is
  // open to every authenticated user.
  if (!requirement) return children ?? <Outlet />;

  // While the session is being resolved (currentUser not yet populated but a
  // stored session exists), defer rather than deny — RequireAuth already
  // guarantees a session is present here, and SessionGate renders a spinner
  // during the initial resolve. This branch handles the narrow window when
  // SessionGate re-resolves after a successful token refresh (evenmore:authorized).
  if (!currentUser && hasStoredSession()) return children ?? <Outlet />;

  const allowed = Boolean(currentUser) && isRequirementMet(requirement, currentUser, permissions, hasPermission);

  if (!allowed) return <ForbiddenPage />;

  return children ?? <Outlet />;
}
