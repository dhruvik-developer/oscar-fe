import { useEffect, useRef, useState, useMemo } from 'react';
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  Target,
  Users,
  Briefcase,
  ShoppingCart,
  Package,
  Layers,
  Palette,
  Landmark,
  UserCheck,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  FileSpreadsheet,
  FilePlus2,
  Receipt,
  ArrowDownLeft,
  RotateCcw,
  Boxes,
  MapPin,
  ArrowLeftRight,
  Wrench,
  AlertTriangle,
  PieChart,
  Award,
  CalendarCheck,
  ListChecks,
  ClipboardList,
  Factory,
  UserPlus,
  UserX,
  GraduationCap,
  TrendingUp,
  Hourglass,
  Shield,
  MessagesSquare,
  Send,
  User,
  ShieldCheck,
  PackageCheck, // [PHASE-2B] Goods Receipt (GRN) nav icon
  GitCompare, // Bill Matching nav icon
  Calendar,
  Sliders,
  Search,
  X,
  Sun,
  Moon,
  Sparkles,
  TreePine,
  Waves,
  BookOpen,
  Check,
  CheckCircle2,
  LogOut,
  Spool,
  CircleCheck,
  Tag,
  Warehouse,
  Lock,
  Truck,
  FlaskConical,
  DollarSign,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import BrandLogo, { useBrandName } from '../common/BrandLogo';
import { usePmsStore, computeNavBadges } from '../../stores/pmsStore';
import { useERP } from '../../context/ERPContext';
import { useModuleWhenIdle } from '../../hooks/useIdleReady';
import { UserGuideModal } from '../common/UserGuideModal';
import { clearStoredAuth } from '../../utils/authUtils';

const SIDEBAR_THEMES = [
  { id: 'oscar', name: 'Oscar', icon: Waves, color: '#14b8a6' },
  { id: 'light', name: 'Light', icon: Sun, color: '#1f6bff' },
  { id: 'dark', name: 'Dark', icon: Moon, color: '#3b82f6' },
  { id: 'midnight', name: 'Midnight', icon: Sparkles, color: '#818cf8' },
  { id: 'emerald', name: 'Emerald', icon: TreePine, color: '#10b981' },
];

export function getEffectiveRoleCode(user) {
  if (!user) return '';
  if (typeof user.roleCode === 'string') return user.roleCode.toUpperCase();
  if (user.role && typeof user.role.code === 'string') return user.role.code.toUpperCase();
  if (typeof user.role === 'string') return user.role.toUpperCase();
  return '';
}

export function isUserAdmin(user, permissions = []) {
  if (!user) return false;
  if (user.is_superuser || user.isSuperuser || permissions.includes('*')) return true;
  const roleCode = getEffectiveRoleCode(user);
  if (roleCode === 'OWNER' || roleCode === 'AD' || roleCode === 'SYS_ADMIN' || roleCode === 'ADMIN') return true;
  const email = (user.email || '').toLowerCase();
  if (email.startsWith('admin@') || email.startsWith('oscar@')) return true;
  return false;
}

// A nav entry either names one permission code or one of these "any of"
// groups. Keeping the groups here means the sidebar and the route guard can
// never drift apart.
export const PARTIES_PERMISSIONS = ['view_masters', 'view_purchase', 'view_sales', 'view_inventory'];
export const ADMIN_PERMISSIONS = ['menu_admin', 'view_approvals', 'view_alerts', 'view_staff'];
export const REPORTS_PERMISSIONS = ['export_excel', 'view_owner_mis', 'view_financial_reports'];

/** The permission requirement a single nav item contributes, if any. */
export function getItemPermissionRequirement(item) {
  if (item.label === 'Parties') return { anyOf: PARTIES_PERMISSIONS };
  if (item.label === 'Administration') return { anyOf: ADMIN_PERMISSIONS };
  if (item.label === 'Reports') return { anyOf: REPORTS_PERMISSIONS };
  if (item.permission) return { allOf: [item.permission] };
  return null;
}

/** Does a requirement hold for this user? No requirement means everyone. */
export function isRequirementMet(requirement, user, permissions = [], hasPermission) {
  if (!requirement) return true;
  if (!user) return true;
  if (isUserAdmin(user, permissions)) return true;
  const granted = (code) => Boolean(hasPermission?.(code)) || permissions.includes(code);

  if (requirement.allOf) return requirement.allOf.every(granted);
  if (requirement.anyOf) return requirement.anyOf.some(granted);
  return true;
}

export function isItemPermitted(item, user, permissions = [], hasPermission) {
  if (!user) return true;
  if (isUserAdmin(user, permissions)) return true;
  return isRequirementMet(getItemPermissionRequirement(item), user, permissions, hasPermission);
}

function filterNavByPermissions(items, user, permissions = [], hasPermission) {
  if (!user || isUserAdmin(user, permissions)) return items;

  return items
    .map((item) => {
      if (!isItemPermitted(item, user, permissions, hasPermission)) {
        return null;
      }
      if (item.children) {
        const filteredChildren = filterNavByPermissions(item.children, user, permissions, hasPermission);
        if (filteredChildren.length === 0 && !item.to) {
          return null;
        }
        return { ...item, children: filteredChildren };
      }
      return item;
    })
    .filter(Boolean);
}

