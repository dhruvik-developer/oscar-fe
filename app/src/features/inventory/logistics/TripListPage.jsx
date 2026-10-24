import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  Plus,
  Search,
  Filter,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  FileText,
  MapPin,
  X,
  Layers,
  ArrowUpRight,
  TrendingUp,
  UploadCloud,
  ExternalLink,
} from 'lucide-react';
import { uploadFileToBackend } from '../../../services/fileUploadService';
import { inventoryService } from '../../../services/domainServices';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import { PrintLorryReceiptModal } from '../../../components/common/PrintLorryReceiptModal';
import MasterSourceLink, { useMasterDataRefresh } from '../../../components/common/MasterSourceLink';

export default function TripListPage() {
  const [trips, setTrips] = useState([]);
  const [printTripId, setPrintTripId] = useState(null);
  const [listError, setListError] = useState(null);
  const [transporters, setTransporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  // Create Transporter Modal
  const [showTransporterModal, setShowTransporterModal] = useState(false);
  const [transporterSubmitting, setTransporterSubmitting] = useState(false);
  const [newTransporter, setNewTransporter] = useState({
    name: '',
    code: '',
    contactPerson: '',
    phone: '',
    gstin: '',
    address: '',
  });

  // Confirm Delivery Modal
  const [deliveryModalTrip, setDeliveryModalTrip] = useState(null);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryRemarks, setDeliveryRemarks] = useState('');
  const [proofFile, setProofFile] = useState(null);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deliveryError, setDeliveryError] = useState(null);

  // Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTrip, setActiveTrip] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Form
  const [tripForm, setTripForm] = useState({
    tripType: 'OUTWARD',
    tripDate: new Date().toISOString().slice(0, 10),
    transporterId: '',
    vehicleId: '',
    driverId: '',
    vehicleNumber: '',
    driverName: '',
    driverMobile: '',
    lrNumber: '',
    lrDate: '',
    fromLocation: '',
    toLocation: '',
    freightAmount: '0',
    loadingCharges: '0',
    unloadingCharges: '0',
    otherCharges: '0',
    paidBy: 'Company',
    costAllocationTarget: 'LOT',
    remarks: '',
    materials: [],
  });

  // Material line form in modal
  const [materialDraft, setMaterialDraft] = useState({
    lotNumber: '',
    takaNumber: '',
    meters: '',
    weightKg: '',
  });

  const fetchTrips = useCallback(async () => {
    try {
      setLoading(true);
      const [tripsRes, transpRes, vehRes, drivRes] = await Promise.all([
        inventoryService.getTrips({ status: statusFilter || undefined }),
        inventoryService.getTransporters(),
        inventoryService.getVehicles().catch(() => []),
        inventoryService.getDrivers().catch(() => []),
      ]);
      const data = tripsRes?.data || tripsRes?.results || tripsRes || [];
      const transpData = transpRes?.data || transpRes?.results || transpRes || [];
      const vehData = vehRes?.data || vehRes?.results || vehRes || [];
      const drivData = drivRes?.data || drivRes?.results || drivRes || [];
      // API returns camelCase (tripNumber); the table reads snake_case (trip_number).
      const withSnakeKeys = (t) => ({
        ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`), v])),
        ...t,
      });
      setTrips(Array.isArray(data) ? data.map(withSnakeKeys) : []);
      setTransporters(Array.isArray(transpData) ? transpData : []);
      setVehicles(Array.isArray(vehData) ? vehData : []);
      setDrivers(Array.isArray(drivData) ? drivData : []);
    } catch (err) {
      console.error('Failed to load trips:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // Vehicles / drivers added in the "+ Add / Manage" popup show up without reopening the form.
  useMasterDataRefresh(fetchTrips, ['vehicles', 'drivers', 'transporters']);

  const handleVehicleSelect = (vehicleId) => {
    if (!vehicleId) {
      setTripForm((prev) => ({ ...prev, vehicleId: '' }));
      return;
    }
    const selected = vehicles.find((v) => String(v.id) === String(vehicleId));
    if (selected) {
      setTripForm((prev) => ({
        ...prev,
        vehicleId: selected.id,
        vehicleNumber: selected.vehicleNumber || selected.vehicle_number || prev.vehicleNumber,
        transporterId: selected.transporterId || selected.transporter || prev.transporterId,
      }));
    }
  };

  const handleDriverSelect = (driverId) => {
    if (!driverId) {
      setTripForm((prev) => ({ ...prev, driverId: '' }));
      return;
    }
    const selected = drivers.find((d) => String(d.id) === String(driverId));
    if (selected) {
      setTripForm((prev) => ({
        ...prev,
        driverId: selected.id,
        driverName: selected.name || prev.driverName,
        driverMobile: selected.mobile || selected.phone || prev.driverMobile,
        transporterId: prev.transporterId || selected.transporterId || selected.transporter || '',
      }));
    }
  };

  const handleCreateTransporterSubmit = async (e) => {
    e.preventDefault();
    if (!newTransporter.name.trim()) return;
    try {
      setTransporterSubmitting(true);
      const res = await inventoryService.createTransporter(newTransporter);
      const created = res?.data || res;
      if (created?.id) {
        setTransporters((prev) => [...prev, created]);
        setTripForm((prev) => ({ ...prev, transporterId: created.id }));
      }
      setShowTransporterModal(false);
      setNewTransporter({ name: '', code: '', contactPerson: '', phone: '', gstin: '', address: '' });
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to create transporter.');
    } finally {
      setTransporterSubmitting(false);
    }
  };

  const handleOpenConfirmDelivery = (trip) => {
    setDeliveryModalTrip(trip);
    setDeliveryTime(new Date().toISOString().slice(0, 16));
    setDeliveryRemarks('');
    setProofFile(null);
    setDeliveryError(null);
  };

  const handleConfirmDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!deliveryModalTrip) return;
    try {
      setConfirmingDelivery(true);
      setDeliveryError(null);
      let proofFileId = null;
      if (proofFile) {
        proofFileId = await uploadFileToBackend(proofFile, proofFile.name, 'trip_delivery_proof');
      }
      await inventoryService.confirmTripDelivery(deliveryModalTrip.id, {
        delivery_time: deliveryTime,
        remarks: deliveryRemarks,
        proof_file: proofFileId,
      });
      setDeliveryModalTrip(null);
      fetchTrips();
    } catch (err) {
      setDeliveryError(err?.response?.data?.message || err?.message || 'Failed to confirm delivery.');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleAddMaterial = () => {
    if (!materialDraft.lotNumber || !materialDraft.meters) return;
    setTripForm({
      ...tripForm,
      materials: [...tripForm.materials, { ...materialDraft }],
    });
    setMaterialDraft({ lotNumber: '', takaNumber: '', meters: '', weightKg: '' });
  };

  const handleRemoveMaterial = (index) => {
    setTripForm({
      ...tripForm,
      materials: tripForm.materials.filter((_, i) => i !== index),
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      // A lot typed into the draft row but not "Add"-ed would otherwise be silently dropped.
      const pendingLine = materialDraft.lotNumber && materialDraft.meters ? [{ ...materialDraft }] : [];
      await inventoryService.createTrip({
        ...tripForm,
        lrDate: tripForm.lrDate || null,
        materials: [...tripForm.materials, ...pendingLine],
      });
      setMaterialDraft({ lotNumber: '', takaNumber: '', meters: '', weightKg: '' });
      setShowCreateModal(false);
      setTripForm({
        tripType: 'OUTWARD',
        tripDate: new Date().toISOString().slice(0, 10),
        transporterId: '',
        vehicleId: '',
        driverId: '',
        vehicleNumber: '',
        driverName: '',
        driverMobile: '',
        lrNumber: '',
        lrDate: '',
        fromLocation: '',
        toLocation: '',
        freightAmount: '0',
        loadingCharges: '0',
        unloadingCharges: '0',
        otherCharges: '0',
        paidBy: 'Company',
        costAllocationTarget: 'LOT',
        remarks: '',
        materials: [],
      });
      fetchTrips();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to record trip.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAllocateFreight = async (tripId) => {
    try {
      setListError(null);
      await inventoryService.allocateTripFreight(tripId);
      fetchTrips();
    } catch (err) {
      setListError(err?.response?.data?.message || err?.message || 'Freight allocation failed.');
    }
  };

  const filteredTrips = trips.filter((t) => {
    const q = search.toLowerCase();
    return (
      (t.trip_number || '').toLowerCase().includes(q) ||
      (t.vehicle_number || '').toLowerCase().includes(q) ||
      (t.transporter_name || '').toLowerCase().includes(q) ||
      (t.driver_name || '').toLowerCase().includes(q) ||
      (t.lr_number || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Truck className="w-7 h-7 text-indigo-600" />
              Logistics & Tempo Register
            </h1>
            <PageInfoButton title="Logistics & Trip Register" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track inward/outward vehicle trips, LR details, freight charges, and direct landed-cost allocation to lots.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Record New Trip
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search trip, vehicle, driver, LR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="Planned">Planned</option>
            <option value="In Transit">In Transit</option>
            <option value="Delivered">Delivered</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {listError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{listError}</span>
          <button onClick={() => setListError(null)} className="text-rose-400 hover:text-rose-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Trips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Trip No / Date</th>
                <th className="py-3 px-4">Vehicle & Driver</th>
                <th className="py-3 px-4">Route</th>
                <th className="py-3 px-4">LR / Transporter</th>
                <th className="py-3 px-4 text-right">Total Charges</th>
                <th className="py-3 px-4">Cost Allocation</th>
                <th className="py-3 px-4">Delivery Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400">Loading trips...</td>
                </tr>
              ) : filteredTrips.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-slate-400">No transport trips recorded.</td>
                </tr>
              ) : (
                filteredTrips.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {t.trip_number}
                      <div className="text-xs text-slate-400 font-normal">{t.trip_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-indigo-500" />
                        {t.vehicle_number}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {t.driver_name ? `${t.driver_name} (${t.driver_mobile || 'No Mob'})` : 'Driver not assigned'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-700">{t.from_location || 'Mill / Godown'} → {t.to_location || 'Destination'}</div>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                        {t.trip_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-800">{t.transporter_name || t.transporter?.name || 'Local Tempo'}</div>
                      <div className="text-slate-500">LR: {t.lr_number || 'Direct'}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="font-semibold text-slate-900">₹{(Number(t.total_charges) || 0).toLocaleString()}</div>
                      <div className="text-xs text-slate-400">Paid by: {t.paid_by}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {t.freight_allocated || t.freightAllocated || t.is_cost_allocated ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Allocated ({t.cost_allocation_target || t.costAllocationTarget || 'LOT'})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                          Pending Allocation
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {t.status === 'Delivered' || t.status === 'Completed' ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Delivered
                          </span>
                          {(t.delivery_time || t.deliveryTime) && (
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {new Date(t.delivery_time || t.deliveryTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </div>
                          )}
                          {(t.proof_file_url || t.proofFileUrl || t.proof_file) && (
                            <a
                              href={t.proof_file_url || t.proofFileUrl || `/api/v1/files/${t.proof_file}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium underline mt-0.5"
                            >
                              <FileText className="w-3 h-3" /> Proof File
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          <Truck className="w-3 h-3 text-slate-500" /> {t.status || 'In Transit'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => setPrintTripId(t.id)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded border border-slate-200 transition-colors inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> Print LR
                      </button>
                      {t.status !== 'Delivered' && t.status !== 'Completed' && (
                        <button
                          onClick={() => handleOpenConfirmDelivery(t)}
                          className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors inline-flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" /> Confirm Delivery
                        </button>
                      )}
                      {!t.freight_allocated && !t.is_cost_allocated && (() => {
                        // Spreading cost to LOT / SALES_ORDER needs material lines; mirror the backend rule.
                        const needsLines = (t.cost_allocation_target || 'LOT') !== 'EXPENSE'
                          && Number(t.total_charges) > 0
                          && !(t.materials || []).length;
                        return (
                          <button
                            onClick={() => handleAllocateFreight(t.id)}
                            disabled={needsLines}
                            title={needsLines ? 'No material (lot/taka) lines on this trip, so there is nothing to allocate the cost to.' : undefined}
                            className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
                          >
                            Allocate Cost
                          </button>
                        );
                      })()}
                      {!t.freight_allocated && !t.is_cost_allocated && (t.cost_allocation_target || 'LOT') !== 'EXPENSE'
                        && Number(t.total_charges) > 0 && !(t.materials || []).length && (
                        <div className="text-[10px] text-amber-600 mt-1 whitespace-normal">No lot lines — cost can't be allocated</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl my-8 overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Record Logistics & Tempo Trip
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trip Date *</label>
                  <input
                    type="date"
                    required
                    value={tripForm.tripDate}
                    onChange={(e) => setTripForm({ ...tripForm, tripDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Trip Type</label>
                  <select
                    value={tripForm.tripType}
                    onChange={(e) => setTripForm({ ...tripForm, tripType: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="OUTWARD">Outward Dispatch</option>
                    <option value="INWARD">Inward Purchase / JWO</option>
                    <option value="TRANSFER">Internal Transfer</option>
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Transporter</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowTransporterModal(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                      >
                        + New
                      </button>
                      <MasterSourceLink source="transporters" />
                    </div>
                  </div>
                  <select
                    value={tripForm.transporterId}
                    onChange={(e) => setTripForm({ ...tripForm, transporterId: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="">Direct / Self Tempo</option>
                    {transporters.map((tr) => (
                      <option key={tr.id} value={tr.id}>{tr.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Select Registered Vehicle</label>
                    <MasterSourceLink source="vehicles" />
                  </div>
                  <select
                    value={tripForm.vehicleId || ''}
                    onChange={(e) => handleVehicleSelect(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="">-- Choose registered vehicle or type manual --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleNumber || v.vehicle_number} ({v.vehicleType || v.vehicle_type || 'Truck'}{v.transporterName ? ` - ${v.transporterName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700">Select Registered Driver</label>
                    <MasterSourceLink source="drivers" />
                  </div>
                  <select
                    value={tripForm.driverId || ''}
                    onChange={(e) => handleDriverSelect(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="">-- Choose registered driver or type manual --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.mobile || 'No Mobile'}{d.transporterName ? ` - ${d.transporterName}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Vehicle Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GJ05AB1234"
                    value={tripForm.vehicleNumber}
                    onChange={(e) => setTripForm({ ...tripForm, vehicleNumber: e.target.value.toUpperCase() })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Driver Name</label>
                  <input
                    type="text"
                    placeholder="Ramesh Bhai"
                    value={tripForm.driverName}
                    onChange={(e) => setTripForm({ ...tripForm, driverName: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Driver Mobile</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={tripForm.driverMobile}
                    onChange={(e) => setTripForm({ ...tripForm, driverMobile: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">From Location</label>
                  <input
                    type="text"
                    placeholder="Main Godown"
                    value={tripForm.fromLocation}
                    onChange={(e) => setTripForm({ ...tripForm, fromLocation: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">To Destination</label>
                  <input
                    type="text"
                    placeholder="Party Godown / Job Worker"
                    value={tripForm.toLocation}
                    onChange={(e) => setTripForm({ ...tripForm, toLocation: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">LR Number</label>
                  <input
                    type="text"
                    placeholder="LR / bilty no. from transporter"
                    value={tripForm.lrNumber}
                    onChange={(e) => setTripForm({ ...tripForm, lrNumber: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">LR Date</label>
                  <input
                    type="date"
                    value={tripForm.lrDate}
                    onChange={(e) => setTripForm({ ...tripForm, lrDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              {/* Financial Charges */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                  Freight & Logistics Charges Breakdown
                </div>
                <div className="grid grid-cols-5 gap-2">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Freight (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.freightAmount}
                      onChange={(e) => setTripForm({ ...tripForm, freightAmount: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Loading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.loadingCharges}
                      onChange={(e) => setTripForm({ ...tripForm, loadingCharges: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Unloading (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.unloadingCharges}
                      onChange={(e) => setTripForm({ ...tripForm, unloadingCharges: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Other (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={tripForm.otherCharges}
                      onChange={(e) => setTripForm({ ...tripForm, otherCharges: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Paid By</label>
                    <select
                      value={tripForm.paidBy}
                      onChange={(e) => setTripForm({ ...tripForm, paidBy: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    >
                      <option value="Company">Company</option>
                      <option value="Party">Party</option>
                      <option value="Transporter">Transporter</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Cost Allocation Target</label>
                    <select
                      value={tripForm.costAllocationTarget}
                      onChange={(e) => setTripForm({ ...tripForm, costAllocationTarget: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    >
                      <option value="LOT">LOT (Landed Cost to Fabric Lots)</option>
                      <option value="SALES_ORDER">SALES_ORDER (Party Profitability / Transport Support)</option>
                      <option value="EXPENSE">EXPENSE (Freight Expense Journal)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Remarks</label>
                    <input
                      type="text"
                      placeholder="Optional remarks or notes"
                      value={tripForm.remarks || ''}
                      onChange={(e) => setTripForm({ ...tripForm, remarks: e.target.value })}
                      className="w-full text-sm border border-slate-200 rounded p-1.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Material Lines (Optional for Lot Cost Allocation) */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Material Lines (For Landed Cost Allocation)</div>
                <div className="grid grid-cols-5 gap-2 items-end">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Lot Number</label>
                    <input
                      type="text"
                      placeholder="LOT-2026-001"
                      value={materialDraft.lotNumber}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, lotNumber: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Taka No</label>
                    <input
                      type="text"
                      placeholder="TAK-01"
                      value={materialDraft.takaNumber}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, takaNumber: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Meters *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="100"
                      value={materialDraft.meters}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, meters: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Weight (Kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="12.5"
                      value={materialDraft.weightKg}
                      onChange={(e) => setMaterialDraft({ ...materialDraft, weightKg: e.target.value })}
                      className="w-full text-xs border border-slate-200 rounded p-1.5"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="w-full py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-medium rounded"
                    >
                      + Add Line
                    </button>
                  </div>
                </div>

                {tripForm.materials.length > 0 && (
                  <div className="border border-slate-200 rounded overflow-hidden mt-2">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <tr>
                          <th className="p-2 text-left">Lot</th>
                          <th className="p-2 text-left">Taka</th>
                          <th className="p-2 text-right">Meters</th>
                          <th className="p-2 text-right">Weight (Kg)</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tripForm.materials.map((m, idx) => (
                          <tr key={idx}>
                            <td className="p-2 font-medium">{m.lotNumber}</td>
                            <td className="p-2">{m.takaNumber || '—'}</td>
                            <td className="p-2 text-right">{m.meters} M</td>
                            <td className="p-2 text-right">{m.weightKg || '—'}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(idx)}
                                className="text-rose-600 hover:text-rose-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                >
                  {submitting ? 'Recording...' : 'Save Trip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Transporter Modal */}
      {showTransporterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-600" />
                Register New Transporter
              </h2>
              <button onClick={() => setShowTransporterModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTransporterSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Transporter Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Navkar Cargo"
                  value={newTransporter.name}
                  onChange={(e) => setNewTransporter({ ...newTransporter, name: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Transporter Code</label>
                  <input
                    type="text"
                    placeholder="TRP-001"
                    value={newTransporter.code}
                    onChange={(e) => setNewTransporter({ ...newTransporter, code: e.target.value.toUpperCase() })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="Ramesh"
                    value={newTransporter.contactPerson}
                    onChange={(e) => setNewTransporter({ ...newTransporter, contactPerson: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={newTransporter.phone}
                    onChange={(e) => setNewTransporter({ ...newTransporter, phone: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">GSTIN</label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={newTransporter.gstin}
                    onChange={(e) => setNewTransporter({ ...newTransporter, gstin: e.target.value.toUpperCase() })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Office Address</label>
                <textarea
                  rows={2}
                  placeholder="Ring Road, Surat"
                  value={newTransporter.address}
                  onChange={(e) => setNewTransporter({ ...newTransporter, address: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTransporterModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transporterSubmitting}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
                >
                  {transporterSubmitting ? 'Saving...' : 'Save Transporter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {deliveryModalTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-emerald-50/50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Confirm Trip Delivery — {deliveryModalTrip.trip_number}
              </h2>
              <button onClick={() => setDeliveryModalTrip(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmDeliverySubmit} className="p-4 space-y-4">
              {deliveryError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {deliveryError}
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <div className="font-medium text-slate-800">
                  Vehicle: <span className="font-semibold text-slate-900">{deliveryModalTrip.vehicle_number}</span>
                </div>
                <div className="text-slate-600">
                  Route: {deliveryModalTrip.from_location || 'Mill'} → {deliveryModalTrip.to_location || 'Destination'}
                </div>
                <div className="text-slate-500">
                  Driver: {deliveryModalTrip.driver_name || 'Unassigned'} ({deliveryModalTrip.driver_mobile || '—'})
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Actual Delivery Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Delivery Proof Document / Signed LR (Optional)
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center hover:border-indigo-300 transition-colors">
                  <input
                    type="file"
                    id="proof-upload"
                    accept="image/*,application/pdf"
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                  <label htmlFor="proof-upload" className="cursor-pointer flex flex-col items-center justify-center">
                    <UploadCloud className="w-6 h-6 text-indigo-500 mb-1" />
                    <span className="text-xs text-slate-600">
                      {proofFile ? proofFile.name : 'Click to select signed challan, LR, or receiver photo'}
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5">PDF, PNG, JPG accepted</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Delivery Remarks / Receiver Details</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Received in good condition by godown manager Mr. Sharma"
                  value={deliveryRemarks}
                  onChange={(e) => setDeliveryRemarks(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeliveryModalTrip(null)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={confirmingDelivery}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {confirmingDelivery ? 'Confirming...' : 'Confirm Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <PrintLorryReceiptModal isOpen={Boolean(printTripId)} onClose={() => setPrintTripId(null)} tripId={printTripId} />
    </div>
  );
}
