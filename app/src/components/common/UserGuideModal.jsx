import React, { useState, useMemo } from 'react';
import {
  X,
  BookOpen,
  Search,
  ShoppingCart,
  Truck,
  Package,
  Landmark,
  UserCheck,
  Target,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Layers,
  FileText,
  DollarSign,
  Clock,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

const GUIDE_MODULES = [
  {
    id: 'getting-started',
    title: 'Platform Overview & Quickstart',
    icon: Sparkles,
    badge: 'Core',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    summary: 'A unified enterprise architecture for end-to-end commerce, manufacturing, and supply chain operations.',
    sections: [
      {
        heading: 'System Architecture & Data Flow',
        content: 'Evenmore ERP connects Sales, Procurement, Warehouse Stock, CRM, and Financial General Ledgers in real-time. Any transaction posted in one module immediately synchronizes downstream accounts and stock valuations.'
      },
      {
        heading: 'Global Navigation & Quick Actions',
        content: 'Use the Command Palette (Ctrl+K or Topbar Search) to instantly navigate anywhere or create records. The top bar "+ New" button triggers instant creations for Leads, Orders, Invoices, Bills, and Master Items.'
      },
      {
        heading: 'Multi-Currency & Regional Settings',
        content: 'Configure your company legal entity, base currency (USD, EUR, GBP, INR), and fiscal periods under System Preferences. Changing base currency converts all ledger entries, reports, and pipeline statistics dynamically.'
      }
    ],
    tips: [
      'Toggle color themes (Light, Dark, Midnight, Emerald) via the top-bar theme selector or user profile popup.',
      'Use Ctrl+K anywhere to bring up the universal command palette and fast search.'
    ]
  },
  {
    id: 'crm',
    title: 'CRM & Customer Lifecycle',
    icon: Target,
    badge: 'Front-Office',
    badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    summary: 'Manage prospect pipelines, assign sales reps, track activities, and convert qualified leads into permanent trade parties.',
    sections: [
      {
        heading: 'Lead Ingestion & Stage Progression',
        content: 'Log inbound leads across stages: Discovery, Demo, Proposal, and Won/Lost. Assign specific sales engineers and set estimated deal pipeline values.'
      },
      {
        heading: 'Lead-to-Customer & Party Sync',
        content: 'When a lead status moves to "Won" or "Convert to Customer", the system automatically registers the company as an official Customer and synchronizes the Trade Parties ledger with credit terms and tax IDs.'
      },
      {
        heading: 'Tasks & Activity Reminders',
        content: 'Schedule follow-ups, meetings, and client reviews with priority flags and automated notifications.'
      }
    ],
    tips: [
      'Review the Deals board for Kanban drag-and-drop pipeline management.',
      'All customer contact numbers and email threads sync to Quotations and Invoices automatically.'
    ]
  },
  {
    id: 'sales',
    title: 'Sales & Revenue Operations',
    icon: ShoppingCart,
    badge: 'Revenue',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    summary: 'Full order-to-cash workflow: Quotations, Sales Orders, Delivery Challans, Tax Invoices, and Payment Receipts.',
    sections: [
      {
        heading: 'Quotation to Sales Order',
        content: 'Draft quotations with custom price lists, machine BOM configurations, and customer credit limit checks. When accepted, convert to a Sales Order in 1 click.'
      },
      {
        heading: 'Stock Availability & Auto-PO Shortage Trigger',
        content: 'If an ordered item is out of stock, the system alerts you and offers an "Auto-PO" trigger to immediately issue a supplier replenishment order.'
      },
      {
        heading: 'Delivery Challans & Invoicing',
        content: 'Generate shipment Delivery Challans for dock dispatch. Convert confirmed orders into GST-compliant Tax Invoices to accrue Accounts Receivable.'
      },
      {
        heading: 'Payment In (Receipts)',
        content: 'Record client bank settlements. Automatically clears invoice balance due and updates cash/bank ledger balances.'
      }
    ],
    tips: [
      'Credit limit warnings appear automatically if customer outstanding exceeds credit limits.',
      'Machine line items automatically display and manage nested assembly parts.'
    ]
  },
  {
    id: 'purchase',
    title: 'Procurement & Vendor Intake',
    icon: Truck,
    badge: 'Procurement',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    summary: 'Supplier purchase orders, warehouse intake, 3-way matching, and Accounts Payable disbursement.',
    sections: [
      {
        heading: 'Drafting & Issuing Purchase Orders',
        content: 'Generate supplier purchase orders manually or through automated deficit triggers. PO dates are formatted universally in DD-MM-YYYY format.'
      },
      {
        heading: 'Goods Intake & Vendor Bills',
        content: 'When supplier goods arrive at the loading dock, convert the PO into a Purchase Bill. This automatically increases on-hand inventory and posts to Accounts Payable.'
      },
      {
        heading: 'Payment Out & Purchase Returns',
        content: 'Record vendor disbursements from operating bank accounts. Return damaged or non-compliant parts with automatic debit notes.'
      }
    ],
    tips: [
      'Draft Purchase Orders can be edited or deleted before vendor dispatch.',
      'Use the Clone action to reorder frequent standard supplier shipments.'
    ]
  },
  {
    id: 'inventory',
    title: 'Inventory, Machines & BOM',
    icon: Package,
    badge: 'Supply Chain',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    summary: 'Machine assemblies, sub-component Bill of Materials (BOM), warehouse bin tracking, transfers, and valuation audits.',
    sections: [
      {
        heading: 'Machines vs Stock Components',
        content: 'Machines represent complete assemblies with linked BOM component parts. Stock components represent individual hardware SKUs and raw materials.'
      },
      {
        heading: 'Automated BOM Hierarchy',
        content: 'When selecting a machine in quotations, orders, or transfers, you can expand nested parts, customize quantities, or cascade deletions together.'
      },
      {
        heading: 'Warehouse Transfers & Faulty RMA',
        content: 'Move goods between storage zones (Main Hub, North Bay, RMA Quarantine). Track defective units through QA repair cycles.'
      }
    ],
    tips: [
      'Set reorder thresholds on high-turnover SKUs to prevent stockouts.',
      'Run Month-End Audits to reconcile physical cycle counts against book inventory.'
    ]
  },
  {
    id: 'accounts',
    title: 'Accounts, Taxes & Financial Ledgers',
    icon: Landmark,
    badge: 'Finance',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    summary: 'Double-entry general ledger, Cash/Bank reconciliation, AR/AP aging schedules, and Multi-Currency reporting.',
    sections: [
      {
        heading: 'Automated Journal Entries',
        content: 'Every invoice, bill, receipt, and payment automatically generates dual-sided journal entries (Debits = Credits) in the General Ledger.'
      },
      {
        heading: 'Financial Statements & Reports',
        content: 'Analyze real-time Balance Sheets, Profit & Loss Statements, Cash Flow, and AR/AP Aging analyses.'
      },
      {
        heading: 'Currency Conversion',
        content: 'All accounting records and stat cards dynamically convert to your preferred currency (USD, EUR, GBP, INR) based on system exchange rates.'
      }
    ],
    tips: [
      'Export detailed ledgers and reports to CSV for external audits.',
      'Cash & Bank accounts maintain live balances updated by incoming receipts and outgoing payouts.'
    ]
  },
  {
    id: 'hrms',
    title: 'HRMS, Attendance & Payroll',
    icon: UserCheck,
    badge: 'Workforce',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    summary: 'Employee records, biometric attendance logging, leave approvals, recruitment pipelines, and payroll processing.',
    sections: [
      {
        heading: 'Attendance & Shift Flexibility',
        content: 'Log daily check-ins, bulk attendance entries, and flexible work-from-home requests with department approvals.'
      },
      {
        heading: 'Leave Management & Payroll',
        content: 'Track paid time off, sick leave balances, and auto-calculate monthly payroll summaries with tax deductions.'
      },
      {
        heading: 'Recruitment & Job Openings',
        content: 'Post internal and external job listings, manage applicant pipelines, schedule candidate interviews, and issue offer letters.'
      }
    ],
    tips: [
      'Employees can check their attendance logs and leave balances directly from their HR profile view.',
      'Operations admins can manage role permissions and access tokens under Administration.'
    ]
  }
];

export const UserGuideModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeModuleId, setActiveModuleId] = useState('getting-started');

  const filteredModules = useMemo(() => {
    if (!searchTerm.trim()) return GUIDE_MODULES;
    const term = searchTerm.toLowerCase();
    return GUIDE_MODULES.filter(
      (m) =>
        String(m.title ?? '').toLowerCase().includes(term) ||
        String(m.summary ?? '').toLowerCase().includes(term) ||
        m.sections.some(
          (s) =>
            String(s.heading ?? '').toLowerCase().includes(term) ||
            String(s.content ?? '').toLowerCase().includes(term)
        ) ||
        m.tips.some((t) => t.toLowerCase().includes(term))
    );
  }, [searchTerm]);

  const activeModule = useMemo(() => {
    return (
      filteredModules.find((m) => m.id === activeModuleId) ||
      filteredModules[0] ||
      GUIDE_MODULES[0]
    );
  }, [filteredModules, activeModuleId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-200 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Interactive ERP User Guides"
    >
      <div
        className="bg-card border border-border text-text rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col overflow-hidden max-h-[90vh] my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-2 lg:gap-0 px-4 sm:px-6 py-4 border-b border-border bg-soft/50">
          <div className="flex items-center gap-3 min-w-0 lg:min-w-auto">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-text leading-tight">
                  Evenmore ERP Knowledge Base & User Guides
                </h2>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  v2.6 Enterprise
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Standard operating procedures, module workflows, and guidelines for every department.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-text hover:bg-soft transition cursor-pointer"
            aria-label="Close user guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Navigation Bar */}
        <div className="p-4 border-b border-border bg-card">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search guide topics, workflows (e.g., 'convert lead', 'PO to bill', 'BOM parts', 'currency')..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-soft text-text placeholder:text-muted text-xs focus:outline-none focus:border-primary focus:bg-card transition"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text text-xs p-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Body Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[420px]">
          {/* Module Navigation Sidebar */}
          <div className="w-full md:w-64 border-r border-border bg-soft/30 overflow-y-auto p-2 space-y-1 shrink-0 max-h-48 md:max-h-none">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
              System Modules ({filteredModules.length})
            </div>
            {filteredModules.map((m) => {
              const Icon = m.icon;
              const isActive = activeModule.id === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveModuleId(m.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition text-left cursor-pointer ${
                    isActive
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-text hover:bg-soft text-muted hover:text-text'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon size={16} className={isActive ? 'text-white' : 'text-muted'} />
                    <span className="truncate">{m.title}</span>
                  </div>
                  <ChevronRight
                    size={13}
                    className={`shrink-0 ${isActive ? 'text-white' : 'text-muted opacity-50'}`}
                  />
                </button>
              );
            })}
            {filteredModules.length === 0 && (
              <div className="p-4 text-center text-xs text-muted">
                No matching guide topics found.
              </div>
            )}
          </div>

          {/* Module Content Detail */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-card">
            {activeModule && (
              <>
                {/* Module Title Banner */}
                <div className="border-b border-border pb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${activeModule.badgeColor}`}
                    >
                      {activeModule.badge}
                    </span>
                    <h3 className="text-lg font-bold text-text">
                      {activeModule.title}
                    </h3>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    {activeModule.summary}
                  </p>
                </div>

                {/* Section Explanations */}
                <div className="space-y-4">
                  {activeModule.sections.map((sec, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-border bg-soft/40 hover:bg-soft/70 transition"
                    >
                      <h4 className="text-xs font-bold text-text flex items-center gap-2 mb-1.5">
                        <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {idx + 1}
                        </span>
                        {sec.heading}
                      </h4>
                      <p className="text-xs text-muted leading-relaxed pl-7">
                        {sec.content}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Pro Tips & Best Practices */}
                {activeModule.tips && activeModule.tips.length > 0 && (
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <Sparkles size={14} />
                      <span>Best Practices & Pro Tips</span>
                    </div>
                    <ul className="space-y-1.5 pl-5 list-disc text-xs text-muted">
                      {activeModule.tips.map((tip, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-border bg-soft/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <HelpCircle size={14} className="text-primary" />
            <span>Need dedicated operational assistance? Contact our 24/7 help desk.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            Got It, Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserGuideModal;
