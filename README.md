# Evenmore Unified ERP

A modern, enterprise-grade unified frontend application consolidating **CRM**, **HRMS**, and **ERP (Sales, Purchase, Inventory, Accounts)** into **ONE single React application**.

---

## 🏛️ Architecture & Technology Stack

- **Framework**: React 19 + Vite 6
- **Routing**: `react-router-dom` v7 with `ErrorBoundary` route isolation
- **Design Baseline**: CRM Design System (Pure Vanilla CSS, Slate tokens, Inter typography, `#1f6bff` primary)
- **State Management**:
  - `ERPContext.jsx` for global ERP sales/purchase/inventory/parties/accounts transactions with demo persistence
  - Zustand stores for HRMS modules (`appStore.js`, `attendanceStore.js`, `recruitmentStore.js`, `hrmsStore.js`)
  - React local component state for localized UI interactions
- **Icons**: `lucide-react`
- **Animations**: `motion`

---

## 📦 Quick Start

### 1. Installation

From the project root:

```bash
npm --prefix app install
```

Or inside `app/`:

```bash
cd app
npm install
```

### 2. Development Server

Run the development server on `http://localhost:5173/`:

```bash
npm run dev
```

Or from inside `app/`:

```bash
cd app
npm run dev
```

### 3. Production Build

Compile the production bundle (Vite + Rollup):

```bash
npm run build
```

---

## 🧩 Business Modules & Features

### 1. CRM Module (`/crm/*`)
- **Leads Directory**: Table, Card Grid, and Map visualization views with search, multi-column sorting, and filtering by stage/score.
- **Lead Detail & Drawer**: Complete lead hero, contact actions, dynamic fields, status updates, and notes timeline.
- **Lead Form Builder & Dynamic Forms**: Visual drag-and-drop form builder with live schema serialization.
- **CRM Tasks**: Task tracking, follow-ups, priority tags, and lead associations.
- **Customers**: Unified customer parties directory.

### 2. ERP Sales Module (`/sales/*`)
- **Document Pipeline**: Quotation → Sales Order → Sales Invoice → Delivery Challan → Payment In → Sales Return.
- **Interactive Invoicing**: Item auto-population, tax/discount calculation, invoice printing, and payment recording.
- **Customer 360**: Financial summaries, outstanding balances, and related document trails.

### 3. ERP Purchase Module (`/purchase/*`)
- **Procurement Pipeline**: Vendor Directory → Purchase Order → Purchase Bill → Payment Out → Purchase Return.
- **Operating Expenses**: Categorized operational expense tracking with cash/bank adjustments.

### 4. ERP Inventory Module (`/inventory/*`)
- **Items Master**: Item catalogs, barcode generation, batch tracking, reorder levels, unit conversions.
- **Stock Management**: Warehouse stock positions, multi-warehouse transfers, location definitions, faulty parts tracking, service usage, zone requests, stock valuation & ageing, and month-end audit reconciliations.

### 5. HRMS Module (`/hrms/*`)
- **Dashboard & Employees**: Complete employee directory with profile detail modals and department filtering.
- **Attendance**: Overview, Daily Check-in/Out marking, regularization requests approval, bulk attendance, and flexibility rules.
- **Leave & Payroll**: Leave request approvals/delegation, payroll salary structure and processing.
- **Recruitment**: Jobs board, candidate pipeline stages, interview scheduling, and offer letters.
- **Performance**: Technical/organizational KPI indicators, appraisal cycles, goal tracking progress bars.
- **Training**: Training programs, internal/external trainer rosters.
- **Organization**: Hierarchical org chart tree, departments, designations, company locations, assets custody, and HR documents.

### 6. Accounts & Administration (`/accounts/*`, `/administration/*`)
- **Cash & Bank / General Ledger**: Transaction journals and account balances.
- **Financial Reports**: Real-time Profit & Loss statement, Balance Sheet summary, and revenue/expense breakdown.
- **Administration**: User management, Role-based access control (RBAC), and system configuration settings.

---

## 🎨 Design System Baseline

All components adhere strictly to the **CRM Visual Baseline**:
- **Primary Color**: `#1f6bff`
- **Heading Color**: `#0f172a`
- **Muted Color**: `#64748b`
- **Background Color**: `#f8fafc`
- **Border Tokens**: `rgba(226, 232, 240, 1)` / Slate
- **Typography**: Inter font family with strict size scales
- **Shared UI Primitives** in `app/src/components/ui/`: `Button`, `DataTable`, `StatCard`, `MetricChip`, `StatusBadge`, `Modal`, `Drawer`, `EmptyState`, `ProgressBar`, `Skeleton`, `PageHeader`, `Pagination`, `ErrorBoundary`.

---

## 🔌 API Service Layer (Backend Ready)

Prepared under `app/src/services/`:
- `api.js`: Base API client with JWT bearer header support and unified error handling.
- `domainServices.js`: Ready-to-connect service endpoints for CRM, Sales, HRMS, and Inventory.