export const NAV = [
  {
    label: 'Dashboard',
    icon: Home,
    to: '/dashboard',
  },

  // Every employee: self-service portal to request leave, assets, attendance regularization, and punch in/out
  {
    label: 'Employee Portal',
    icon: UserCheck,
    to: '/employee/portal',
  },

  {
    label: 'CRM',
    icon: LayoutGrid,
    permission: 'menu_crm',
    defaultOpen: false,
    children: [
      { label: 'Dashboard', icon: LayoutGrid, to: '/crm/dashboard' },
      {
        label: 'Leads',
        icon: Target,
        defaultOpen: true,
        children: [
          { label: 'Leads', icon: Users, to: '/crm/leads', dot: true },
          { label: 'Lost Leads', icon: UserX, to: '/crm/leads/lost' },
          { label: 'Lead Create Form', icon: FilePlus2, to: '/crm/leads/forms' },
          { label: 'Lead Tasks Master', icon: ClipboardList, to: '/crm/leads/tasks-master' },
          { label: 'Lead Stage Tasks', icon: Layers, to: '/crm/leads/stage-tasks' },
        ],
      },
      {
        label: 'Tasks',
        icon: ListChecks,
        defaultOpen: true,
        children: [
          { label: 'Tasks List', to: '/crm/tasks' },
          { label: 'Task Allocation', to: '/crm/tasks/allocation' },
        ],
      },
      { label: 'Deals', icon: TrendingUp, to: '/crm/deals' },
      { label: 'Contracts', icon: FileText, to: '/crm/contracts' },
      {
        label: 'CRM Setup',
        icon: Sliders,
        defaultOpen: false,
        children: [
          { label: 'Lead Stages', to: '/crm/system-setup' },
          { label: 'Deal Stages', to: '/crm/deal-stages' },
          { label: 'Lead Sources', to: '/crm/lead-sources' },
        ],
      },
    ],
  },

  {
    label: 'PMS (Projects)',
    icon: Briefcase,
    permission: 'menu_pms',
    children: [
      { label: 'PMS Dashboard', icon: Home, to: '/pms' },
      { label: 'All Projects', icon: Layers, to: '/pms/projects' },
      { label: 'My Projects', icon: UserCheck, to: '/pms/my-projects' },
      {
        label: 'Production',
        icon: Factory,
        defaultOpen: true,
        children: [
          { label: 'Production Dashboard', icon: BarChart3, to: '/pms/production-dashboard' },
          { label: 'Production Instructions', icon: ClipboardList, to: '/pms/production-instructions' },
          { label: 'Daily Production', icon: CalendarCheck, to: '/pms/daily-production' },
          { label: 'Production Completion & Verification', icon: CheckCircle2, to: '/pms/production-completion' },
        ],
      },
      {
        label: 'Job Work / Processing',
        icon: Wrench,
        defaultOpen: false,
        children: [
          { label: 'Process Plan', icon: ClipboardList, to: '/job-work/process-plan' },
          { label: 'Job Work Orders (JWO)', icon: FileText, to: '/job-work/orders' },
          { label: 'Job Work Outward', icon: Send, to: '/job-work/outward' },
          { label: 'Job Work Inward', icon: ArrowDownLeft, to: '/job-work/inward' },
          { label: 'Pending Register', icon: Hourglass, to: '/job-work/pending-register' },
          { label: 'Vendor Reconciliation', icon: GitCompare, to: '/job-work/vendor-reconciliation' },
          { label: 'Processor Ledger', icon: BookOpen, to: '/job-work/processor-ledger' },
          { label: 'Reprocess', icon: RotateCcw, to: '/job-work/reprocess' },
          { label: 'ITC-04 Job Work', icon: FileSpreadsheet, to: '/job-work/itc-04' },
        ],
      },
      { label: 'Timeline & Gantt', icon: Calendar, to: '/pms/timeline' },
      { label: 'Delay Center', icon: AlertTriangle, to: '/pms/delays', badgeKey: 'pmsDelayedCount', badgeColor: '#ef4444' },
      { label: 'PMS Reports', icon: PieChart, to: '/pms/reports' },
    ],
  },

  {
    label: 'Sales',
    icon: BarChart3,
    permission: 'menu_sales',
    children: [
      { label: 'Quotations', icon: FileText, to: '/sales/quotations' },
      { label: 'Sales Orders', icon: ShoppingCart, to: '/sales/orders' },
      { label: 'Proforma Invoices', icon: FileSpreadsheet, to: '/sales/proforma' },
      { label: 'Sales Invoices', icon: Receipt, to: '/sales/invoices' },
      { label: 'Delivery Challans', icon: Send, to: '/sales/delivery' },
      // [DISABLED] Warranty Cards concept commented out
      // { label: 'Warranty Cards', icon: ShieldCheck, to: '/sales/warranty' },
      { label: 'Broker Commissions', icon: DollarSign, to: '/sales/broker-commissions' },
      { label: 'Sales Returns', icon: RotateCcw, to: '/sales/returns' },
      { label: 'Payment In', icon: ArrowDownLeft, to: '/sales/payments' },
    ],
  },

  {
    label: 'Purchase',
    icon: ShoppingCart,
    permission: 'menu_purchase',
    children: [
      { label: 'Purchase Orders', icon: ClipboardList, to: '/purchase/orders' },
      { label: 'Supplier Delivery', icon: Truck, to: '/purchase/deliveries' },
      { label: 'Final Job Work POs', icon: FileSpreadsheet, to: '/purchase/final-job-work-pos' },
      { label: 'Goods Receipt', icon: PackageCheck, to: '/purchase/receipts' },
      { label: 'Supplier Reconciliation', icon: GitCompare, to: '/purchase/reconciliation' },
      { label: 'Supplier Ledger', icon: BookOpen, to: '/purchase/supplier-ledger' },
      { label: 'Vendor Bills', icon: Receipt, to: '/purchase/vendor-bills' },
      { label: 'Bill Matching', icon: GitCompare, to: '/purchase/bill-matching' },
      { label: 'Purchase Bills', icon: Receipt, to: '/purchase/bills' },
      { label: 'Purchase Returns', icon: RotateCcw, to: '/purchase/returns' },
      { label: 'Payment Out', icon: ArrowDownLeft, to: '/purchase/payments' },
      { label: 'Expenses', icon: Landmark, to: '/purchase/expenses' },
    ],
  },

  {
    label: 'Parties',
    icon: Building2,
    to: '/parties',
  },

  {
    label: 'Inventory',
    icon: Package,
    permission: 'menu_inventory',
    children: [
      { label: 'Dashboard', icon: Home, to: '/inventory/dashboard' },
      { label: 'Total Inventory', icon: Package, to: '/inventory/items' },
      { label: 'Fabric Quality Master', icon: Spool, to: '/inventory/fabric/quality' },
      { label: 'Design Master', icon: Layers, to: '/inventory/fabric/design' },
      { label: 'Colour / Shade Master', icon: Palette, to: '/inventory/fabric/colour' },
      { label: 'Textile Operations Masters', icon: Wrench, to: '/inventory/masters/textile' },
      { label: 'Fabric Item / Variant Master', icon: Boxes, to: '/inventory/fabric/variants' },
      {
        label: 'Categories',
        icon: Layers,
        defaultOpen: false,
        navigateOnOpen: true,
        children: [
          { label: 'Fabric Categories', to: '/inventory/categories', dot: true },
          { label: 'Fabric Type / Classification', to: '/inventory/categories/fabric-type' },
          { label: 'Units of Measurement (UOM)', to: '/inventory/categories/uom' },
        ],
      },
      {
        label: 'Stock Position',
        icon: BarChart3,
        defaultOpen: false,
        navigateOnOpen: true,
        children: [
          { label: 'Fabric Stock Overview', to: '/inventory/stock-position', dot: true },
          { label: 'Sample Inventory', to: '/inventory/stock-position?type=sample' },
          { label: 'Scrap & Waste Inventory', to: '/inventory/stock-position?type=wastage' },
          { label: 'Usable Fabric Stock', to: '/inventory/stock-position?type=good' },
          { label: 'Reprocessing Stock', to: '/inventory/stock-position?type=reprocess' },
          { label: 'Customer Return Stock', to: '/inventory/stock-position?type=customer-return' },
        ],
      },
      {
        label: 'QC (Quality Check)', icon: CircleCheck, to: '/inventory/qc',
        navigateOnOpen: true,
        children: [
          { label: 'QC Dashboard', to: '/inventory/qc', dot: true },
          { label: 'Pending Inspections', to: '/inventory/qc/pending' },
          { label: 'QC Inspection Register', to: '/inventory/qc/register' },
          { label: 'QC Results & Disposition', to: '/inventory/qc/results' },
          { label: 'Reinspection / Reprocess', to: '/inventory/qc/reinspection' },
          { label: 'QC Reports', to: '/inventory/qc/reports' },
        ],
      },
      { label: 'Lot / Taka Register', icon: FileText, to: '/inventory/lot-register' },
      { label: 'Taka Tag Print', icon: Tag, to: '/inventory/taka-tags' },
      { label: 'Sample Management', icon: FlaskConical, to: '/inventory/samples' },
      { label: 'Logistics / Trips', icon: Truck, to: '/inventory/trips' },
      { label: 'Transfers', icon: ArrowLeftRight, to: '/inventory/transfers' },
      { label: 'Godown / Rack', icon: Warehouse, to: '/inventory/locations' },
      { label: 'Valuation & Ageing', icon: TrendingUp, to: '/inventory/valuation' },
      { label: 'Lot Costing & Profitability', icon: DollarSign, to: '/inventory/lot-costing' },
      { label: 'Month-End Audit', icon: CalendarCheck, to: '/inventory/audit' },
    ],
  },

  {
    label: 'Accounts',
    icon: Landmark,
    permission: 'menu_accounts',
    children: [
      { label: 'Day Book & Position', icon: BookOpen, to: '/accounts/day-book' },
      { label: 'Cash / Bank', icon: Landmark, to: '/accounts/cash-bank' },
      { label: 'General Ledger', icon: FileText, to: '/accounts/general-ledger' },
      { label: 'Debit / Credit Notes', icon: Receipt, to: '/accounts/notes' },
      { label: 'Financial Reports', icon: PieChart, to: '/accounts/reports' },
      { label: 'Chart of Accounts', icon: ListChecks, to: '/accounts/chart-of-accounts' },
      { label: 'Expense Categories', icon: Tag, to: '/accounts/expense-categories' },
      // Ledger postings from payroll, incentive, brokerage, expenses, payments.
      // Admin-only: needs view_audit_logs (Owner / Admin / System Admin).
      { label: 'Accounting Log', icon: ClipboardList, to: '/accounts/accounting-log', permission: 'view_audit_logs' },
    ],
  },

  {
    label: 'HRMS',
    icon: UserCheck,
    permission: 'menu_hrms',
    children: [
      { label: 'Dashboard', icon: Home, to: '/hrms/dashboard' },
      { label: 'Employees', icon: Users, to: '/hrms/employees' },
      {
        label: 'Attendance',
        icon: CalendarCheck,
        defaultOpen: false,
        children: [
          { label: 'Overview', to: '/hrms/attendance', dot: true },
          { label: 'Mark Attendance', to: '/hrms/attendance/mark' },
          { label: 'Individual', to: '/hrms/attendance/individual' },
          { label: 'Bulk', to: '/hrms/attendance/bulk' },
          { label: 'Requests', to: '/hrms/attendance/requests' },
          { label: 'Flexibility', to: '/hrms/attendance/flexibility' },
        ],
      },
      { label: 'Leave', icon: CalendarCheck, to: '/hrms/leave' },
      { label: 'Payroll', icon: Receipt, to: '/hrms/payroll' },
      { label: 'Incentives', icon: Award, to: '/hrms/incentives' },
      // Recruitment commented out per Oscar letter pad scope (kept for reference, do not remove):
      // {
      //   label: 'Recruitment',
      //   icon: UserPlus,
      //   defaultOpen: false,
      //   children: [
      //     { label: 'Dashboard', to: '/hrms/recruitment', dot: true },
      //     { label: 'Jobs', to: '/hrms/recruitment/jobs' },
      //     { label: 'Candidates', to: '/hrms/recruitment/candidates' },
      //     { label: 'Interviews', to: '/hrms/recruitment/interviews' },
      //     { label: 'Applications', to: '/hrms/recruitment/applications' },
      //     { label: 'Offers', to: '/hrms/recruitment/offers' },
      //     { label: 'Onboarding', to: '/hrms/recruitment/onboarding' },
      //     { label: 'Career', to: '/hrms/recruitment/career' },
      //     { label: 'Custom Questions', to: '/hrms/recruitment/questions' },
      //     // { label: 'Funnel', to: '/hrms/recruitment/funnel' }, // Hidden: Recruitment Funnel feature commented out
      //   ],
      // },
      {
        label: 'Performance',
        icon: TrendingUp,
        defaultOpen: false,
        children: [
          { label: 'Dashboard', to: '/hrms/performance', dot: true },
          { label: 'Indicators', to: '/hrms/performance/indicators' },
          { label: 'KPI Data', to: '/hrms/performance/kpi-data' },
          { label: 'Appraisal', to: '/hrms/performance/appraisal' },
          { label: 'Appraisal Funnel', to: '/hrms/performance/appraisal-funnel' },
          // { label: 'Goal Tracking', to: '/hrms/performance/goal-tracking' }, // Hidden: Goal Tracking feature commented out
          // { label: 'Goal Funnel', to: '/hrms/performance/goal-funnel' }, // Hidden: Goal Funnel feature commented out
        ],
      },
      // { label: 'Training', icon: GraduationCap, to: '/hrms/training' }, // Hidden: Training feature commented out
      { label: 'HR Admin', icon: ShieldCheck, to: '/hrms/hr-admin' },
      { label: 'Asset Setup', icon: Briefcase, to: '/hrms/assets' },
      { label: 'Documents', icon: FileText, to: '/hrms/documents' },
      { label: 'Company Policy', icon: ShieldCheck, to: '/hrms/company-policy' },
      { label: 'Calendar', icon: Calendar, to: '/hrms/calendar' },
      // { label: 'HRMS Setup', icon: Sliders, to: '/hrms/hrms-setup' }, // Hidden: HRMS Setup commented out
    ],
  },

  {
    label: 'Organization',
    icon: Building2,
    permission: 'menu_hrms',
    defaultOpen: false,
    children: [
      { label: 'Org Chart', to: '/hrms/org-chart', dot: true },
      { label: 'Departments', to: '/hrms/departments' },
      { label: 'Locations', to: '/hrms/locations' },
      { label: 'Designations', to: '/hrms/designations' },
    ],
  },

  {
    label: 'Reports',
    icon: BarChart3,
    children: [
      { label: 'Standard Reports', to: '/reports', dot: true },
      { label: 'Owner Executive MIS', to: '/reports/owner-mis' },
    ],
  },

  {
    label: 'Administration',
    icon: Shield,
    children: [
      { label: 'My Approvals', icon: ShieldCheck, to: '/administration/approvals' },
      { label: 'Alert Center', icon: AlertTriangle, to: '/administration/alerts' },
      { label: 'Users', to: '/administration/users' },
      { label: 'Roles', to: '/administration/roles' },
      { label: 'Clients', to: '/administration/clients' },
    ],
  },

  {
    label: 'Settings',
    icon: Settings,
    to: '/administration/settings',
  },
];

