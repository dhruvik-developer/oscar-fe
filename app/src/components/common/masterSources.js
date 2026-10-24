/**
 * Where each dropdown's data is mastered. `menu` is the sidebar path, shown
 * in the popup header so users learn where to maintain the data themselves.
 */
export const MASTER_SOURCES = {
  // Parties
  parties: { to: '/parties', menu: 'Parties' },
  customers: { to: '/parties?type=customer', menu: 'Parties → Customer' },
  vendors: { to: '/parties?type=vendor', menu: 'Parties → Vendor' },

  // Inventory masters
  items: { to: '/inventory/items', menu: 'Inventory → Total Inventory' },
  machines: { to: '/inventory/items/machines', menu: 'Inventory → Total Inventory → Machines' },
  fabricVariants: { to: '/inventory/fabric/variants', menu: 'Inventory → Fabric Item / Variant Master' },
  fabricQualities: { to: '/inventory/fabric/quality', menu: 'Inventory → Fabric Quality Master' },
  designs: { to: '/inventory/fabric/design', menu: 'Inventory → Design Master' },
  shades: { to: '/inventory/fabric/colour', menu: 'Inventory → Colour / Shade Master' },
  categories: { to: '/inventory/categories', menu: 'Inventory → Categories → Fabric Categories' },
  machineCategories: { to: '/inventory/categories/machines', menu: 'Inventory → Categories (Machines)' },
  fabricTypes: { to: '/inventory/categories/fabric-type', menu: 'Inventory → Categories → Fabric Type / Classification' },
  uom: { to: '/inventory/categories/uom', menu: 'Inventory → Categories → Units of Measurement (UOM)' },
  godowns: { to: '/inventory/locations', menu: 'Inventory → Godown / Rack' },

  // Textile Operations Masters (one page, deep-linked by ?tab=)
  agencies: { to: '/inventory/masters/textile?tab=agencies', menu: 'Inventory → Textile Operations Masters → Agencies' },
  processors: { to: '/inventory/masters/textile?tab=processors', menu: 'Inventory → Textile Operations Masters → Processors' },
  brokers: { to: '/inventory/masters/textile?tab=brokers', menu: 'Inventory → Textile Operations Masters → Brokers' },
  processes: { to: '/inventory/masters/textile?tab=processes', menu: 'Inventory → Textile Operations Masters → Process Master' },
  jobworkRates: { to: '/inventory/masters/textile?tab=jobwork-rates', menu: 'Inventory → Textile Operations Masters → Job-Work Rates' },
  defects: { to: '/inventory/masters/textile?tab=defects', menu: 'Inventory → Textile Operations Masters → Defect Master' },
  lossReasons: { to: '/inventory/masters/textile?tab=loss-reasons', menu: 'Inventory → Textile Operations Masters → Loss Reasons' },
  returnReasons: { to: '/inventory/masters/textile?tab=return-reasons', menu: 'Inventory → Textile Operations Masters → Return Reasons' },
  vehicles: { to: '/inventory/masters/textile?tab=vehicles', menu: 'Inventory → Textile Operations Masters → Vehicles' },
  drivers: { to: '/inventory/masters/textile?tab=drivers', menu: 'Inventory → Textile Operations Masters → Drivers' },
  rateMasters: { to: '/inventory/masters/textile?tab=rate-masters', menu: 'Inventory → Textile Operations Masters → Rate Master' },
  transporters: { to: '/inventory/masters/textile?tab=transporters', menu: 'Inventory → Textile Operations Masters → Transporters' },

  // CRM
  leadTasks: { to: '/crm/leads/tasks-master', menu: 'CRM → Leads → Lead Tasks Master' },
  leadStageTasks: { to: '/crm/leads/stage-tasks', menu: 'CRM → Leads → Lead Stage Tasks' },
  leadForms: { to: '/crm/leads/forms', menu: 'CRM → Leads → Lead Create Form' },
  leadStages: { to: '/crm/system-setup', menu: 'CRM → CRM Setup → Lead Stages' },
  dealStages: { to: '/crm/deal-stages', menu: 'CRM → CRM Setup → Deal Stages' },
  leadSources: { to: '/crm/lead-sources', menu: 'CRM → CRM Setup → Lead Sources' },

  // PMS
  pmsSettings: { to: '/pms/settings', menu: 'PMS → Settings' },
  processPlans: { to: '/job-work/process-plan', menu: 'PMS → Job Work / Processing → Process Plan' },

  // Accounts
  cashBank: { to: '/accounts/cash-bank', menu: 'Accounts → Cash / Bank' },
  ledgerAccounts: { to: '/accounts/chart-of-accounts', menu: 'Accounts → Chart of Accounts' },
  expenseCategories: { to: '/accounts/expense-categories', menu: 'Accounts → Expense Categories' },

  // HRMS
  employees: { to: '/hrms/employees', menu: 'HRMS → Employees' },
  departments: { to: '/hrms/departments', menu: 'HRMS → Organization → Departments' },
  designations: { to: '/hrms/designations', menu: 'HRMS → Organization → Designations' },
  hrmsLocations: { to: '/hrms/locations', menu: 'HRMS → Organization → Locations' },
  holidays: { to: '/hrms/hr-admin/holidays', menu: 'HRMS → HR Admin → Holidays' },
  policyCategories: { to: '/hrms/company-policy/categories', menu: 'HRMS → Company Policy → Categories' },
  assets: { to: '/hrms/assets', menu: 'HRMS → Asset Setup' },
  kpiIndicators: { to: '/hrms/performance/indicators', menu: 'HRMS → Performance → Indicators' },

  // Administration
  users: { to: '/administration/users', menu: 'Administration → Users' },
  roles: { to: '/administration/roles', menu: 'Administration → Roles' },
  clients: { to: '/administration/clients', menu: 'Administration → Clients' },
  companySettings: { to: '/administration/settings', menu: 'Settings' },
};
