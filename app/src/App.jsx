import { ERPProvider } from './context/ERPContext';
import SessionGate from './routes/SessionGate';
import AppRouter from './routes/index';

/**
 * Evenmore Unified Application
 *
 * Architecture:
 *   SessionGate (resolves the stored token into a real user via /auth/me/)
 *   └── ERPProvider (ERP global state — context API)
 *        └── AppRouter (react-router-dom v7)
 *             └── MainLayout (CRM-styled shell)
 *                  ├── Sidebar (unified navigation)
 *                  ├── Topbar (search + profile)
 *                  └── Routes (all CRM + HRMS + ERP pages)
 *
 * Every screen reads server data. Global UI state (theme, toast, sidebar) is in
 * Zustand (appStore); domain data is pulled through the module sync layers in
 * `services/` and held in ERPContext and the per-module stores. Nothing is
 * seeded locally — with no session there is no data, by design.
 */
export default function App() {
  return (
    <SessionGate>
      <ERPProvider>
        <AppRouter />
      </ERPProvider>
    </SessionGate>
  );
}