// Flatten all defined navigation paths to compute accurate specificity
function collectNavPaths(items) {
  const paths = [];
  function walk(list) {
    for (const item of list) {
      if (item.to) paths.push(item.to);
      if (item.children) walk(item.children);
    }
  }
  walk(items);
  return paths;
}

const ALL_NAV_PATHS = collectNavPaths(NAV);

function isRouteActive(targetPath, currentPath) {
  if (!targetPath) return false;
  // 1. Exact match
  if (currentPath === targetPath) return true;

  // 2. Prefix match only if no other nav item matches currentPath more specifically
  if (currentPath.startsWith(targetPath + '/')) {
    // If an exact match exists in the navigation tree for currentPath, then prefix match is false
    const exactMatchExists = ALL_NAV_PATHS.some((p) => p === currentPath);
    if (exactMatchExists) return false;

    // Otherwise, check if this is the longest matching prefix
    const matchingPrefixes = ALL_NAV_PATHS.filter(
      (p) => currentPath === p || currentPath.startsWith(p + '/')
    );
    // Sort descending by path length
    matchingPrefixes.sort((a, b) => b.length - a.length);
    return matchingPrefixes[0] === targetPath;
  }

  return false;
}

// Links such as `/inventory/stock-position?type=sample` share a pathname and
// differ only by query. NavLink ignores the query, so these are matched here:
// a query link is active when the URL carries all of its params, and the plain
// sibling (`/inventory/stock-position`) only when no query sibling matches.
function queryMatches(target, search) {
  const [, query = ''] = target.split('?');
  const current = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([k, v]) => current.get(k) === v);
}

