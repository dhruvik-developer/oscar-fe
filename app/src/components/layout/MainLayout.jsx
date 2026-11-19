import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { CommandPalette } from '../common/CommandPalette';
import { useAppStore } from '../../stores/appStore';
import { useProofApprovalSync } from '../../features/pms/approval/useProofApprovalSync';
import { useModuleHydration } from '../../hooks/useModuleHydration';
import { logout } from '../../services/authService';
import { isLoomAdminOrManager } from '../../features/pms/loom/DailyLoomEntryPage';

// ERP-only UI scope: graph.json global-shell guidance applied purely as a
// CSS class. CRM/HRMS routes never receive `erp-scope`, so their UI is
// untouched. No routing, data, or API logic changes here.
const ERP_PREFIXES = ['/dashboard', '/sales', '/purchase', '/inventory', '/parties', '/accounts', '/reports', '/pms'];

// Inside the "+ Add / Manage" popup (MasterSourceLink) the app runs in an
// iframe: show only the page, without the sidebar, topbar and floating widgets.
const IS_EMBEDDED = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();

export default function MainLayout() {
  const sidebarWidth = useAppStore((s) => s.sidebarWidth) ?? 280;
  const toast = useAppStore((s) => s.toast);
  const clearToast = useAppStore((s) => s.clearToast);
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const mobileSidebarOpen = useAppStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen);
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentUser = useAppStore((s) => s.currentUser);
  const isErpRoute = ERP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const isStandaloneQuery = searchParams.get('standalone') === '1' || searchParams.get('direct') === '1';
  // Standalone kiosk view is ONLY active when accessed via link query (?standalone=1 or ?direct=1) or iframe.
  // In the real system, the sidebar & full navigation shell remain visible for all users.
  const showStandaloneOnly = IS_EMBEDDED || isStandaloneQuery;

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {}
    navigate('/login');
  };

  // Fill the module stores from the API for this session.
  useModuleHydration();

  // Pick up design approvals taken in a client's approval-link tab.
  useProofApprovalSync();

  // Global keydown for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key ?? '').toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Auto-close the mobile navigation drawer on route navigation.
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  // Global guard: Prevent negative inputs in number fields across PMS and positive-only inputs
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (
        (e.key === '-' || e.key === 'Subtract' || e.key === 'e' || e.key === '+') &&
        e.target &&
        e.target.tagName === 'INPUT' &&
        e.target.type === 'number'
      ) {
        const minAttr = e.target.getAttribute('min');
        if (
          minAttr === '0' ||
          Number(minAttr) >= 0 ||
          e.target.closest('.pms-screen')
        ) {
          e.preventDefault();
        }
      }
    };

    const handleGlobalInput = (e) => {
      if (
        e.target &&
        e.target.tagName === 'INPUT' &&
        e.target.type === 'number' &&
        (e.target.closest('.pms-screen') || Number(e.target.getAttribute('min')) >= 0)
      ) {
        const val = e.target.value;
        if (val !== '' && Number(val) < 0) {
          e.target.value = '0';
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('input', handleGlobalInput, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('input', handleGlobalInput, true);
    };
  }, []);

  // Escape closes the mobile navigation drawer.
  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  // Leaving the drawer breakpoint (e.g. rotating a tablet) drops any open drawer.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e) => {
      if (e.matches) setMobileSidebarOpen(false);
    };
    desktop.addEventListener('change', handleChange);
    return () => desktop.removeEventListener('change', handleChange);
  }, [setMobileSidebarOpen]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => clearToast?.(), 3000);
    return () => window.clearTimeout(timer);
  }, [clearToast, toast]);

  if (showStandaloneOnly) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        {/* Minimal Kiosk / Focused Header Bar - No system navigation */}
        <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3.5 sm:px-6 flex items-center justify-between shadow-2xs sticky top-0 z-30">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
              E
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block tracking-tight">
                EVENMORE INFOTECH
              </span>
              <span className="text-[10px] text-slate-400 font-medium block -mt-0.5">
                Daily Loom Production Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentUser && (
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                  {currentUser.initials || currentUser.name?.[0] || 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[9px] text-slate-400 block leading-tight">
                    {currentUser.role?.name || (typeof currentUser.role === 'string' ? currentUser.role : 'Production Staff')}
                  </span>
                </div>
              </div>
            )}

            {/* Button to switch to Full System with Sidebar */}
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.delete('standalone');
                  url.searchParams.delete('direct');
                  window.location.href = url.pathname + url.search;
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors inline-flex"
                title="Open inside full ERP navigation shell"
              >
                Open Full System
              </button>
            )}

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/40"
              title="Sign Out"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </header>

        <main className={`flex-1 p-3 sm:p-6 max-w-7xl w-full mx-auto content${isErpRoute ? ' erp-scope' : ''}`}>
          <Outlet />
        </main>
        {toast && <div className="toast">{toast.msg}</div>}
      </div>
    );
  }

  return (
    <div
      className={`app-shell${mobileSidebarOpen ? ' mobile-nav-open' : ''}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
    >
      {/* Mobile navigation backdrop (below lg only) */}
      {mobileSidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <div className="main-col">
        <Topbar />
        <main className={`content${isErpRoute ? ' erp-scope' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Global Toast */}
      {toast && (
        <div className="toast">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
