import { api } from './api';

const BASE = '/pms/loom';

export const loomService = {
  // Dashboard & Demo
  getDashboardOverview: () => api.get(`${BASE}/dashboard-overview/`),
  resetDemoData: () => api.post(`${BASE}/demo-data/`, { action: 'reset' }),

  // Factories & Coordinators
  getCoordinators: () => api.get(`${BASE}/coordinators/`),
  createCoordinator: (data) => api.post(`${BASE}/coordinators/`, data),
  getFactories: () => api.get(`${BASE}/factories/`),
  createFactory: (data) => api.post(`${BASE}/factories/`, data),
  getFactoryStatus: (id) => api.get(`${BASE}/factories/${id}/status/`),
  getFactoryYarnStock: (id) => api.get(`${BASE}/factories/${id}/yarn_stock/`),

  // Machines
  getMachines: (params) => api.get(`${BASE}/machines/`, { params }),
  batchCreateMachines: (data) => api.post(`${BASE}/machines/batch_create/`, data),
  updateMachine: (id, data) => api.patch(`${BASE}/machines/${id}/`, data),
  deleteMachine: (id) => api.delete(`${BASE}/machines/${id}/`),

  // Yarns
  getYarns: () => api.get(`${BASE}/yarns/`),
  createYarn: (data) => api.post(`${BASE}/yarns/`, data),
  updateYarn: (id, data) => api.patch(`${BASE}/yarns/${id}/`, data),
  deleteYarn: (id) => api.delete(`${BASE}/yarns/${id}/`),

  // Qualities
  getQualities: () => api.get(`${BASE}/qualities/`),
  createQuality: (data) => api.post(`${BASE}/qualities/`, data),
  deleteQuality: (id) => api.delete(`${BASE}/qualities/${id}/`),

  // Beams
  getBeams: (params) => api.get(`${BASE}/beams/`, { params }),
  createBeam: (data) => api.post(`${BASE}/beams/`, data),
  loadBeamToLoom: (id, machineId) => api.post(`${BASE}/beams/${id}/load_to_loom/`, { machine_id: machineId }),
  assignSpareBeam: (id, machineId) => api.post(`${BASE}/beams/${id}/assign_spare/`, { machine_id: machineId }),
  cutoffBeam: (id) => api.post(`${BASE}/beams/${id}/cutoff/`),
  deleteBeam: (id) => api.delete(`${BASE}/beams/${id}/`),

  // Daily Production
  getFactoryDayProduction: (factoryId, dateStr) => api.get(`${BASE}/daily-production/factory_day/`, { params: { factory: factoryId, date: dateStr } }),
  bulkSaveDailyProduction: (data) => api.post(`${BASE}/daily-production/bulk_save/`, data),
  deleteDailyProduction: (id) => api.delete(`${BASE}/daily-production/${id}/`),

  // Yarn Bookings & Deliveries
  getYarnBookings: () => api.get(`${BASE}/yarn-bookings/`),
  createYarnBooking: (data) => api.post(`${BASE}/yarn-bookings/`, data),
  deleteYarnBooking: (id) => api.delete(`${BASE}/yarn-bookings/${id}/`),
  createYarnDelivery: (data) => api.post(`${BASE}/yarn-deliveries/`, data),
  confirmYarnDelivery: (id, recdKgs, recdDate) => api.post(`${BASE}/yarn-deliveries/${id}/confirm_receipt/`, { recd_kgs: recdKgs, recd_date: recdDate }),
  deleteYarnDelivery: (id) => api.delete(`${BASE}/yarn-deliveries/${id}/`),

  // Programs
  getPrograms: () => api.get(`${BASE}/programs/`),
  createProgram: (data) => api.post(`${BASE}/programs/`, data),
  updateProgramStatus: (id, status) => api.patch(`${BASE}/programs/${id}/`, { status }),
  getProgramStats: (id) => api.get(`${BASE}/programs/${id}/stats/`),
  deleteProgram: (id) => api.delete(`${BASE}/programs/${id}/`),

  // Fabric Dispatches (Fabric Out)
  getFabricDispatches: (params) => api.get(`${BASE}/fabric-dispatches/`, { params }),
  createFabricDispatch: (data) => api.post(`${BASE}/fabric-dispatches/`, data),
  getFabricInventorySummary: (factoryId) => api.get(`${BASE}/fabric-dispatches/inventory_summary/`, { params: { factory: factoryId } }),
  deleteFabricDispatch: (id) => api.delete(`${BASE}/fabric-dispatches/${id}/`),
};