function isQueryLinkActive(to, { pathname, search }) {
  const [path, query] = to.split('?');
  if (pathname !== path) return false;
  if (query) return queryMatches(to, search);
  return !ALL_NAV_PATHS.some((p) => p.startsWith(`${path}?`) && queryMatches(p, search));
}

function hasQuerySiblings(to) {
  if (!to) return false;
  const path = to.split('?')[0];
  return ALL_NAV_PATHS.some((p) => p.startsWith(`${path}?`));
}

// The page a group opens when `navigateOnOpen` is set: its `dot` child.
function defaultChildPath(item) {
  const children = item.children || [];
  return (children.find((c) => c.dot && c.to) || children.find((c) => c.to))?.to;
}

// ── Filter navigation tree recursively by search query ──────
function filterNavTree(items, query) {
  if (!query || !query.trim()) return items;
  const q = query.toLowerCase().trim();

  function filterItem(item) {
    const labelMatch = String(item.label ?? '').toLowerCase().includes(q);

    if (item.children) {
      const filteredChildren = item.children
        .map(filterItem)
        .filter(Boolean);

      if (labelMatch || filteredChildren.length > 0) {
        return {
          ...item,
          children: filteredChildren.length > 0 ? filteredChildren : item.children,
          forceOpen: true,
        };
      }
      return null;
    }

    return labelMatch ? item : null;
  }

  return items.map(filterItem).filter(Boolean);
}

