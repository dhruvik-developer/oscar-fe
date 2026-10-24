import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import RequireAuth from './RequireAuth';
import RequirePermission from './RequirePermission';
import { useAppStore } from '../stores/appStore';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { PageLoadingSkeleton } from '../components/common/PageLoadingSkeleton';

// ── CRM (Lazy Loaded) ───────────────────────────────────────
const LeadsPage = lazy(() => import('../features/crm/leads/LeadsPage'));
const CRMDashboardPage = lazy(() => import('../features/crm/dashboard/CRMDashboard'));
const LostLeadsPage = lazy(() => import('../features/crm/leads/LostLeadsPage'));
const LeadDetailPage = lazy(() => import('../features/crm/leads/LeadDetailPage'));
const LeadFormBuilderPage = lazy(() => import('../features/crm/leads/LeadFormBuilderPage'));
const LeadFormsPage = lazy(() => import('../features/crm/leads/LeadFormsPage'));
const DynamicLeadFormPage = lazy(() => import('../features/crm/leads/DynamicLeadFormPage'));
const TasksPage = lazy(() => import('../features/crm/tasks/TasksPage'));
const TaskAllocationPage = lazy(() => import('../features/crm/tasks/allocation/TaskAllocationPage'));
const TaskAllocationDetailPage = lazy(() => import('../features/crm/tasks/allocation/TaskAllocationDetailPage'));
const MasterTasksPage = lazy(() => import('../features/crm/tasks/MasterTasksPage'));
const StageTasksPage = lazy(() => import('../features/crm/tasks/StageTasksPage'));
const TaskFormPage = lazy(() => import('../features/crm/tasks/TaskFormPage'));
const TaskFormBuilderPage = lazy(() => import('../features/crm/tasks/TaskFormBuilderPage'));
// [REMOVED] CRM Projects concept removed from the CRM module.
//   `features/crm/projects/ProjectsPage.jsx` and `ProjectDetailPage.jsx` are kept
//   per the no-delete rule. Routes `crm/projects` and `crm/projects/:id` were
//   dropped; restore both if needed.
// const ProjectsPage = lazy(() => import('../features/crm/projects/ProjectsPage'));
const ContractsPage = lazy(() => import('../features/crm/contracts/ContractsPage'));
const ContractDetailPage = lazy(() => import('../features/crm/contracts/ContractDetailPage'));
// [REMOVED] CRM Projects concept removed — see ProjectsPage note above.
// const ProjectDetailPage = lazy(() => import('../features/crm/projects/ProjectDetailPage'));
const DealsPage = lazy(() => import('../features/crm/deals/DealsPage'));
// [REMOVED] User Tracking concept removed from the CRM module.
//   `features/crm/allocation/UserAllocationPage.jsx` is kept per the no-delete rule.
//   Route `crm/user-allocation` and its sidebar entry were dropped; restore both if needed.
// const UserAllocationPage = lazy(() => import('../features/crm/allocation/UserAllocationPage'));
const CRMSystemSetupPage = lazy(() => import('../features/crm/setup/CRMSystemSetupPage'));
const DealStagesPage = lazy(() => import('../features/crm/setup/DealStagesPage'));
const LeadSourcesPage = lazy(() => import('../features/crm/setup/LeadSourcesPage'));
// [REMOVED] CRM Reports concept removed from the CRM module.
//   `features/crm/reports/CRMReportsPage.jsx` is kept per the no-delete rule.
//   Route `crm/reports` and its sidebar entry were dropped; restore both if needed.
// const CRMReportsPage = lazy(() => import('../features/crm/reports/CRMReportsPage'));

// ── PMS — Project Management (Lazy Loaded) ───────────────────
const PMSDashboard = lazy(() => import('../features/pms/dashboard/PMSDashboard'));
const PMSProjectsPage = lazy(() => import('../features/pms/projects/ProjectsPage'));
const PMSProjectDetailPage = lazy(() => import('../features/pms/projects/ProjectDetailPage'));
const PMSMyProjectsPage = lazy(() => import('../features/pms/projects/MyProjectsPage'));
const PMSMyTasksPage = lazy(() => import('../features/pms/tasks/MyTasksPage'));
const PMSTimelinePage = lazy(() => import('../features/pms/timeline/TimelinePage'));
const PMSDelayDashboardPage = lazy(() => import('../features/pms/delays/DelayDashboardPage'));
const PMSReportsPage = lazy(() => import('../features/pms/reports/PMSReportsPage'));
const PMSSettingsPage = lazy(() => import('../features/pms/settings/PMSSettingsPage'));
const PMSClientProofApprovalPage = lazy(() => import('../features/pms/approval/ClientProofApprovalPage'));
const PMSProductionDashboardPage = lazy(() => import('../features/pms/production/ProductionDashboardPage'));
const PMSProductionInstructionsPage = lazy(() => import('../features/pms/production/ProductionInstructionsPage'));
const PMSDailyProductionPage = lazy(() => import('../features/pms/production/DailyProductionPage'));
const PMSPublicProductionEntryPage = lazy(() => import('../features/pms/production/PublicProductionEntryPage'));
const PMSProductionCompletionPage = lazy(() => import('../features/pms/production/ProductionCompletionVerificationPage'));

