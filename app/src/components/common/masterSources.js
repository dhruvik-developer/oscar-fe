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
  items: { to: '/inventory/grey', menu: 'Inventory → Grey Inventory' },
  greyInventory: { to: '/inventory/grey', menu: 'Inventory → Grey Inventory' },
  dyeingInventory: { to: '/inventory/dyeing', menu: 'Inventory → Dyeing Inventory' },
  machines: { to: '/inventory/items/machines', menu: 'Inventory → Inventory → Machines' },
  // Fabric Masters (one page, deep-linked by ?tab=)
  fabricVariants: { to: '/inventory/fabric-masters?tab=variants', menu: 'Inventory → Fabric Masters → Item / Variant' },
  fabricQualities: { to: '/inventory/fabric-masters?tab=quality', menu: 'Inventory → Fabric Masters → Fabric Quality' },
  designs: { to: '/inventory/fabric-masters?tab=design', menu: 'Inventory → Fabric Masters → Design' },
  shades: { to: '/inventory/fabric-masters?tab=colour', menu: 'Inventory → Fabric Masters → Colour / Shade' },
  categories: { to: '/inventory/fabric-masters?tab=categories', menu: 'Inventory → Fabric Masters → Categories' },
  machineCategories: { to: '/inventory/categories/machines', menu: 'Inventory → Categories (Machines)' },
  fabricTypes: { to: '/inventory/fabric-masters?tab=fabric-type', menu: 'Inventory → Fabric Masters → Fabric Type' },
  uom: { to: '/inventory/fabric-masters?tab=uom', menu: 'Inventory → Fabric Masters → UOM' },
  godowns: { to: '/inventory/warehouses?tab=warehouses', menu: 'Inventory → Warehouses' },

  // Textile Operations Masters (one page, deep-linked by ?tab=)
  processes: { to: '/inventory/masters/textile?tab=processes', menu: 'Inventory → Textile Operations Masters → Process Master' },
  jobworkRates: { to: '/inventory/masters/textile?tab=jobwork-rates', menu: 'Inventory → Textile Operations Masters → Job-Work Rates' },
  defects: { to: '/inventory/masters/textile?tab=defects', menu: 'Inventory → Textile Operations Masters → Defect Master' },
  lossReasons: { to: '/inventory/masters/textile?tab=loss-reasons', menu: 'Inventory → Textile Operations Masters → Loss Reasons' },
  returnReasons: { to: '/inventory/masters/textile?tab=return-reasons', menu: 'Inventory → Textile Operations Masters → Return Reasons' },

  // Parties & Logistics (re-routed from old master tabs to their actual operational homes)
  agencies: { to: '/parties', menu: 'Parties Directory' },
  processors: { to: '/parties', menu: 'Parties Directory' },
  brokers: { to: '/parties', menu: 'Parties Directory' },
  vehicles: { to: '/inventory/trips', menu: 'Inventory → Logistics & Tempo Register' },
  drivers: { to: '/inventory/trips', menu: 'Inventory → Logistics & Tempo Register' },
  transporters: { to: '/inventory/trips', menu: 'Inventory → Logistics & Tempo Register' },
  rateMasters: { to: '/inventory/fabric-masters', menu: 'Inventory → Fabric Masters' },

  // CRM
  leadTasks: { to: '/crm/leads/tasks-master', menu: 'CRM → Leads → Lead Tasks Master' },
  leadStageTasks: { to: '/crm/leads/stage-tasks', menu: 'CRM → Leads → Lead Stage Tasks' },
  leadForms: { to: '/crm/leads/forms', menu: 'CRM → Leads → Lead Create Form' },
  leadStages: { to: '/crm/system-setup', menu: 'CRM → CRM Setup → Lead Stages' },
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
  incentiveSchemes: { to: '/hrms/incentives', menu: 'HRMS → Incentives' },
  salespeople: { to: '/hrms/employees', menu: 'HRMS → Employees' },

  // Administration
  users: { to: '/administration/users', menu: 'Administration → Users' },
  roles: { to: '/administration/roles', menu: 'Administration → Roles' },
  clients: { to: '/administration/clients', menu: 'Administration → Clients' },
  companySettings: { to: '/administration/settings', menu: 'Settings' },
};