// ── Sub-item (leaf node) ────────────────────────────────────
// ── Nav count badge ─────────────────────────────────────────
// Defaults to the original blue pill; `color` (hex) opts a row into its own
// tone, e.g. the red used by the PMS Delay Center.
function NavBadge({ count, color }) {
  if (!count) return null;

  if (!color) {
    return (
      <span className="ml-auto px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
        {count}
      </span>
    );
  }

  return (
    <span
      className="ml-auto px-1.5 py-0.2 text-[10px] font-bold rounded-full border"
      style={{ background: `${color}33`, color, borderColor: `${color}4d` }}
    >
      {count}
    </span>
  );
}

function NavPill({ pill }) {
  if (!pill) return null;
  return (
    <span className="ml-auto px-1.5 py-0.5 text-[9.5px] font-bold rounded-full bg-blue-500/25 text-blue-300 border border-blue-400/30 leading-none">
      {pill}
    </span>
  );
}

function SubItem({ item, depth = 1, badges = {} }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const isExact = currentPath === item.to;
  const isFormBuilderAlias =
    item.label === 'Lead Create Form' &&
    (currentPath === '/crm/leads/forms' || currentPath === '/crm/leads/form-builder' || currentPath === '/crm/leads/create-form');
  const isPrefix = Boolean(item.to && currentPath.startsWith(item.to + '/'));
  const hasBetterMatch =
    isPrefix &&
    (isFormBuilderAlias ||
      ALL_NAV_PATHS.some(
        (p) =>
          p !== item.to &&
          (currentPath === p || (currentPath.startsWith(p + '/') && p.length > item.to.length))
      ) ||
      (item.to === '/crm/leads' &&
        (currentPath === '/crm/leads/forms' ||
          currentPath === '/crm/leads/form-builder' ||
          currentPath === '/crm/leads/create-form')));
  const queryLink = hasQuerySiblings(item.to);
  const isActive = queryLink
    ? isQueryLinkActive(item.to, location)
    : isFormBuilderAlias || isExact || (isPrefix && !hasBetterMatch);
  // NavLink's own match ignores the query string, so query links skip it.
  const linkActive = (navActive) => isActive || (!queryLink && navActive);
  const count = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
  const Icon = item.icon;
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const setTrainingEnabled = useAppStore((s) => s.setTrainingEnabled);
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const setRecruitmentEnabled = useAppStore((s) => s.setRecruitmentEnabled);
  const isTrainingRow = item.label === 'Training';
  const isRecruitmentLeaf = item.label === 'Recruitment';
  const leafEnabled = isTrainingRow ? trainingEnabled : recruitmentEnabled;
  const setLeafEnabled = isTrainingRow ? setTrainingEnabled : setRecruitmentEnabled;

  // Training (and any module leaf) — toggle removed, render as normal link.
  // if ((isTrainingRow || isRecruitmentLeaf) && Icon && item.to) {
  //   return (
  //     <div
  //       className={`sub-group-row${isActive ? ' active section-active' : ''}${leafEnabled ? '' : ' opacity-60'}`}
  //       title={item.label}
  //     >
  //       <NavLink
  //         to={leafEnabled ? item.to : '#'}
  //         end
  //         onClick={(e) => {
  //           if (!leafEnabled) e.preventDefault();
  //         }}
  //         className={`flex items-center gap-2 flex-1 min-w-0${leafEnabled ? '' : ' pointer-events-none'}`}
  //       >
  //         <Icon size={16} strokeWidth={2} className="nav-ico" />
  //         <span className="nav-txt">{item.label}</span>
  //         <NavBadge count={count} color={item.badgeColor} />
  //       </NavLink>
  //       <ModuleToggle enabled={leafEnabled} onToggle={setLeafEnabled} label={item.label} />
  //     </div>
  //   );
  // }

  // Icon leaves (e.g. CRM > Dashboard, Sales > Proforma Invoices, etc.) render like nav row with icon
  if (Icon && item.to) {
    return (
      <NavLink
        to={item.to}
        end
        title={item.label}
        className={({ isActive: navActive }) =>
          `sub-group-row${linkActive(navActive) ? ' active section-active' : ''}`
        }
      >
        <Icon size={16} strokeWidth={2} className="nav-ico" />
        <span className="nav-txt">{item.label}</span>
        <NavPill pill={item.pill} />
        <NavBadge count={count} color={item.badgeColor} />
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.to || '#'}
      end
      title={item.label}
      className={({ isActive: navActive }) =>
        `sub-item${linkActive(navActive) ? ' active section-active' : ''}`
      }
    >
      <span className="sub-dot" />
      <span className="sub-label">{item.label}</span>
      <NavPill pill={item.pill} />
      <NavBadge count={count} color={item.badgeColor} />
    </NavLink>
  );
}

