import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Plus, Trash2, Edit2, Check, RefreshCw, Cpu, Package, Factory, Users } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import TablePagination from '../../../components/ui/TablePagination';
import { loomService } from '../../../services/loomService';
import { qc, formatNum, preventNegativeInput } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function LoomMastersPage() {
  const { showToast } = useERP();
  const [deleteConfirmState, setDeleteConfirmState] = useState(null);
  const [activeTab, setActiveTab] = useState('qualities'); // 'qualities' | 'yarns' | 'factories' | 'coords'
  const [loading, setLoading] = useState(true);
  const [yarns, setYarns] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [factories, setFactories] = useState([]);
  const [coords, setCoords] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');

  const [qualPage, setQualPage] = useState(1);
  const [qualPageSize, setQualPageSize] = useState(10);

  const [yarnPage, setYarnPage] = useState(1);
  const [yarnPageSize, setYarnPageSize] = useState(10);

  const [coordPage, setCoordPage] = useState(1);
  const [coordPageSize, setCoordPageSize] = useState(10);

  const paginatedQualities = useMemo(() => {
    const start = (qualPage - 1) * qualPageSize;
    return qualities.slice(start, start + qualPageSize);
  }, [qualities, qualPage, qualPageSize]);

  const paginatedYarns = useMemo(() => {
    const start = (yarnPage - 1) * yarnPageSize;
    return yarns.slice(start, start + yarnPageSize);
  }, [yarns, yarnPage, yarnPageSize]);

  const paginatedCoords = useMemo(() => {
    const start = (coordPage - 1) * coordPageSize;
    return coords.slice(start, start + coordPageSize);
  }, [coords, coordPage, coordPageSize]);

  // Form states
  const [qForm, setQForm] = useState({
    name: '', warp_yarn: '', ends: 4872, crimp: 5, weft_yarn: '', reed: 84, reed_w: 58, ppi: 56, wastage: 8, pick_charge: 0.15,
  });
  const [yForm, setYForm] = useState({ name: '', denier: '', kg_per_bag: 25, rate: 0, note: '' });
  const [fForm, setFForm] = useState({ name: '', coord: '' });
  const [mForm, setMForm] = useState({ from_no: 1, to_no: 18, reed: 84 });
  const [cForm, setCForm] = useState({ name: '', phone: '' });

  const yarnMap = useMemo(() => {
    const map = {};
    yarns.forEach((y) => { map[y.id] = y; });
    return map;
  }, [yarns]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [yRes, qRes, fRes, cRes] = await Promise.all([
        loomService.getYarns(),
        loomService.getQualities(),
        loomService.getFactories(),
        loomService.getCoordinators(),
      ]);
      const yList = Array.isArray(yRes) ? yRes : yRes?.results || [];
      const qList = Array.isArray(qRes) ? qRes : qRes?.results || [];
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const cList = Array.isArray(cRes) ? cRes : cRes?.results || [];

      setYarns(yList);
      setQualities(qList);
      setFactories(fList);
      setCoords(cList);

      if (yList.length && !qForm.warp_yarn) {
        setQForm((prev) => ({ ...prev, warp_yarn: yList[0].id, weft_yarn: yList[1]?.id || yList[0].id }));
      }
      if (fList.length && !selectedFactoryId) {
        setSelectedFactoryId(fList[0].id);
      }
    } catch (err) {
      console.error('Error loading loom masters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const liveQc = useMemo(() => {
    return qc(qForm, yarnMap);
  }, [qForm, yarnMap]);

  // Quality actions
  const handleAddQuality = async (e) => {
    e.preventDefault();
    if (!qForm.name || !qForm.ends || !qForm.ppi) {
      showToast('Name, ends and PPI are required', 'warning');
      return;
    }
    if (
      Number(qForm.ends) <= 0 ||
      Number(qForm.reed) <= 0 ||
      Number(qForm.ppi) <= 0 ||
      Number(qForm.crimp || 0) < 0 ||
      Number(qForm.wastage || 0) < 0 ||
      Number(qForm.reed_w || 0) <= 0 ||
      Number(qForm.pick_charge || 0) < 0
    ) {
      showToast('Technical parameters must be positive numbers (ends, reed, width, PPI > 0)', 'error');
      return;
    }
    try {
      await loomService.createQuality(qForm);
      showToast('Fabric quality added', 'success');
      setQForm((prev) => ({ ...prev, name: '' }));
      loadData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to add quality', 'error');
    }
  };

  const handleDeleteQuality = async (id) => {
    try {
      await loomService.deleteQuality(id);
      showToast('Fabric quality deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Cannot delete quality in active use', 'error');
    }
  };

  // Yarn actions
  const handleAddYarn = async (e) => {
    e.preventDefault();
    if (!yForm.name || !yForm.denier) {
      showToast('Name and denier are required', 'warning');
      return;
    }
    if (Number(yForm.denier) <= 0 || Number(yForm.kg_per_bag || 0) <= 0 || Number(yForm.rate || 0) < 0) {
      showToast('Denier and Kg per bag must be > 0, and rate cannot be negative', 'error');
      return;
    }
    try {
      await loomService.createYarn(yForm);
      showToast('Yarn type added', 'success');
      setYForm({ name: '', denier: '', kg_per_bag: 25, rate: 0, note: '' });
      loadData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to add yarn', 'error');
    }
  };

  const handleUpdateYarnRate = async (id, rate) => {
    if (Number(rate) < 0) {
      showToast('Yarn rate cannot be negative', 'error');
      return;
    }
    try {
      await loomService.updateYarn(id, { rate: Number(rate) });
      showToast('Yarn market rate updated', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to update rate', 'error');
    }
  };

  const handleDeleteYarn = async (id) => {
    try {
      await loomService.deleteYarn(id);
      showToast('Yarn type deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Cannot delete yarn with active bookings or qualities', 'error');
    }
  };

  // Factory & Machines actions
  const handleAddFactory = async (e) => {
    e.preventDefault();
    if (!fForm.name) {
      showToast('Factory name is required', 'warning');
      return;
    }
    try {
      await loomService.createFactory(fForm);
      showToast('Factory unit registered', 'success');
      setFForm({ name: '', coord: '' });
      loadData();
    } catch (err) {
      showToast('Failed to add factory', 'error');
    }
  };

  const handleBatchCreateMachines = async (e) => {
    e.preventDefault();
    if (!selectedFactoryId) {
      showToast('Please select a factory unit first', 'warning');
      return;
    }
    if (Number(mForm.from_no) <= 0 || Number(mForm.to_no) <= 0 || Number(mForm.reed) <= 0) {
      showToast('Machine numbers and reed count must be positive numbers', 'error');
      return;
    }
    if (Number(mForm.to_no) < Number(mForm.from_no)) {
      showToast('To Machine No cannot be less than From Machine No', 'warning');
      return;
    }
    try {
      await loomService.batchCreateMachines({
        factory: selectedFactoryId,
        from_no: mForm.from_no,
        to_no: mForm.to_no,
        reed: mForm.reed,
      });
      showToast('Machines generated successfully', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to create machines', 'error');
    }
  };

  const handleUpdateMachineReed = async (id, reed) => {
    if (Number(reed) <= 0) {
      showToast('Machine reed must be greater than 0', 'error');
      return;
    }
    try {
      await loomService.updateMachine(id, { reed: Number(reed) });
      showToast('Machine reed updated', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to update reed', 'error');
    }
  };

  const handleDeleteMachine = async (id) => {
    try {
      await loomService.deleteMachine(id);
      showToast('Machine deleted', 'success');
      loadData();
    } catch (err) {
      showToast('Failed to delete machine', 'error');
    }
  };

  // Coordinator actions
  const handleAddCoord = async (e) => {
    e.preventDefault();
    if (!cForm.name) {
      showToast('Coordinator name is required', 'warning');
      return;
    }
    try {
      await loomService.createCoordinator(cForm);
      showToast('Loom coordinator added', 'success');
      setCForm({ name: '', phone: '' });
      loadData();
    } catch (err) {
      showToast('Failed to add coordinator', 'error');
    }
  };

  const selectedFactory = factories.find((f) => f.id === selectedFactoryId);
  const factoryMachines = selectedFactory?.machines || [];

  return (
    <div className="pms-screen w-full space-y-6">
      <PageHeader
        title="Loom PMS Masters"
        subtitle="Technical qualities, yarn count specs, factory looms and coordinator master files."
        actions={
          <Button variant="secondary" onClick={loadData} disabled={loading} size="sm">
            <RefreshCw size={13} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'qualities', label: 'Technical Qualities', icon: Layers },
          { id: 'yarns', label: 'Yarn Catalog & Rates', icon: Package },
          { id: 'factories', label: 'Factories & Machines', icon: Factory },
          { id: 'coords', label: 'Coordinators', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                active
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Technical Qualities */}
      {activeTab === 'qualities' && (
        <div className="space-y-3.5 sm:space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">
              Add Technical Quality (The Spec that Drives Calculations)
            </h3>
            <form onSubmit={handleAddQuality} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div>
                <label className="pms-label">Quality Name</label>
                <input
                  type="text"
                  placeholder="e.g. 3103-A"
                  value={qForm.name}
                  onChange={(e) => setQForm({ ...qForm, name: e.target.value })}
                  className="pms-input w-full"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Warp Yarn</label>
                <select
                  value={qForm.warp_yarn}
                  onChange={(e) => setQForm({ ...qForm, warp_yarn: e.target.value })}
                  className="pms-select w-full cursor-pointer"
                >
                  {yarns.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pms-label">Total Ends (Tar)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="4872"
                  value={qForm.ends}
                  onChange={(e) => setQForm({ ...qForm, ends: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Warp Crimp %</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={qForm.crimp}
                  onChange={(e) => setQForm({ ...qForm, crimp: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full"
                />
              </div>
              <div>
                <label className="pms-label">Weft Yarn</label>
                <select
                  value={qForm.weft_yarn}
                  onChange={(e) => setQForm({ ...qForm, weft_yarn: e.target.value })}
                  className="pms-select w-full cursor-pointer"
                >
                  {yarns.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="pms-label">Reed Count</label>
                <input
                  type="number"
                  min="1"
                  placeholder="84"
                  value={qForm.reed}
                  onChange={(e) => setQForm({ ...qForm, reed: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Reed Width (inch)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={qForm.reed_w}
                  onChange={(e) => setQForm({ ...qForm, reed_w: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full"
                />
              </div>
              <div>
                <label className="pms-label">Picks Per Inch (PPI)</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder="56"
                  value={qForm.ppi}
                  onChange={(e) => setQForm({ ...qForm, ppi: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Weft Wastage %</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={qForm.wastage}
                  onChange={(e) => setQForm({ ...qForm, wastage: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full"
                />
              </div>
              <div>
                <label className="pms-label">Job ₹ / Pick</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={qForm.pick_charge}
                  onChange={(e) => setQForm({ ...qForm, pick_charge: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full"
                />
              </div>
              <div className="col-span-full flex justify-end pt-1">
                <button type="submit" className="pms-btn-emerald">
                  <Plus size={16} /> Add Technical Quality
                </button>
              </div>
            </form>

            {/* Live Calculation Preview Banner */}
            {liveQc && (
              <div className="mt-3 p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                <span className="font-semibold">Live Technical Preview:</span> PPM: <b>{formatNum(liveQc.ppm, 1)}</b> |
                Warp: <b>{liveQc.warpKgM.toFixed(4)} kg/m</b> (₹{liveQc.warpCost.toFixed(2)}/m) |
                Weft: <b>{liveQc.weftKgM.toFixed(4)} kg/m</b> (₹{liveQc.weftCost.toFixed(2)}/m) |
                GSM: <b>{formatNum(liveQc.gsm, 1)}</b> | Job-work: <b>₹{liveQc.jobCost.toFixed(2)}/m</b> |
                <span className="font-bold text-emerald-700 dark:text-emerald-400 ml-1">
                  Total Grey Cost: ₹{liveQc.totalCost.toFixed(2)}/m
                </span>
              </div>
            )}
          </div>

          {/* Qualities Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Registered Qualities & Automated Costing
              </h3>
            </div>
            <div className="pms-table-container overflow-x-auto">
              <table className="w-full text-xs text-left pms-sticky-header">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10">Quality</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Warp Yarn</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Ends</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Weft Yarn</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Reed</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Width</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">PPI</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Warp kg/m</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Weft kg/m</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">GSM</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Yarn ₹/m</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Job ₹/m</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-bold text-slate-900 dark:text-slate-100">Total ₹/m</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedQualities.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        {q.name}
                      </td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-600 dark:text-slate-400">{q.warp_yarn_name}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{q.ends}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-600 dark:text-slate-400">{q.weft_yarn_name}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{q.reed}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">{q.reed_w}"</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{q.ppi}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{q.warp_kg_m?.toFixed(4)}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{q.weft_kg_m?.toFixed(4)}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-medium">{formatNum(q.gsm, 1)}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">₹{((q.warp_cost || 0) + (q.weft_cost || 0)).toFixed(2)}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">₹{q.job_cost?.toFixed(2)}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        ₹{q.total_cost?.toFixed(2)}
                      </td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                        <button
                          onClick={() => setDeleteConfirmState({ type: "quality", id: q.id, title: "Delete Fabric Quality", message: `Delete quality "${q.name}"? Cannot be deleted if used in active programs or beams.` })}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!qualities.length && (
                    <tr>
                      <td colSpan={14} className="py-8 text-center text-slate-400">
                        No technical qualities registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              total={qualities.length}
              page={qualPage}
              pageSize={qualPageSize}
              onPageChange={setQualPage}
              onPageSizeChange={(newSize) => {
                setQualPageSize(newSize);
                setQualPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}

      {/* Tab 2: Yarns */}
      {activeTab === 'yarns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">Add Yarn Type</h3>
            <form onSubmit={handleAddYarn} className="space-y-3">
              <div>
                <label className="pms-label">Yarn Name</label>
                <input
                  type="text"
                  placeholder="e.g. 60 SIRO"
                  value={yForm.name}
                  onChange={(e) => setYForm({ ...yForm, name: e.target.value })}
                  className="pms-input w-full"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Denier (spun: 5315 ÷ Ne)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="e.g. 89"
                  value={yForm.denier}
                  onChange={(e) => setYForm({ ...yForm, denier: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Kg per Bag</label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={yForm.kg_per_bag}
                  onChange={(e) => setYForm({ ...yForm, kg_per_bag: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                />
              </div>
              <div>
                <label className="pms-label">Current Rate (₹ / kg)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 210"
                  value={yForm.rate}
                  onChange={(e) => setYForm({ ...yForm, rate: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                />
              </div>
              <div>
                <label className="pms-label">Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={yForm.note}
                  onChange={(e) => setYForm({ ...yForm, note: e.target.value })}
                  className="pms-input w-full"
                />
              </div>
              <button type="submit" className="pms-btn-emerald w-full">
                <Plus size={16} /> Add Yarn
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Yarn Master (Rates Directly Update Quality Costings)
              </h3>
            </div>
            <div className="pms-table-container overflow-x-auto">
              <table className="w-full text-xs text-left pms-sticky-header">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Yarn</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Denier</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Kg / Bag</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Current Rate (₹/kg)</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Note</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedYarns.map((y) => (
                    <tr key={y.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200">{y.name}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{y.denier}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{y.kg_per_bag}</td>
                      <td className="py-1.5 px-2.5 sm:py-2 sm:px-3 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          defaultValue={y.rate}
                          onKeyDown={preventNegativeInput}
                          onBlur={(e) => {
                            const val = e.target.value;
                            handleUpdateYarnRate(y.id, val === '' ? 0 : Math.max(0, Number(val)));
                          }}
                          className="w-18 text-right px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                        />
                      </td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-400">{y.note || '-'}</td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                        <button
                          onClick={() => setDeleteConfirmState({ type: "yarn", id: y.id, title: "Delete Yarn", message: `Delete yarn "${y.name}"? Cannot be deleted if used in active bookings.` })}
                          className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!yarns.length && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No yarns registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              total={yarns.length}
              page={yarnPage}
              pageSize={yarnPageSize}
              onPageChange={setYarnPage}
              onPageSizeChange={(newSize) => {
                setYarnPageSize(newSize);
                setYarnPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Factories & Machines */}
      {activeTab === 'factories' && (
        <div className="space-y-3.5 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {/* Create Factory */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">Add Factory Unit</h3>
              <form onSubmit={handleAddFactory} className="flex flex-wrap sm:flex-nowrap gap-2.5 sm:gap-3 items-end">
                <div className="flex-1 min-w-[140px]">
                  <label className="pms-label">Factory Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Royal King Texo"
                    value={fForm.name}
                    onChange={(e) => setFForm({ ...fForm, name: e.target.value })}
                    className="pms-input w-full"
                    required
                  />
                </div>
                <div className="w-full sm:w-44">
                  <label className="pms-label">Coordinator</label>
                  <select
                    value={fForm.coord}
                    onChange={(e) => setFForm({ ...fForm, coord: e.target.value })}
                    className="pms-select w-full cursor-pointer"
                  >
                    <option value="">Select...</option>
                    {coords.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="pms-btn-emerald">
                  <Plus size={16} /> Add Factory
                </button>
              </form>
            </div>

            {/* Batch Add Machines */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">Batch Add Machines to Factory</h3>
              <form onSubmit={handleBatchCreateMachines} className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="pms-label">From No</label>
                  <input
                    type="number"
                    min="1"
                    value={mForm.from_no}
                    onChange={(e) => setMForm({ ...mForm, from_no: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
                    onKeyDown={preventNegativeInput}
                    className="pms-input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="pms-label">To</label>
                  <input
                    type="number"
                    min="1"
                    value={mForm.to_no}
                    onChange={(e) => setMForm({ ...mForm, to_no: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
                    onKeyDown={preventNegativeInput}
                    className="pms-input w-full font-mono"
                  />
                </div>
                <div>
                  <label className="pms-label">Reed</label>
                  <input
                    type="number"
                    min="1"
                    value={mForm.reed}
                    onChange={(e) => setMForm({ ...mForm, reed: e.target.value === '' ? '' : Math.max(1, Number(e.target.value)) })}
                    onKeyDown={preventNegativeInput}
                    className="pms-input w-full font-mono"
                  />
                </div>
                <div>
                  <button type="submit" className="pms-btn-secondary w-full">
                    <Plus size={15} /> Add
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Machine Inventory by Factory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Loom Inventory by Factory
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Factory:</span>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedFactoryId(val);
                    localStorage.setItem('oscar_pms_selected_factory', val);
                  }}
                  className="h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs cursor-pointer outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                >
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.machines_count} looms)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2 sm:gap-2.5">
              {factoryMachines.map((m) => (
                <div
                  key={m.id}
                  className="p-2 sm:p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-center space-y-1"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">MCN {m.no}</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                    <span>R:</span>
                    <input
                      type="number"
                      min="1"
                      defaultValue={m.reed}
                      onKeyDown={preventNegativeInput}
                      onBlur={(e) => {
                        const val = e.target.value;
                        handleUpdateMachineReed(m.id, val === '' ? 1 : Math.max(1, Number(val)));
                      }}
                      className="w-11 text-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold py-0.5"
                    />
                  </div>
                  <button
                    onClick={() => setDeleteConfirmState({ type: "machine", id: m.id, title: "Delete Machine", message: `Delete Machine ${m.no}?` })}
                    className="text-[10px] text-red-500 hover:text-red-700 block mx-auto pt-0.5"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!factoryMachines.length && (
                <div className="col-span-full py-6 text-center text-slate-400 text-xs">
                  No looms set up for this factory yet. Use the batch adder above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Coordinators */}
      {activeTab === 'coords' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight mb-3">Add Factory Coordinator</h3>
            <form onSubmit={handleAddCoord} className="space-y-3">
              <div>
                <label className="pms-label">Coordinator Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mayur"
                  value={cForm.name}
                  onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
                  className="pms-input w-full"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Phone Number</label>
                <input
                  type="text"
                  placeholder="Optional phone"
                  value={cForm.phone}
                  onChange={(e) => setCForm({ ...cForm, phone: e.target.value })}
                  className="pms-input w-full"
                />
              </div>
              <button type="submit" className="pms-btn-emerald w-full">
                <Plus size={16} /> Add Coordinator
              </button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Registered Coordinators
              </h3>
            </div>
            <div className="pms-table-container overflow-x-auto">
              <table className="w-full text-xs text-left pms-sticky-header">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Name</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Phone</th>
                    <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Assigned Factories</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedCoords.map((c) => {
                    const assigned = factories.filter((f) => f.coord === c.id).map((f) => f.name).join(', ') || 'None';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                        <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500">{c.phone || '-'}</td>
                        <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-600 dark:text-slate-400">{assigned}</td>
                      </tr>
                    );
                  })}
                  {!coords.length && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-400">
                        No coordinators registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              total={coords.length}
              page={coordPage}
              pageSize={coordPageSize}
              onPageChange={setCoordPage}
              onPageSizeChange={(newSize) => {
                setCoordPageSize(newSize);
                setCoordPage(1);
              }}
              pageSizeOptions={[10, 20, 50]}
            />
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteConfirmState)}
        onClose={() => setDeleteConfirmState(null)}
        onConfirm={async () => {
          const item = deleteConfirmState;
          setDeleteConfirmState(null);
          if (item?.type === 'quality') await handleDeleteQuality(item.id);
          else if (item?.type === 'yarn') await handleDeleteYarn(item.id);
          else if (item?.type === 'machine') await handleDeleteMachine(item.id);
        }}
        title={deleteConfirmState?.title || 'Delete Master Item'}
        message={deleteConfirmState?.message || 'Are you sure you want to delete this record?'}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