// ── HRMS (Lazy Loaded) ───────────────────────────────────────
const HRMSDashboard = lazy(() => import('../features/hrms/dashboard/Dashboard'));
const Employees = lazy(() => import('../features/hrms/employees/Employees'));
const AttendanceOverview = lazy(() => import('../features/hrms/attendance/Overview'));
const MarkAttendance = lazy(() => import('../features/hrms/attendance/MarkAttendance'));
const IndividualAttendance = lazy(() => import('../features/hrms/attendance/IndividualAttendance'));
const BulkAttendance = lazy(() => import('../features/hrms/attendance/BulkAttendance'));
const Requests = lazy(() => import('../features/hrms/attendance/Requests'));
const Flexibility = lazy(() => import('../features/hrms/attendance/Flexibility'));
const Leave = lazy(() => import('../features/hrms/leave/Leave'));
const Payroll = lazy(() => import('../features/hrms/payroll/Payroll'));
const RecruitmentDashboard = lazy(() => import('../features/hrms/recruitment/RecruitmentDashboard'));
const Jobs = lazy(() => import('../features/hrms/recruitment/Jobs'));
const JobDetails = lazy(() => import('../features/hrms/recruitment/JobDetails'));
const Candidates = lazy(() => import('../features/hrms/recruitment/Candidates'));
const CandidateDetails = lazy(() => import('../features/hrms/recruitment/CandidateDetails'));
const Interviews = lazy(() => import('../features/hrms/recruitment/Interviews'));
const InterviewDetails = lazy(() => import('../features/hrms/recruitment/InterviewDetails'));
const Applications = lazy(() => import('../features/hrms/recruitment/Applications'));
const Offers = lazy(() => import('../features/hrms/recruitment/Offers'));
const Onboarding = lazy(() => import('../features/hrms/recruitment/Onboarding'));
const Career = lazy(() => import('../features/hrms/recruitment/Career'));
const CustomQuestions = lazy(() => import('../features/hrms/recruitment/CustomQuestions'));
const RecruitmentFunnel = lazy(() => import('../features/hrms/recruitment/RecruitmentFunnel'));
const PerformanceDashboard = lazy(() => import('../features/hrms/performance/Dashboard'));
const Indicators = lazy(() => import('../features/hrms/performance/Indicators'));
const KpiData = lazy(() => import('../features/hrms/performance/KpiData'));
const Appraisal = lazy(() => import('../features/hrms/performance/Appraisal'));
const AppraisalFunnel = lazy(() => import('../features/hrms/performance/AppraisalFunnel'));
const GoalTracking = lazy(() => import('../features/hrms/performance/GoalTracking'));
const GoalFunnel = lazy(() => import('../features/hrms/performance/GoalFunnel'));
// const TrainingList = lazy(() => import('../features/hrms/performance/TrainingList'));
// const TrainingFunnel = lazy(() => import('../features/hrms/performance/TrainingFunnel'));
// const Trainers = lazy(() => import('../features/hrms/performance/Trainers'));
// const TrainingDashboard = lazy(() => import('../features/hrms/performance/TrainingDashboard'));
const OrgChartPage = lazy(() => import('../features/hrms/organization/OrgChartPage'));
const DepartmentsPage = lazy(() => import('../features/hrms/organization/DepartmentsPage'));
const DesignationsPage = lazy(() => import('../features/hrms/organization/DesignationsPage'));
const IncentivesPage = lazy(() => import('../features/hrms/incentives/IncentivesPage'));
const LocationsPage = lazy(() => import('../features/hrms/organization/LocationsPage'));
const AssetsPage = lazy(() => import('../features/hrms/organization/AssetsPage'));
const DocumentsPage = lazy(() => import('../features/hrms/organization/DocumentsPage'));
const CompanyPolicy = lazy(() => import('../features/hrms/organization/SimplePages').then(m => ({ default: m.CompanyPolicy })));
const CalendarPage = lazy(() => import('../features/hrms/organization/SimplePages').then(m => ({ default: m.CalendarPage })));
const HrmsSetup = lazy(() => import('../features/hrms/organization/SimplePages').then(m => ({ default: m.HrmsSetup })));
const HRAdminPage = lazy(() => import('../features/hrms/organization/SimplePages').then(m => ({ default: m.HRAdminPage })));

// ── Employee Self-Service Portal (Lazy Loaded) ────────────────
const EmployeePortal = lazy(() => import('../features/portal/EmployeePortal'));

// ── ERP — Job Work / Processing (Lazy Loaded) ───────────────────
const JobWorkOrdersPage = lazy(() => import('../features/jobwork/JobWorkOrdersPage'));
const JobWorkOrderDetailPage = lazy(() => import('../features/jobwork/JobWorkOrderDetailPage'));
const JobWorkOutwardPage = lazy(() => import('../features/jobwork/JobWorkOutwardPage'));
const JobWorkInwardPage = lazy(() => import('../features/jobwork/JobWorkInwardPage'));
const PendingRegisterPage = lazy(() => import('../features/jobwork/PendingRegisterPage'));
const VendorReconciliationPage = lazy(() => import('../features/jobwork/VendorReconciliationPage'));
const ReprocessPage = lazy(() => import('../features/jobwork/ReprocessPage'));
const ProcessorLedgerPage = lazy(() => import('../features/jobwork/ProcessorLedgerPage'));
const ProcessPlanListPage = lazy(() => import('../features/jobwork/ProcessPlanListPage'));
const ProcessPlanDetailPage = lazy(() => import('../features/jobwork/ProcessPlanDetailPage'));

// ── ERP — Sales (Lazy Loaded) ─────────────────────────────────
const QuotationsPage = lazy(() => import('../features/sales/QuotationsPage').then(m => ({ default: m.QuotationsPage })));
const QuotationComposerPage = lazy(() => import('../features/sales/QuotationComposerPage'));
const QuotationDetailPage = lazy(() => import('../features/sales/QuotationDetailPage'));
const SalesOrdersPage = lazy(() => import('../features/sales/SalesOrdersPage').then(m => ({ default: m.SalesOrdersPage })));
const ProformaInvoicesPage = lazy(() => import('../features/sales/ProformaInvoicesPage').then(m => ({ default: m.ProformaInvoicesPage })));
const SalesInvoicesPage = lazy(() => import('../features/sales/SalesInvoicesPage').then(m => ({ default: m.SalesInvoicesPage })));
const SalesReturnsPage = lazy(() => import('../features/sales/SalesReturnsPage').then(m => ({ default: m.SalesReturnsPage })));
const PaymentInPage = lazy(() => import('../features/sales/PaymentInPage').then(m => ({ default: m.PaymentInPage })));
const DeliveryChallansPage = lazy(() => import('../features/sales/DeliveryChallansPage').then(m => ({ default: m.DeliveryChallansPage })));
const BrokerCommissionPage = lazy(() => import('../features/sales/commercial/BrokerCommissionPage'));
// [DISABLED] Warranty Cards concept commented out
// const WarrantyListPage = lazy(() => import('../features/sales/WarrantyListPage').then(m => ({ default: m.WarrantyListPage })));