// ── Sub-list (group of sub-items) ───────────────────────────
function SubList({ items, depth = 1, badges }) {
  const isDeep = depth >= 2;
  return (
    <div className={isDeep ? 'sub-list-deep' : 'sub-list'}>
      {items.map((item) => {
        if (item.children) {
          return (
            <ExpandableRow key={item.label} item={item} depth={depth} badges={badges} />
          );
        }
        return <SubItem key={item.label} item={item} depth={depth} badges={badges} />;
      })}
    </div>
  );
}

// ── Oscar fabric footer (sidebar bottom, Tailwind) ──
// Photo comes from `public/fabric.png` (`public/febric.png` also tried).
// ── Oscar Vector Textile Brand Card & Footer (Pure SVG/CSS — No Raster Images) ──
function FabricFooter() {
  return (
    <div className="relative mx-0.5 mb-2 p-2.5 rounded-xl border border-teal-500/25 bg-gradient-to-r from-teal-950/60 via-[#071f2b]/90 to-teal-950/40 overflow-hidden select-none shadow-xs group">
      {/* Dynamic Vector Textile Weave Waves */}
      <svg
        viewBox="0 0 260 65"
        fill="none"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none opacity-40 transition-opacity duration-300 group-hover:opacity-60"
      >
        <defs>
          <linearGradient id="weaveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#0d9488" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="weaveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5eead4" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#0f766e" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <path
          d="M0 24 C 45 6, 85 46, 130 26 S 210 6, 260 26"
          stroke="url(#weaveGrad1)"
          strokeWidth="1.6"
        />
        <path
          d="M0 38 C 55 18, 95 54, 145 32 S 210 16, 260 36"
          stroke="url(#weaveGrad2)"
          strokeWidth="1.2"
          strokeDasharray="4 2"
        />
        <path
          d="M0 50 C 65 28, 115 60, 170 38 S 220 26, 260 46"
          stroke="#2dd4bf"
          strokeWidth="0.8"
          strokeOpacity="0.35"
        />
      </svg>

      {/* Decorative ambient radial glow */}
      <div className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-teal-400/10 blur-xl pointer-events-none" />

      {/* Oscar ERP Textile Tagline & Icon */}
      <div className="relative z-10 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-teal-300 to-teal-500 shadow-sm shadow-teal-400/50 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-[0.22em] text-white/95 uppercase truncate leading-tight font-mono">
              WEAVE • PROCESS • GROW
            </p>
            <p className="text-[9px] font-semibold text-teal-300/80 tracking-wider truncate mt-0.5">
              OSCAR TEXTILE ERP
            </p>
          </div>
        </div>
        <Waves size={15} className="text-teal-400/70 shrink-0 ml-1.5" />
      </div>
    </div>
  );
}

