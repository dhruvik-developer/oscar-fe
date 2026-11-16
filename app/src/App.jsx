import { ERPProvider } from './context/ERPContext';
import SessionGate from './routes/SessionGate';
import AppRouter from './routes/index';
import { GlobalModalProvider } from './context/ModalContext';

/**
 * Evenmore Unified Application
 *
 * Architecture:
 *   GlobalModalProvider (Universal ERP modal & popup system)
 *   └── SessionGate (resolves the stored token into a real user via /auth/me/)
 *        └── ERPProvider (ERP global state — context API)
 *             └── AppRouter (react-router-dom v7)
 *                  └── MainLayout (CRM-styled shell)
 *                       ├── Sidebar (unified navigation)
 *                       ├── Topbar (search + profile)
 *                       └── Routes (all CRM + HRMS + ERP pages)
 */
export default function App() {
  return (
    <GlobalModalProvider>
      <SessionGate>
        <ERPProvider>
          <AppRouter />
        </ERPProvider>
      </SessionGate>
    </GlobalModalProvider>
  );
}