// ── ERP — Purchase (Lazy Loaded) ──────────────────────────────
const PurchaseOrdersPage = lazy(() => import('../features/purchase/PurchaseOrdersPage').then(m => ({ default: m.PurchaseOrdersPage })));
const SupplierDeliveryPage = lazy(() => import('../features/purchase/SupplierDeliveryPage'));
const FinalJobWorkPOsPage = lazy(() => import('../features/purchase/FinalJobWorkPOsPage'));
const PurchaseBillsPage = lazy(() => import('../features/purchase/PurchaseBillsPage').then(m => ({ default: m.PurchaseBillsPage })));
const VendorBillsPage = lazy(() => import('../features/purchase/VendorBillsPage').then(m => ({ default: m.VendorBillsPage })));
const BillMatchingPage = lazy(() => import('../features/purchase/BillMatchingPage').then(m => ({ default: m.BillMatchingPage })));
const PurchaseReturnsPage = lazy(() => import('../features/purchase/PurchaseReturnsPage').then(m => ({ default: m.PurchaseReturnsPage })));
const PaymentOutPage = lazy(() => import('../features/purchase/PaymentOutPage').then(m => ({ default: m.PaymentOutPage })));
const ExpensesPage = lazy(() => import('../features/purchase/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const GoodsReceiptPage = lazy(() => import('../features/purchase/GoodsReceiptPage').then(m => ({ default: m.GoodsReceiptPage })));
const SupplierReconciliationPage = lazy(() => import('../features/purchase/SupplierReconciliationPage'));
const SupplierLedgerPage = lazy(() => import('../features/purchase/SupplierLedgerPage'));
const TextileMastersPage = lazy(() => import('../features/masters/TextileMastersPage'));

// ── ERP — Inventory (Lazy Loaded) ─────────────────────────────
const ItemsMasterPage = lazy(() => import('../features/inventory/ItemsMasterPage').then(m => ({ default: m.ItemsMasterPage })));
const AddEditItemPage = lazy(() => import('../features/inventory/AddEditItemPage').then(m => ({ default: m.AddEditItemPage })));
const CategoriesPage = lazy(() => import('../features/inventory/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const StockPositionPage = lazy(() => import('../features/inventory/StockPositionPage').then(m => ({ default: m.StockPositionPage })));
const TransfersPage = lazy(() => import('../features/inventory/TransfersPage').then(m => ({ default: m.TransfersPage })));
const ERPLocationsPage = lazy(() => import('../features/inventory/LocationsPage').then(m => ({ default: m.LocationsPage })));
const FaultyPartsPage = lazy(() => import('../features/inventory/FaultyPartsPage').then(m => ({ default: m.FaultyPartsPage })));
const ServiceUsagePage = lazy(() => import('../features/inventory/ServiceUsagePage').then(m => ({ default: m.ServiceUsagePage })));
const ZoneRequestsPage = lazy(() => import('../features/inventory/ZoneRequestsPage').then(m => ({ default: m.ZoneRequestsPage })));
const ValuationAgeingPage = lazy(() => import('../features/inventory/ValuationAgeingPage').then(m => ({ default: m.ValuationAgeingPage })));
const MonthEndAuditPage = lazy(() => import('../features/inventory/MonthEndAuditPage').then(m => ({ default: m.MonthEndAuditPage })));
const InventoryDashboardPage = lazy(() => import('../features/inventory/InventoryDashboardPage').then(m => ({ default: m.InventoryDashboardPage })));
const FabricQualityPage = lazy(() => import('../features/inventory/masters/FabricQualityMasterPage'));
const DesignMasterPage = lazy(() => import('../features/inventory/masters/textileMasterPages').then(m => ({ default: m.DesignMasterPage })));
const ShadeMasterPage = lazy(() => import('../features/inventory/masters/ColourShadeMasterPage'));
const FabricVariantMasterPage = lazy(() => import('../features/inventory/masters/FabricVariantMasterPage'));
const FabricTypePage = lazy(() => import('../features/inventory/masters/textileMasterPages').then(m => ({ default: m.FabricTypePage })));
const UomPage = lazy(() => import('../features/inventory/masters/textileMasterPages').then(m => ({ default: m.UomPage })));
const QCDashboardPage = lazy(() => import('../features/inventory/qc/QCDashboardPage'));
const QCPendingInspectionsPage = lazy(() => import('../features/inventory/qc/QCPendingInspectionsPage'));
const QCInspectionRegisterPage = lazy(() => import('../features/inventory/qc/QCInspectionRegisterPage'));
const QCResultsDispositionPage = lazy(() => import('../features/inventory/qc/QCResultsDispositionPage'));
const QCReinspectionPage = lazy(() => import('../features/inventory/qc/QCReinspectionPage'));
const QCReportsPage = lazy(() => import('../features/inventory/qc/QCReportsPage'));
const LotTakaRegisterPage = lazy(() => import('../features/inventory/LotTakaRegisterPage'));
const TakaTagPrintPage = lazy(() => import('../features/inventory/TakaTagPrintPage'));
const SampleListPage = lazy(() => import('../features/inventory/samples/SampleListPage'));
const TripListPage = lazy(() => import('../features/inventory/logistics/TripListPage'));

// ── ERP — Parties (Lazy Loaded) ───────────────────────────────
const PartiesPage = lazy(() => import('../features/parties/PartiesPage'));
const CustomersPage = lazy(() => import('../features/parties/CustomersPage').then(m => ({ default: m.CustomersPage })));
const VendorsPage = lazy(() => import('../features/parties/VendorsPage').then(m => ({ default: m.VendorsPage })));

// ── ERP — Accounts (Lazy Loaded) ──────────────────────────────
const CashBankPage = lazy(() => import('../features/accounts/CashBankPage').then(m => ({ default: m.CashBankPage })));
const GeneralLedgerPage = lazy(() => import('../features/accounts/GeneralLedgerPage').then(m => ({ default: m.GeneralLedgerPage })));
const FinancialReportsPage = lazy(() => import('../features/accounts/FinancialReportsPage'));
const DayBookPage = lazy(() => import('../features/accounts/DayBookPage'));
const StandaloneNotesPage = lazy(() => import('../features/accounts/StandaloneNotesPage'));
const LotProfitabilityPage = lazy(() => import('../features/inventory/LotProfitabilityPage'));

// ── ERP — Reports & Settings (Lazy Loaded) ────────────────────
const ReportsPage = lazy(() => import('../features/reports/ReportsPage').then(m => ({ default: m.ReportsPage })));
const OwnerMISDashboardPage = lazy(() => import('../features/reports/OwnerMISDashboardPage'));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then(m => ({ default: m.SettingsPage })));

// ── Administration (Lazy Loaded) ──────────────────────────────
const UsersPage = lazy(() => import('../features/administration/UsersPage'));
const RolesPage = lazy(() => import('../features/administration/RolesPage'));
const ClientsPage = lazy(() => import('../features/administration/ClientsPage'));
const ApprovalsInboxPage = lazy(() => import('../features/administration/ApprovalsInboxPage'));
const AlertCenterPage = lazy(() => import('../features/administration/AlertCenterPage'));
const AccountingLogPage = lazy(() => import('../features/accounts/AccountingLogPage'));
const ChartOfAccountsPage = lazy(() => import('../features/accounts/ChartOfAccountsPage'));
const ExpenseCategoriesPage = lazy(() => import('../features/accounts/ExpenseCategoriesPage'));
const ITC04ReportPage = lazy(() => import('../features/jobwork/ITC04ReportPage'));

// ── Main Dashboard (Lazy Loaded) ──────────────────────────────
const DashboardPage = lazy(() => import('../features/sales/DashboardPage').then(m => ({ default: m.DashboardPage })));

function Page({ component: Component, ...rest }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoadingSkeleton />}>
        <Component {...rest} />
      </Suspense>
    </ErrorBoundary>
  );
}

// ── HRMS module gate ──
// When Recruitment / Training is toggled OFF in HR Admin, direct URLs for
// that module redirect back to the HRMS dashboard instead of rendering.
function RequireHrmsModule({ module, children }) {
  const recruitmentEnabled = useAppStore((s) => s.recruitmentEnabled ?? true);
  const trainingEnabled = useAppStore((s) => s.trainingEnabled ?? true);
  const enabled = module === 'recruitment' ? recruitmentEnabled : trainingEnabled;
  if (!enabled) return <Navigate to="/hrms/dashboard" replace />;
  return children;
}

function RecruitmentPage({ component: Component, ...rest }) {
  return (
    <RequireHrmsModule module="recruitment">
      <Page component={Component} {...rest} />
    </RequireHrmsModule>
  );
}

// function TrainingPage({ component: Component, ...rest }) {
//   return (
//     <RequireHrmsModule module="training">
//       <Page component={Component} {...rest} />
//     </RequireHrmsModule>
//   );
// }

function RootErrorBoundary() {
  const error = useRouteError();
  console.error('RootErrorBoundary caught error:', error);
  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred while loading this view.');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 520, width: '100%', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <h2 style={{ color: '#0f172a', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Application Encountered an Issue</h2>
        <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>An unexpected error occurred while loading this view.</p>
        {errorMessage && (
          <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 8, padding: '10px 14px', marginBottom: 20, textAlign: 'left', color: '#b91c1c', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {errorMessage}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 18px', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload Page
          </button>
          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{ background: '#1f6bff', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

const PublicQuotationPage = lazy(() => import('../features/sales/PublicQuotationPage'));
const LoginPage = lazy(() => import('../features/auth/LoginPage'));

const router = createBrowserRouter([
  // ── Authentication ────────────────────────────────────────
  {
    path: '/login',
    element: <Page component={LoginPage} />,
    errorElement: <RootErrorBoundary />,
  },
  // ── Client-facing design approval link ────────────────────
  // Deliberately outside MainLayout: the recipient is a customer, not a user of
  // the ERP, so the page carries no sidebar, topbar or internal navigation.
  {
    path: '/pms/approve/:token',
    element: <Page component={PMSClientProofApprovalPage} />,
    errorElement: <RootErrorBoundary />,
  },
  // ── Per-project daily production entry link (shop floor, no sign-in) ──
  {
    path: '/production-entry/:token',
    element: <Page component={PMSPublicProductionEntryPage} />,
    errorElement: <RootErrorBoundary />,
  },
  // ── Public quotation link (shared with customers, no sign-in) ──
  {
    path: '/quote/:quotationNumber/:secureToken',
    element: <Page component={PublicQuotationPage} />,
    errorElement: <RootErrorBoundary />,
  },
  // ── Protected Application Shell (Guarded by RequireAuth) ─
  {
    element: <RequireAuth />,
    errorElement: <RootErrorBoundary />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          // Every screen is wrapped by the same permission map the sidebar
          // filters with, so a directly typed URL cannot bypass the menu.
          {
            element: <RequirePermission />,
            children: [
          // Root redirect
          { index: true, element: <Navigate to="/dashboard" replace /> },

      // ── Main Dashboard ─────────────────────────────────────
      { path: 'dashboard', element: <Page component={DashboardPage} /> },
      { path: 'employee/portal', element: <Page component={EmployeePortal} /> },
      { path: 'employee-portal', element: <Navigate to="/employee/portal" replace /> },
      { path: 'portal', element: <Navigate to="/employee/portal" replace /> },
      { path: 'employee/requests', element: <Navigate to="/employee/portal" replace /> },
      { path: 'portal/employee', element: <Navigate to="/employee/portal" replace /> },

      // ── CRM ───────────────────────────────────────────────
      { path: 'crm', element: <Navigate to="/crm/dashboard" replace /> },
      { path: 'crm/dashboard', element: <Page component={CRMDashboardPage} title="CRM Dashboard" /> },
      { path: 'crm/leads', element: <Page component={LeadsPage} /> },
      { path: 'crm/leads/lost', element: <Page component={LostLeadsPage} /> },
      { path: 'crm/leads/:id', element: <Page component={LeadDetailPage} /> },
      { path: 'crm/leads/forms', element: <Page component={LeadFormsPage} /> },
      { path: 'crm/leads/tasks-master', element: <Page component={MasterTasksPage} /> },
      { path: 'crm/leads/task-form', element: <Page component={TaskFormPage} /> },
      { path: 'crm/leads/task-form/builder', element: <Page component={TaskFormBuilderPage} /> },
      { path: 'crm/leads/stage-tasks', element: <Page component={StageTasksPage} /> },
      { path: 'crm/leads/form-builder', element: <Page component={LeadFormBuilderPage} /> },
      { path: 'crm/leads/create-form', element: <Page component={DynamicLeadFormPage} /> },
      { path: 'crm/customers', element: <Page component={CustomersPage} /> },
      { path: 'crm/tasks', element: <Page component={TasksPage} /> },
      { path: 'crm/tasks/allocation', element: <Page component={TaskAllocationPage} /> },
      { path: 'crm/tasks/allocation/:id', element: <Page component={TaskAllocationDetailPage} /> },
      { path: 'crm/stage-tasks', element: <Page component={StageTasksPage} /> },
      // [REMOVED] `crm/projects` — CRM Projects concept removed from the CRM module.
      { path: 'crm/contracts', element: <Page component={ContractsPage} /> },
      { path: 'crm/contracts/:id', element: <Page component={ContractDetailPage} /> },
      // [REMOVED] `crm/projects/:id` — CRM Projects concept removed from the CRM module.
      { path: 'crm/deals', element: <Page component={DealsPage} /> },
      // [REMOVED] `crm/user-allocation` — User Tracking concept removed from the CRM module.
      { path: 'crm/system-setup', element: <Page component={CRMSystemSetupPage} /> },
      { path: 'crm/deal-stages', element: <Page component={DealStagesPage} title="Deal Stages" /> },
      { path: 'crm/lead-sources', element: <Page component={LeadSourcesPage} title="Lead Sources" /> },
      // [REMOVED] `crm/reports` — CRM Reports concept removed from the CRM module.
      { path: 'crm/quotations', element: <Page component={QuotationsPage} /> },

      // ── PMS — Project Management ──────────────────────────
      { path: 'pms', element: <Page component={PMSDashboard} /> },
      { path: 'pms/projects', element: <Page component={PMSProjectsPage} /> },
      { path: 'pms/projects/:id', element: <Page component={PMSProjectDetailPage} /> },
      { path: 'pms/my-projects', element: <Page component={PMSMyProjectsPage} /> },
      { path: 'pms/my-tasks', element: <Page component={PMSMyTasksPage} /> },
      { path: 'pms/timeline', element: <Page component={PMSTimelinePage} /> },
      { path: 'pms/delays', element: <Page component={PMSDelayDashboardPage} /> },
      { path: 'pms/reports', element: <Page component={PMSReportsPage} /> },
      { path: 'pms/settings', element: <Page component={PMSSettingsPage} /> },
      { path: 'pms/production-dashboard', element: <Page component={PMSProductionDashboardPage} /> },
      { path: 'pms/production-instructions', element: <Page component={PMSProductionInstructionsPage} /> },
      { path: 'pms/daily-production', element: <Page component={PMSDailyProductionPage} /> },
      { path: 'pms/production-completion', element: <Page component={PMSProductionCompletionPage} /> },
      // Salesperson incentive lives in HRMS only; old links land there.
      { path: 'production/incentives', element: <Navigate to="/hrms/incentives" replace /> },
      { path: 'pms/incentives', element: <Navigate to="/hrms/incentives" replace /> },

      // ── Job Work / Processing ─────────────────────────
      { path: 'job-work/process-plan', element: <Page component={ProcessPlanListPage} /> },
      { path: 'job-work/process-plan/create', element: <Page component={ProcessPlanListPage} /> },
      { path: 'job-work/process-plan/:id', element: <Page component={ProcessPlanDetailPage} /> },
      { path: 'job-work/orders', element: <Page component={JobWorkOrdersPage} /> },
      { path: 'job-work/orders/:id', element: <Page component={JobWorkOrderDetailPage} /> },
      { path: 'job-work/outward', element: <Page component={JobWorkOutwardPage} /> },
      { path: 'job-work/inward', element: <Page component={JobWorkInwardPage} /> },
      { path: 'job-work/pending-register', element: <Page component={PendingRegisterPage} /> },
      { path: 'job-work/vendor-reconciliation', element: <Page component={VendorReconciliationPage} /> },
      { path: 'job-work/processor-ledger', element: <Page component={ProcessorLedgerPage} /> },
      { path: 'job-work/reprocess', element: <Page component={ReprocessPage} /> },
      { path: 'job-work/itc-04', element: <Page component={ITC04ReportPage} title="ITC-04 Job Work Report" /> },

      // ── Sales ─────────────────────────────────────────────
      { path: 'sales', element: <Navigate to="/sales/quotations" replace /> },
      { path: 'sales/quotations/create', element: <Page component={QuotationComposerPage} /> },
      { path: 'sales/quotations/:id', element: <Page component={QuotationDetailPage} /> },
      { path: 'sales/quotations', element: <Page component={QuotationsPage} /> },
      { path: 'sales/orders', element: <Page component={SalesOrdersPage} /> },
      { path: 'sales/proforma', element: <Page component={ProformaInvoicesPage} /> },
      { path: 'sales/invoices', element: <Page component={SalesInvoicesPage} /> },
      { path: 'sales/returns', element: <Page component={SalesReturnsPage} /> },
      { path: 'sales/payments', element: <Page component={PaymentInPage} /> },
      { path: 'sales/delivery', element: <Page component={DeliveryChallansPage} /> },
      { path: 'sales/broker-commissions', element: <Page component={BrokerCommissionPage} title="Broker Commissions" /> },
      // [REMOVED] Customer Warranty concept removed product-wide
      { path: 'sales/warranty', element: <Navigate to="/sales/delivery" replace /> },
      { path: 'warranty', element: <Navigate to="/sales/delivery" replace /> },

      // ── Purchase ──────────────────────────────────────────
      { path: 'purchase', element: <Navigate to="/purchase/orders" replace /> },
      // [PHASE-4] DEAD ROUTE — `purchase/vendors` had no nav entry; parties live at `/parties`.
      //   Restore if a dedicated vendor workspace is ever needed:
      // { path: 'purchase/vendors', element: <Navigate to="/parties" replace /> },
      { path: 'purchase/orders', element: <Page component={PurchaseOrdersPage} /> },
      { path: 'purchase/deliveries', element: <Page component={SupplierDeliveryPage} /> },
      { path: 'purchase/supplier-delivery', element: <Page component={SupplierDeliveryPage} /> },
      { path: 'purchase/final-job-work-pos', element: <Page component={FinalJobWorkPOsPage} /> },
      { path: 'purchase/receipts', element: <Page component={GoodsReceiptPage} /> },
      { path: 'purchase/reconciliation', element: <Page component={SupplierReconciliationPage} /> },
      { path: 'purchase/supplier-ledger', element: <Page component={SupplierLedgerPage} /> },
      { path: 'purchase/bills', element: <Page component={PurchaseBillsPage} /> },
      { path: 'purchase/vendor-bills', element: <Page component={VendorBillsPage} /> },
      { path: 'purchase/bill-matching', element: <Page component={BillMatchingPage} /> },
      { path: 'purchase/returns', element: <Page component={PurchaseReturnsPage} /> },
      { path: 'purchase/payments', element: <Page component={PaymentOutPage} /> },
      { path: 'purchase/expenses', element: <Page component={ExpensesPage} /> },

      // ── Parties Directory ──────────────────────────────────
      { path: 'parties', element: <Page component={PartiesPage} /> },

      // ── Inventory ─────────────────────────────────────────
      { path: 'inventory', element: <Navigate to="/inventory/dashboard" replace /> },
      { path: 'inventory/dashboard', element: <Page component={InventoryDashboardPage} title="Inventory Dashboard" /> },
      { path: 'inventory/fabric/quality', element: <Page component={FabricQualityPage} /> },
      { path: 'inventory/fabric/design', element: <Page component={DesignMasterPage} /> },
      { path: 'inventory/fabric/colour', element: <Page component={ShadeMasterPage} /> },
      { path: 'inventory/fabric/variants', element: <Page component={FabricVariantMasterPage} /> },
      { path: 'inventory/masters/textile', element: <Page component={TextileMastersPage} /> },
      { path: 'masters/textile', element: <Navigate to="/inventory/masters/textile" replace /> },
      { path: 'inventory/categories/fabric-type', element: <Page component={FabricTypePage} /> },
      { path: 'inventory/categories/uom', element: <Page component={UomPage} /> },
      { path: 'inventory/qc', element: <Page component={QCDashboardPage} title="QC Dashboard" /> },
      { path: 'inventory/qc/pending', element: <Page component={QCPendingInspectionsPage} title="Pending Inspections" /> },
      { path: 'inventory/qc/register', element: <Page component={QCInspectionRegisterPage} title="QC Inspection Register" /> },
      { path: 'inventory/qc/results', element: <Page component={QCResultsDispositionPage} title="QC Results & Disposition" /> },
      { path: 'inventory/qc/reinspection', element: <Page component={QCReinspectionPage} title="QC Reinspection / Reprocess" /> },
      { path: 'inventory/qc/reports', element: <Page component={QCReportsPage} title="QC Reports" /> },
      { path: 'inventory/lot-register', element: <Page component={LotTakaRegisterPage} title="Lot / Taka Register" /> },
      { path: 'inventory/lots-takas', element: <Navigate to="/inventory/lot-register" replace /> },
      { path: 'inventory/taka-tags', element: <Page component={TakaTagPrintPage} title="Taka Tag Print" /> },
      { path: 'inventory/samples', element: <Page component={SampleListPage} title="Sample Management" /> },
      { path: 'inventory/trips', element: <Page component={TripListPage} title="Logistics & Tempo Trips" /> },
      { path: 'inventory/items', element: <Page component={ItemsMasterPage} /> },
      { path: 'inventory/items/fabric', element: <Page component={ItemsMasterPage} /> },
      { path: 'inventory/items/machines', element: <Page component={ItemsMasterPage} /> },
      { path: 'inventory/items/stock', element: <Navigate to="/inventory/items" replace /> },
      { path: 'inventory/machines', element: <Navigate to="/inventory/items/machines" replace /> },
      { path: 'inventory/items/new', element: <Page component={AddEditItemPage} /> },
      { path: 'inventory/items/edit/:id', element: <Page component={AddEditItemPage} /> },
      { path: 'inventory/categories', element: <Page component={CategoriesPage} /> },
      { path: 'inventory/categories/machines', element: <Page component={CategoriesPage} /> },
      { path: 'inventory/categories/machine', element: <Navigate to="/inventory/categories/machines" replace /> },
      { path: 'inventory/categories/stock', element: <Navigate to="/inventory/categories" replace /> },
      { path: 'inventory/stock-position', element: <Page component={StockPositionPage} /> },
      { path: 'inventory/stock', element: <Navigate to="/inventory/stock-position" replace /> },
      { path: 'inventory/transfers', element: <Page component={TransfersPage} /> },
      { path: 'inventory/locations', element: <Page component={ERPLocationsPage} /> },
      { path: 'inventory/faulty-parts', element: <Page component={FaultyPartsPage} /> },
      { path: 'inventory/service-usage', element: <Page component={ServiceUsagePage} /> },
      { path: 'inventory/zone-requests', element: <Page component={ZoneRequestsPage} /> },
      { path: 'inventory/valuation', element: <Page component={ValuationAgeingPage} /> },
      { path: 'inventory/lot-costing', element: <Page component={LotProfitabilityPage} title="Lot Costing & Profitability" /> },
      { path: 'inventory/lot-profitability', element: <Navigate to="/inventory/lot-costing" replace /> },
      { path: 'inventory/audit', element: <Page component={MonthEndAuditPage} /> },

      // ── Legacy Root Aliases ───────────────────────────────
      // [PHASE-4] NAV-AUDITED DEAD ALIASES — no sidebar/navigate() links point at these
      //   root-level aliases (inventory links use /inventory/...). Commented out per the
      //   no-delete rule; restore any alias if an old deep-link needs to keep working.
      // { path: 'items', element: <Navigate to="/inventory/items" replace /> },
      // { path: 'items/machines', element: <Navigate to="/inventory/items/machines" replace /> },
      // { path: 'items/stock', element: <Navigate to="/inventory/items/stock" replace /> },
      // { path: 'items/new', element: <Navigate to="/inventory/items/new" replace /> },
      // { path: 'items/edit/:id', element: <Page component={AddEditItemPage} /> },
      // { path: 'categories', element: <Navigate to="/inventory/categories" replace /> },
      // { path: 'categories/machine', element: <Navigate to="/inventory/categories/machines" replace /> },
      // { path: 'categories/machines', element: <Navigate to="/inventory/categories/machines" replace /> },
      // { path: 'categories/stock', element: <Navigate to="/inventory/categories/stock" replace /> },
      // { path: 'stock', element: <Navigate to="/inventory/stock-position" replace /> },
      // { path: 'transfers', element: <Navigate to="/inventory/transfers" replace /> },
      // { path: 'purchase-orders', element: <Navigate to="/purchase/orders" replace /> },

      // ── Accounts ──────────────────────────────────────────
      { path: 'accounts', element: <Navigate to="/accounts/cash-bank" replace /> },
      { path: 'accounts/day-book', element: <Page component={DayBookPage} title="Day Book & Position" /> },
      { path: 'accounts/cash-bank', element: <Page component={CashBankPage} /> },
      { path: 'accounts/general-ledger', element: <Page component={GeneralLedgerPage} /> },
      { path: 'accounts/notes', element: <Page component={StandaloneNotesPage} title="Debit / Credit Notes" /> },
      { path: 'accounts/reports', element: <Page component={FinancialReportsPage} /> },
      { path: 'accounts/accounting-log', element: <Page component={AccountingLogPage} title="Accounting Log" /> },
      { path: 'accounts/chart-of-accounts', element: <Page component={ChartOfAccountsPage} title="Chart of Accounts" /> },
      { path: 'accounts/expense-categories', element: <Page component={ExpenseCategoriesPage} title="Expense Categories" /> },

      // ── HRMS ──────────────────────────────────────────────
      { path: 'hrms', element: <Navigate to="/hrms/dashboard" replace /> },
      { path: 'hrms/dashboard', element: <Page component={HRMSDashboard} /> },
      { path: 'hrms/employees', element: <Page component={Employees} /> },
      { path: 'hrms/attendance', element: <Page component={AttendanceOverview} /> },
      { path: 'hrms/attendance/mark', element: <Page component={MarkAttendance} /> },
      { path: 'hrms/attendance/individual', element: <Page component={IndividualAttendance} /> },
      { path: 'hrms/attendance/bulk', element: <Page component={BulkAttendance} /> },
      { path: 'hrms/attendance/requests', element: <Page component={Requests} /> },
      { path: 'hrms/attendance/flexibility', element: <Page component={Flexibility} /> },
      { path: 'hrms/leave', element: <Page component={Leave} /> },
      { path: 'hrms/employee-portal', element: <Navigate to="/employee/portal" replace /> },
      { path: 'hrms/portal', element: <Navigate to="/employee/portal" replace /> },
      { path: 'hrms/payroll', element: <Page component={Payroll} /> },
      // Recruitment routes commented out per Oscar letter pad scope (kept for reference, do not remove):
      // { path: 'hrms/recruitment', element: <RecruitmentPage component={RecruitmentDashboard} /> },
      // { path: 'hrms/recruitment/jobs', element: <RecruitmentPage component={Jobs} /> },
      // { path: 'hrms/recruitment/jobs/:id', element: <RecruitmentPage component={JobDetails} /> },
      // { path: 'hrms/recruitment/candidates', element: <RecruitmentPage component={Candidates} /> },
      // { path: 'hrms/recruitment/candidates/:id', element: <RecruitmentPage component={CandidateDetails} /> },
      // { path: 'hrms/recruitment/interviews', element: <RecruitmentPage component={Interviews} /> },
      // { path: 'hrms/recruitment/interviews/:id', element: <RecruitmentPage component={InterviewDetails} /> },
      // { path: 'hrms/recruitment/applications', element: <RecruitmentPage component={Applications} /> },
      // { path: 'hrms/recruitment/offers', element: <RecruitmentPage component={Offers} /> },
      // { path: 'hrms/recruitment/onboarding', element: <RecruitmentPage component={Onboarding} /> },
      // { path: 'hrms/recruitment/career', element: <RecruitmentPage component={Career} /> },
      // { path: 'hrms/recruitment/questions', element: <RecruitmentPage component={CustomQuestions} /> },
      // { path: 'hrms/recruitment/funnel', element: <Page component={RecruitmentFunnel} /> }, // Hidden: Recruitment Funnel feature commented out
      { path: 'hrms/performance', element: <Page component={PerformanceDashboard} /> },
      { path: 'hrms/performance/indicators', element: <Page component={Indicators} /> },
      { path: 'hrms/performance/kpi-data', element: <Page component={KpiData} /> },
      { path: 'hrms/performance/appraisal', element: <Page component={Appraisal} /> },
      { path: 'hrms/performance/appraisal-funnel', element: <Page component={AppraisalFunnel} /> },
      // { path: 'hrms/performance/goal-tracking', element: <Page component={GoalTracking} /> }, // Hidden: Goal Tracking feature commented out
      // { path: 'hrms/performance/goal-funnel', element: <Page component={GoalFunnel} /> }, // Hidden: Goal Funnel feature commented out
      // { path: 'hrms/training', element: <TrainingPage component={TrainingDashboard} /> }, // Hidden: Training feature commented out
      // { path: 'hrms/training/list', element: <TrainingPage component={() => <TrainingDashboard initialTab="list" />} /> },
      // { path: 'hrms/training/training-funnel', element: <TrainingPage component={() => <TrainingDashboard initialTab="funnel" />} /> },
      // { path: 'hrms/training/trainers', element: <TrainingPage component={() => <TrainingDashboard initialTab="trainers" />} /> },
      // { path: 'hrms/training/funnel', element: <TrainingPage component={() => <TrainingDashboard initialTab="funnel" />} /> },
      // { path: 'hrms/training', element: <Navigate to="/hrms/dashboard" replace /> }, // Hidden: Training feature commented out
      // { path: 'hrms/training/*', element: <Navigate to="/hrms/dashboard" replace /> }, // Hidden: Training feature commented out
      { path: 'hrms/org-chart', element: <Page component={OrgChartPage} /> },
      { path: 'hrms/departments', element: <Page component={DepartmentsPage} /> },
      { path: 'hrms/designations', element: <Page component={DesignationsPage} /> },
      { path: 'hrms/incentives', element: <Page component={IncentivesPage} /> },
      { path: 'hrms/locations', element: <Page component={LocationsPage} /> },
      { path: 'hrms/assets', element: <Page component={AssetsPage} /> },
      { path: 'hrms/asset', element: <Page component={AssetsPage} /> },
      { path: 'hrms/asset-setup', element: <Page component={AssetsPage} /> },
      { path: 'hrms/asset-requests', element: <Page component={AssetsPage} /> },
      { path: 'hrms/documents', element: <Page component={DocumentsPage} /> },
      { path: 'hrms/company-policy', element: <Page component={CompanyPolicy} /> },
      { path: 'hrms/company-policy/policies', element: <Page component={() => <CompanyPolicy forcedSection="policies" />} /> },
      { path: 'hrms/company-policy/categories', element: <Page component={() => <CompanyPolicy forcedSection="categories" />} /> },
      { path: 'hrms/company-policy/pending-approval', element: <Page component={() => <CompanyPolicy forcedSection="pending-approval" />} /> },
      { path: 'hrms/company-policy/acknowledgements', element: <Page component={() => <CompanyPolicy forcedSection="acknowledgements" />} /> },
      { path: 'hrms/company-policy/archive', element: <Page component={() => <CompanyPolicy forcedSection="archive" />} /> },

      // ── Company Policy Module Root Routes ─────────────────
      { path: 'company-policy', element: <Page component={CompanyPolicy} /> },
      { path: 'company-policy/policies', element: <Page component={() => <CompanyPolicy forcedSection="policies" />} /> },
      { path: 'company-policy/categories', element: <Page component={() => <CompanyPolicy forcedSection="categories" />} /> },
      { path: 'company-policy/pending-approval', element: <Page component={() => <CompanyPolicy forcedSection="pending-approval" />} /> },
      { path: 'company-policy/acknowledgements', element: <Page component={() => <CompanyPolicy forcedSection="acknowledgements" />} /> },
      { path: 'company-policy/archive', element: <Page component={() => <CompanyPolicy forcedSection="archive" />} /> },
      { path: 'hrms/calendar', element: <Page component={CalendarPage} /> },
      // { path: 'hrms/hrms-setup', element: <Page component={HrmsSetup} /> }, // Hidden: HRMS Setup feature commented out
      { path: 'hrms/hr-admin', element: <Page component={HRAdminPage} /> },
      { path: 'hrms/hr-admin/working-days', element: <Page component={HRAdminPage} defaultTab="working-days" /> },
      { path: 'hrms/hr-admin/terminations', element: <Page component={HRAdminPage} defaultTab="terminations" /> },
      { path: 'hrms/hr-admin/resignations', element: <Page component={HRAdminPage} defaultTab="resignations" /> },
      { path: 'hrms/hr-admin/complaints', element: <Page component={HRAdminPage} defaultTab="complaints" /> },
      { path: 'hrms/hr-admin/holidays', element: <Page component={HRAdminPage} defaultTab="holidays" /> },

      // ── Reports ───────────────────────────────────────────
      { path: 'reports', element: <Page component={ReportsPage} /> },
      { path: 'reports/owner-mis', element: <Page component={OwnerMISDashboardPage} title="Owner Executive MIS" /> },

      // ── Administration ────────────────────────────────────
      { path: 'administration', element: <Navigate to="/administration/settings" replace /> },
      { path: 'administration/approvals', element: <Page component={ApprovalsInboxPage} title="Approvals Inbox" /> },
      { path: 'administration/alerts', element: <Page component={AlertCenterPage} title="Alert Center & Exceptions" /> },
      { path: 'administration/accounting-log', element: <Navigate to="/accounts/accounting-log" replace /> },
      { path: 'administration/users', element: <Page component={UsersPage} /> },
      { path: 'administration/roles', element: <Page component={RolesPage} /> },
      { path: 'administration/clients', element: <Page component={ClientsPage} /> },
      { path: 'administration/client', element: <Navigate to="/administration/clients" replace /> },
      { path: 'administration/settings', element: <Page component={SettingsPage} /> },
      { path: 'admin/approvals', element: <Navigate to="/administration/approvals" replace /> },
      { path: 'admin/alerts', element: <Navigate to="/administration/alerts" replace /> },
      { path: 'approvals', element: <Navigate to="/administration/approvals" replace /> },
      { path: 'alerts', element: <Navigate to="/administration/alerts" replace /> },

      // ── Catch-all ─────────────────────────────────────────
      { path: '*', element: <Navigate to="/dashboard" replace /> },
            ],
          },
    ],
  },
    ],
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