function ModuleToggle({ enabled, onToggle, label }) {
  const id = `mod-toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <label
      htmlFor={id}
      title={`${label} ${enabled ? 'ON — click to hide module' : 'OFF — click to show module'}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`relative inline-flex shrink-0 w-9 h-5 rounded-full cursor-pointer ring-1 transition-colors ${
        enabled ? 'bg-emerald-500 ring-emerald-300/60' : 'bg-slate-500/70 ring-white/25'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Toggle ${label} module`}
        className="sr-only"
      />
      <span
        className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all ${
          enabled ? 'left-[18px]' : 'left-[2px]'
        }`}
      />
    </label>
  );
}

// ── Expandable group row ────────────────────────────────────
function ExpandableRow({ item, depth = 0, badges = {} }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(Boolean(item.defaultOpen || item.forceOpen));

  useEffect(() => {
    if (item.forceOpen) {
      setOpen(true);
    }
  }, [item.forceOpen]);
  const Icon = item.icon;
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const setRecruitmentEnabled = useAppStore((s) => s.setRecruitmentEnabled);
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const setTrainingEnabled = useAppStore((s) => s.setTrainingEnabled);

  const isModuleRow = item.label === 'Recruitment' || item.label === 'Training';
  const moduleEnabled = item.label === 'Recruitment' ? recruitmentEnabled : trainingEnabled;
  const setModuleEnabled = item.label === 'Recruitment' ? setRecruitmentEnabled : setTrainingEnabled;

  // Auto-open if a child route is active. Query links match on their path.
  const onPath = (to) => {
    const path = to?.split('?')[0];
    return Boolean(path) && (location.pathname === path || location.pathname.startsWith(path + '/'));
  };
  const isChildActive = item.children?.some(
    (c) => onPath(c.to) || c.children?.some((sub) => onPath(sub.to))
  );

  // Groups flagged `navigateOnOpen` open their default page, so the highlight
  // follows the click. Inside the group already, a click only collapses/expands.
  const toggleGroup = () => {
    const target = item.navigateOnOpen && !isChildActive ? defaultChildPath(item) : null;
    if (target) {
      setOpen(true);
      navigate(target);
      return;
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (isChildActive) {
      setOpen(true);
    }
  }, [isChildActive]);

  const isActive = item.to && (location.pathname === item.to || location.pathname.startsWith(item.to + '/'));

  if (item.to && !item.children) {
    // Training is a direct link — toggle removed, render as normal link.
    // if (item.label === 'Training') {
    //   return (
    //     <div className={`nav-row group ${moduleEnabled ? '' : 'opacity-60'}`} title={item.label}>
    //       <NavLink
    //         to={moduleEnabled ? item.to : '#'}
    //         end
    //         onClick={(e) => {
    //           if (!moduleEnabled) e.preventDefault();
    //         }}
    //         className={`flex items-center gap-2 flex-1 min-w-0 ${moduleEnabled ? '' : 'pointer-events-none'}`}
    //       >
    //         {Icon && <Icon size={18} strokeWidth={1.9} className="nav-ico" />}
    //         <span className="nav-txt">{item.label}</span>
    //       </NavLink>
    //       <ModuleToggle enabled={moduleEnabled} onToggle={setModuleEnabled} label={item.label} />
    //     </div>
    //   );
    // }
    // Simple root nav row (direct link like Parties, Reports)
    return (
      <NavLink
        to={item.to}
        end
        title={item.label}
        className={({ isActive: directActive }) =>
          `nav-row${directActive || isActive ? ' section-active' : ''}`
        }
      >
        {Icon && <Icon size={18} strokeWidth={1.9} className="nav-ico" />}
        <span className="nav-txt">{item.label}</span>
      </NavLink>
    );
  }

  const isRoot = depth === 0;
  const groupCount = item.badgeKey ? (badges?.[item.badgeKey] ?? 0) : 0;
  // Recruitment / Training — toggle removed, always show as normal expandable group.
  const showChildren = open;

  if (isModuleRow) {
    return (
      <div className="nav-group">
        <div
          title={item.label}
          className={
            isRoot
              ? `nav-row${isChildActive ? ' parent-active' : isActive ? ' section-active' : ''}`
              : `sub-group-row${isChildActive ? ' parent-active' : ''}`
          }
        >
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
            }}
            className="flex items-center gap-2 flex-1 min-w-0 bg-transparent border-0 p-0 text-left cursor-pointer"
          >
            {Icon && <Icon size={isRoot ? 18 : 16} strokeWidth={1.9} className="nav-ico" />}
            <span className="nav-txt">{item.label}</span>
            <NavBadge count={groupCount} color={item.badgeColor} />
          </button>
          {/* <ModuleToggle enabled={moduleEnabled} onToggle={setModuleEnabled} label={item.label} /> */}
          <span className="nav-chev">
            {open ? <ChevronDown size={isRoot ? 14 : 12} /> : <ChevronRight size={isRoot ? 14 : 12} />}
          </span>
        </div>
        {showChildren && item.children && (
          <SubList items={item.children} depth={depth + 1} badges={badges} />
        )}
      </div>
    );
  }

  return (
    <div className="nav-group">
      <button
        type="button"
        onClick={toggleGroup}
        title={item.label}
        className={
          isRoot
            ? `nav-row${isChildActive ? ' parent-active' : isActive ? ' section-active' : ''}`
            : `sub-group-row${isChildActive ? ' parent-active' : ''}`
        }
      >
        {Icon && <Icon size={isRoot ? 18 : 16} strokeWidth={1.9} className="nav-ico" />}
        <span className="nav-txt">{item.label}</span>
        <NavBadge count={groupCount} color={item.badgeColor} />
        {item.children && (
          <span className="nav-chev">
            {open ? <ChevronDown size={isRoot ? 14 : 12} /> : <ChevronRight size={isRoot ? 14 : 12} />}
          </span>
        )}
      </button>
      {showChildren && item.children && (
        <SubList items={item.children} depth={depth + 1} badges={badges} />
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────
export default function Sidebar() {
  const navigate = useNavigate();
  const sidebarWidth = useAppStore((s) => s.sidebarWidth) ?? 280;
  const brandName = useBrandName('EVENMORE INFOTECH');
  const setSidebarWidth = useAppStore((s) => s.setSidebarWidth);
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen);
  const currentUser = useAppStore((s) => s.currentUser);
  const permissions = useAppStore((s) => s.permissions) || [];
  const hasPermission = useAppStore((s) => s.hasPermission);
  const theme = useAppStore((s) => s.theme) || 'light';
  const setTheme = useAppStore((s) => s.setTheme);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const profileRef = useRef(null);
  const isDraggingRef = useRef(false);

  const permittedNav = useMemo(() => {
    return filterNavByPermissions(NAV, currentUser, permissions, hasPermission);
  }, [currentUser, permissions, hasPermission]);

  const filteredNav = useMemo(() => filterNavTree(permittedNav, searchQuery), [permittedNav, searchQuery]);

  const visibleNav = filteredNav;

  // PMS live nav counters. Subscribe to stable slices and derive, so the
  // selector never hands useSyncExternalStore a fresh object each render.
  //
  // `.raw` subscribes without pulling PMS: a badge in the sidebar must not be
  // the reason every screen in the app loads the project list. `useModuleWhenIdle`
  // asks for it once the browser has finished with the page the user opened.
  const shellReady = useModuleWhenIdle('pms');
  const pmsProjects = usePmsStore.raw((s) => s.projects);
  const pmsCurrentUserId = usePmsStore.raw((s) => s.currentUserId);
  const pmsBadges = useMemo(
    () => computeNavBadges(pmsProjects, pmsCurrentUserId),
    [pmsProjects, pmsCurrentUserId]
  );

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let badges = { zone: 0, faulty: 0, ...pmsBadges };
  try {
    const erp = useERP();
    // Reading these is what loads them, so they wait for the same idle moment.
    if (erp && shellReady) {
      badges.zone = erp.zoneRequests?.filter((r) => r.status === 'Requested')?.length || 0;
      badges.faulty = erp.faultyParts?.filter((f) => f.status === 'Reported' || f.status === 'Sent for Replacement')?.length || 0;
    }
  } catch { }

  const handleResizeStart = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - startX;
      const nextWidth = Math.min(380, Math.max(220, startWidth + dx));
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseup', onMouseUp, { once: true });
  };

  // Mobile drawer: any link inside the sidebar dismisses it (including a
  // re-click on the current route, which does not change the pathname).
  function handleNavClick(e) {
    if (e.target.closest?.('a[href]')) setMobileSidebarOpen(false);
  }

  return (
    <>
    <aside className="sidebar" style={{ width: sidebarWidth }} onClick={handleNavClick}>
      <div className="side-top">
        {/* Brand Header */}
        <div className="brand-block">
          <div className="brand-left">
            <span className="brand-logo">
              <BrandLogo size={28} strokeWidth={2.6} />
            </span>
            <div className="min-w-0">
              <div className="brand-name">{brandName}</div>
              <div className="brand-tag">PEOPLE | PROCESS | PROGRESS</div>
            </div>
          </div>
          {/* Mobile drawer close (below lg only) */}
          <button
            type="button"
            className="brand-menu sidebar-mobile-close"
            onClick={() => setMobileSidebarOpen(false)}
            aria-label="Close navigation"
            title="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar Above Navigation */}
        <div className="px-1 pb-2.5 pt-0.5">
          <div className="relative flex items-center bg-white/5 border border-white/10 rounded-xl focus-within:border-blue-400/60 focus-within:bg-white/10 transition-all">
            <Search size={14} className="ml-2.5 text-slate-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search tabs & menus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-400 py-2 pl-2 pr-7 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-white p-0.5 rounded transition cursor-pointer"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="side-nav" aria-label="Primary navigation">
          {visibleNav.length > 0 ? (
            visibleNav.map((item) => (
              <ExpandableRow key={item.label} item={item} depth={0} badges={badges} />
            ))
          ) : (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              <p>No tabs match &ldquo;{searchQuery}&rdquo;</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 text-blue-400 hover:underline text-[11px] cursor-pointer"
              >
                Clear filter
              </button>
            </div>
          )}
        </nav>
      </div>

            {/* Sticky Bottom User Profile & Oscar Footer Section */}
      <div
        className={
          theme === 'oscar'
            ? 'mt-auto pt-2 px-2 pb-2 border-t border-teal-500/20 bg-gradient-to-b from-transparent via-[#071f2b]/40 to-[#071f2b]/90 relative'
            : 'mt-auto pt-2 px-1 pb-1 border-t border-white/10 relative'
        }
        ref={profileRef}
      >
        {/* Oscar textile brand card — 100% Vector SVG & CSS, zero raster photo dependency */}
        {theme === 'oscar' && (
          <FabricFooter />
        )}

        <button
          type="button"
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className={
            theme === 'oscar'
              ? 'w-full flex items-center justify-between p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 backdrop-blur-md transition cursor-pointer text-left group shadow-xs'
              : 'w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/10 transition cursor-pointer text-left group'
          }
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs ring-1 ring-white/20">
              {currentUser?.initials || '—'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate leading-tight">
                {currentUser?.name || 'Signed out'}
              </p>
              <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                {currentUser?.role || ''}
              </p>
            </div>
          </div>
          <ChevronDown
            size={14}
            className={`text-slate-400 group-hover:text-white transition-transform duration-150 ${isProfileOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Rich Theme-Adaptive Profile Popup Menu */}
        {isProfileOpen && (
          <div className="absolute bottom-full left-1 right-1 mb-2 p-3 rounded-2xl bg-[#0f172a]/95 border border-white/20 text-white shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl ring-1 ring-black/40">
            {/* User Profile Header */}
            <div className="flex items-center gap-3 pb-3 border-b border-white/10 mb-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/20">
                {currentUser?.initials || '—'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-bold truncate text-white">{currentUser?.name || 'Signed out'}</p>
                  <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate">{currentUser?.email || ''}</p>
                <div className="mt-1">
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-blue-300 border border-white/10">
                    {currentUser?.role || ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Theme Switcher */}
            <div className="pb-2.5 mb-2.5 border-b border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Theme Mode</span>
                <span className="text-[9px] text-blue-400 capitalize">{theme}</span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {SIDEBAR_THEMES.map((t) => {
                  const Icon = t.icon;
                  const isSelected = theme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTheme(t.id)}
                      className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5'
                      }`}
                      title={t.name}
                    >
                      <Icon size={12} className="mb-0.5" />
                      <span className="text-[9px] leading-none">{t.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="space-y-0.5 text-xs">
              <Link
                to="/hrms/dashboard"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <User size={13} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">HR Profile & Attendance</span>
              </Link>
              <Link
                to="/administration/users"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <ShieldCheck size={13} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">Administration & Roles</span>
              </Link>
              <Link
                to="/administration/settings"
                onClick={() => setIsProfileOpen(false)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition group"
              >
                <Settings size={13} className="text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">System Preferences & Currency</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  setIsGuideOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/10 text-slate-200 hover:text-white transition text-left cursor-pointer group"
              >
                <BookOpen size={13} className="text-amber-400 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-medium">Interactive User Guides</span>
              </button>

              {/* Sign Out / Switch User Button in Person Profile */}
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  clearStoredAuth();
                  navigate('/login');
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-rose-500/15 text-rose-300 hover:text-rose-200 transition text-left cursor-pointer group mt-1"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut size={13} className="text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-medium">Log Out / Switch Account</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-medium">
                  Login
                </span>
              </button>
            </div>

            {/* Footer / Session */}
            <div className="pt-2 mt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="text-[9px] text-slate-400">Evenmore Cloud v2.6</span>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false);
                  clearStoredAuth();
                  navigate('/login');
                }}
                className="hover:text-rose-400 flex items-center gap-1 cursor-pointer transition text-slate-300"
                title="Lock Session & Return to Login"
              >
                <Lock size={10} />
                <span>Lock</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Visual Drag Handle for Sidebar Width (hidden below lg) */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleResizeStart}
        title="Drag to resize sidebar width"
      >
        <div className="resize-thumb" />
      </div>
    </aside>

    {/* Interactive Global User Guide Modal — rendered outside the aside so the
        mobile drawer's transform never becomes its containing block. */}
    <UserGuideModal
      isOpen={isGuideOpen}
      onClose={() => setIsGuideOpen(false)}
    />
    </>
  );
}
