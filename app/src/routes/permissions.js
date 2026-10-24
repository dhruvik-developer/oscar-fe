/**
 * Route permission map.
 *
 * The sidebar already decides what a user may see from the `NAV` tree. This
 * module walks that same tree and turns each path into the permission
 * requirement it inherits, so a URL typed directly is refused by exactly the
 * rule that would have hidden its menu entry.
 *
 * A requirement is `{ allOf: [code] }` or `{ anyOf: [code, …] }`; `null` means
 * every signed-in user may open the path.
 */
import {
  NAV,
  ADMIN_PERMISSIONS,
  PARTIES_PERMISSIONS,
  REPORTS_PERMISSIONS,
  getItemPermissionRequirement,
} from '../components/layout/Sidebar';

/** `/foo/?x=1` → `/foo`; `/` stays `/`. */
function normalizePath(path) {
  if (!path) return '/';
  const clean = String(path).split('?')[0].replace(/\/+$/, '');
  return clean || '/';
}

function walkNav(items, inherited, out) {
  for (const item of items) {
    const own = getItemPermissionRequirement(item);
    const requirement = own ?? inherited;

    if (item.to) out.push({ path: normalizePath(item.to), requirement });
    if (item.children) walkNav(item.children, requirement, out);
  }
}

/**
 * Module roots derived from the nav tree. A few route groups live under a
 * module (job work under PMS, company policy under HRMS), and alias paths
 * redirect into a module, so they are listed explicitly. The leaf rules from
 * `NAV` still win by being longer/more specific.
 *
 * `/administration` itself redirects to `/administration/settings` which is
 * open to every authenticated user (the Settings page has no permission of its
 * own). Only the admin-only sub-paths are gated. Listing them explicitly here
 * instead of using the `/administration` prefix prevents the prefix rule from
 * accidentally blocking the settings redirect for non-admin users.
 */
function moduleRules() {
  return [
    { path: '/crm', requirement: { allOf: ['menu_crm'] } },
    { path: '/pms', requirement: { allOf: ['menu_pms'] } },
    { path: '/job-work', requirement: { allOf: ['menu_pms'] } },
    { path: '/sales', requirement: { allOf: ['menu_sales'] } },
    { path: '/purchase', requirement: { allOf: ['menu_purchase'] } },
    { path: '/inventory', requirement: { allOf: ['menu_inventory'] } },
    { path: '/masters', requirement: { allOf: ['menu_inventory'] } },
    { path: '/accounts', requirement: { allOf: ['menu_accounts'] } },
    { path: '/hrms', requirement: { allOf: ['menu_hrms'] } },
    { path: '/company-policy', requirement: { allOf: ['menu_hrms'] } },
    { path: '/parties', requirement: { anyOf: PARTIES_PERMISSIONS } },
    { path: '/reports', requirement: { anyOf: REPORTS_PERMISSIONS } },
    // Admin-only sub-paths under /administration. The root itself redirects to
    // /administration/settings which is unrestricted, so we gate the children
    // directly rather than using the prefix.
    { path: '/administration/approvals', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/administration/alerts', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/administration/users', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/administration/roles', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/administration/clients', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/admin', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/approvals', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/alerts', requirement: { anyOf: ADMIN_PERMISSIONS } },
    { path: '/warranty', requirement: { allOf: ['menu_sales'] } },
  ];
}

const NAV_RULES = [];
walkNav(NAV, null, NAV_RULES);

const RULES = [...NAV_RULES, ...moduleRules()];

const EXACT_RULES = new Map();
for (const rule of RULES) {
  if (!EXACT_RULES.has(rule.path)) {
    EXACT_RULES.set(rule.path, rule.requirement);
  } else if (rule.requirement === null) {
    // Duplicate paths (e.g. Employee Portal at root and under HRMS) are open
    // if any nav entry that points at them is open.
    EXACT_RULES.set(rule.path, null);
  }
}

// Only non-null rules participate in prefix matching: a null exact rule must
// not accidentally make an entire subtree public.
const PREFIX_RULES = RULES.filter((rule) => rule.requirement !== null);

/** Requirement for a pathname, or `null` when every signed-in user may open it. */
export function getRouteRequirement(pathname) {
  const path = normalizePath(pathname);

  if (EXACT_RULES.has(path)) return EXACT_RULES.get(path);

  let best = null;
  let bestLength = -1;
  for (const rule of PREFIX_RULES) {
    if (path !== rule.path && !path.startsWith(`${rule.path}/`)) continue;
    if (rule.path.length > bestLength) {
      best = rule;
      bestLength = rule.path.length;
    }
  }
  return best ? best.requirement : null;
}
