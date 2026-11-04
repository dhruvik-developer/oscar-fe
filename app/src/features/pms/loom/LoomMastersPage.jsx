import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Plus, Trash2, Edit2, Check, RefreshCw, Cpu, Package, Factory, Users } from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { qc, formatNum } from '../utils/loomCalculations';

export default function LoomMastersPage() {
  const [activeTab, setActiveTab] = useState('qualities'); // 'qualities' | 'yarns' | 'factories' | 'coords'
  const [loading, setLoading] = useState(true);
  const [yarns, setYarns] = useState([]);
  const [qualities, setQualities] = useState([]);
  const [factories, setFactories] = useState([]);
  const [coords, setCoords] = useState([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState('');

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
    if (!qForm.name || !qForm.ends || !qForm.ppi) return alert('Name, ends and PPI required');
    try {
      await loomService.createQuality(qForm);
      setQForm((prev) => ({ ...prev, name: '' }));
      loadData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to add quality');
    }
  };

  const handleDeleteQuality = async (id) => {
    if (!confirm('Delete this quality?')) return;
    try {
      await loomService.deleteQuality(id);
      loadData();
    } catch (err) {
      alert('Cannot delete quality in active use.');
    }
  };

  // Yarn actions
  const handleAddYarn = async (e) => {
    e.preventDefault();
    if (!yForm.name || !yForm.denier) return alert('Name and denier required');
    try {
      await loomService.createYarn(yForm);
      setYForm({ name: '', denier: '', kg_per_bag: 25, rate: 0, note: '' });
      loadData();
    } catch (err) {
      alert(err?.payload?.detail || 'Failed to add yarn');
    }
  };

  const handleUpdateYarnRate = async (id, rate) => {
    try {
      await loomService.updateYarn(id, { rate: Number(rate) });
      loadData();
    } catch (err) {
      alert('Failed to update rate');
    }
  };

  const handleDeleteYarn = async (id) => {
    if (!confirm('Delete this yarn?')) return;
    try {
      await loomService.deleteYarn(id);
      loadData();
    } catch (err) {
      alert('Cannot delete yarn with active bookings or qualities.');
    }
  };

  // Factory & Machines actions
  const handleAddFactory = async (e) => {
    e.preventDefault();
    if (!fForm.name) return alert('Factory name required');
    try {
      await loomService.createFactory(fForm);
      setFForm({ name: '', coord: '' });
      loadData();
    } catch (err) {
      alert('Failed to add factory');
    }
  };

  const handleBatchCreateMachines = async (e) => {
    e.preventDefault();
    if (!selectedFactoryId) return alert('Pick factory');
    try {
      await loomService.batchCreateMachines({
        factory: selectedFactoryId,
        from_no: mForm.from_no,
        to_no: mForm.to_no,
        reed: mForm.reed,
      });
      loadData();
    } catch (err) {
      alert('Failed to create machines');
    }
  };

  const handleUpdateMachineReed = async (id, reed) => {
    try {
      await loomService.updateMachine(id, { reed: Number(reed) });
      loadData();
    } catch (err) {
      alert('Failed to update reed');
    }
  };

  const handleDeleteMachine = async (id) => {
    if (!confirm('Delete machine?')) return;
    try {
      await loomService.deleteMachine(id);
      loadData();
    } catch (err) {
      alert('Failed to delete machine');
    }
  };

  // Coordinator actions
  const handleAddCoord = async (e) => {
    e.preventDefault();
    if (!cForm.name) return alert('Name required');
    try {
      await loomService.createCoordinator(cForm);
      setCForm({ name: '', phone: '' });
      loadData();
    } catch (err) {
      alert('Failed to add coordinator');
    }
  };

  const selectedFactory = factories.find((f) => f.id === selectedFactoryId);
  const factoryMachines = selectedFactory?.machines || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loom PMS Masters"
        subtitle="Technical qualities, yarn count specs, factory looms and coordinator master files."
        actions={
          <Button variant="secondary" onClick={loadData} disabled={loading}>
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2">
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
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 ${
                active
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50 dark:bg-blue-950/20'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Technical Qualities */}
      {activeTab === 'qualities' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              Add Technical Quality (The Spec that Drives Calculations)
            </h3>
            <form onSubmit={handleAddQuality} className="grid grid-cols-2 md:grid-cols-5 gap-3.5 items-end">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Quality Name</label>
                <input
                  type="text"
                  placeholder="e.g. 3103-A"
                  value={qForm.name}
                  onChange={(e) => setQForm({ ...qForm, name: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Warp Yarn</label>
                <select
                  value={qForm.warp_yarn}
                  onChange={(e) => setQForm({ ...qForm, warp_yarn: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
                >
                  {yarns.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Total Ends (Tar)</label>
                <input
                  type="number"
                  placeholder="4872"
                  value={qForm.ends}
                  onChange={(e) => setQForm({ ...qForm, ends: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Warp Crimp %</label>
                <input
                  type="number"
                  step="0.1"
                  value={qForm.crimp}
                  onChange={(e) => setQForm({ ...qForm, crimp: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Weft Yarn</label>
                <select
                  value={qForm.weft_yarn}
                  onChange={(e) => setQForm({ ...qForm, weft_yarn: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
                >
                  {yarns.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Reed Count</label>
                <input
                  type="number"
                  placeholder="84"
                  value={qForm.reed}
                  onChange={(e) => setQForm({ ...qForm, reed: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Reed Width (inch)</label>
                <input
                  type="number"
                  step="0.5"
                  value={qForm.reed_w}
                  onChange={(e) => setQForm({ ...qForm, reed_w: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Picks Per Inch (PPI)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="56"
                  value={qForm.ppi}
                  onChange={(e) => setQForm({ ...qForm, ppi: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Weft Wastage %</label>
                <input
                  type="number"
                  step="0.1"
                  value={qForm.wastage}
                  onChange={(e) => setQForm({ ...qForm, wastage: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Job ₹ / Pick</label>
                <input
                  type="number"
                  step="0.01"
                  value={qForm.pick_charge}
                  onChange={(e) => setQForm({ ...qForm, pick_charge: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div className="md:col-span-5 flex justify-end">
                <Button type="submit" variant="primary">
                  <Plus size={14} className="mr-1" />
                  Add Technical Quality
                </Button>
              </div>
            </form>

            {/* Live Calculation Preview Banner */}
            {liveQc && (
              <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
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
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Registered Qualities & Automated Costing
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Quality</th>
                    <th className="py-2.5 px-3">Warp Yarn</th>
                    <th className="py-2.5 px-3 text-right">Ends</th>
                    <th className="py-2.5 px-3">Weft Yarn</th>
                    <th className="py-2.5 px-3 text-right">Reed</th>
                    <th className="py-2.5 px-3 text-right">Width</th>
                    <th className="py-2.5 px-3 text-right">PPI</th>
                    <th className="py-2.5 px-3 text-right">Warp kg/m</th>
                    <th className="py-2.5 px-3 text-right">Weft kg/m</th>
                    <th className="py-2.5 px-3 text-right">GSM</th>
                    <th className="py-2.5 px-3 text-right">Yarn ₹/m</th>
                    <th className="py-2.5 px-3 text-right">Job ₹/m</th>
                    <th className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">Total ₹/m</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {qualities.map((q) => (
                    <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{q.name}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{q.warp_yarn_name}</td>
                      <td className="py-2.5 px-3 text-right">{q.ends}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{q.weft_yarn_name}</td>
                      <td className="py-2.5 px-3 text-right">{q.reed}</td>
                      <td className="py-2.5 px-3 text-right">{q.reed_w}"</td>
                      <td className="py-2.5 px-3 text-right">{q.ppi}</td>
                      <td className="py-2.5 px-3 text-right">{q.warp_kg_m?.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-right">{q.weft_kg_m?.toFixed(4)}</td>
                      <td className="py-2.5 px-3 text-right font-medium">{formatNum(q.gsm, 1)}</td>
                      <td className="py-2.5 px-3 text-right">₹{((q.warp_cost || 0) + (q.weft_cost || 0)).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right">₹{q.job_cost?.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                        ₹{q.total_cost?.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleDeleteQuality(q.id)}
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
          </div>
        </div>
      )}

      {/* Tab 2: Yarns */}
      {activeTab === 'yarns' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Add Yarn Type</h3>
            <form onSubmit={handleAddYarn} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Yarn Name</label>
                <input
                  type="text"
                  placeholder="e.g. 60 SIRO"
                  value={yForm.name}
                  onChange={(e) => setYForm({ ...yForm, name: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Denier (spun: 5315 ÷ Ne)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 89"
                  value={yForm.denier}
                  onChange={(e) => setYForm({ ...yForm, denier: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Kg per Bag</label>
                <input
                  type="number"
                  value={yForm.kg_per_bag}
                  onChange={(e) => setYForm({ ...yForm, kg_per_bag: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Current Rate (₹ / kg)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="e.g. 210"
                  value={yForm.rate}
                  onChange={(e) => setYForm({ ...yForm, rate: Number(e.target.value) })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={yForm.note}
                  onChange={(e) => setYForm({ ...yForm, note: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">
                <Plus size={14} className="mr-1" /> Add Yarn
              </Button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Yarn Master (Rates Directly Update Quality Costings)
              </h3>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Yarn</th>
                  <th className="py-2.5 px-3 text-right">Denier</th>
                  <th className="py-2.5 px-3 text-right">Kg / Bag</th>
                  <th className="py-2.5 px-3 text-right">Current Rate (₹/kg)</th>
                  <th className="py-2.5 px-3">Note</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {yarns.map((y) => (
                  <tr key={y.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{y.name}</td>
                    <td className="py-2.5 px-3 text-right">{y.denier}</td>
                    <td className="py-2.5 px-3 text-right">{y.kg_per_bag}</td>
                    <td className="py-2.5 px-3 text-right">
                      <input
                        type="number"
                        defaultValue={y.rate}
                        onBlur={(e) => handleUpdateYarnRate(y.id, e.target.value)}
                        className="w-20 text-right px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{y.note || '-'}</td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleDeleteYarn(y.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Factories & Machines */}
      {activeTab === 'factories' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Create Factory */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Add Factory Unit</h3>
              <form onSubmit={handleAddFactory} className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Factory Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Royal King Texo"
                    value={fForm.name}
                    onChange={(e) => setFForm({ ...fForm, name: e.target.value })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                    required
                  />
                </div>
                <div className="w-44">
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Coordinator</label>
                  <select
                    value={fForm.coord}
                    onChange={(e) => setFForm({ ...fForm, coord: e.target.value })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs"
                  >
                    <option value="">Select...</option>
                    {coords.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="primary">Add Factory</Button>
              </form>
            </div>

            {/* Batch Add Machines */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Batch Add Machines to Factory</h3>
              <form onSubmit={handleBatchCreateMachines} className="grid grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Machine From</label>
                  <input
                    type="number"
                    value={mForm.from_no}
                    onChange={(e) => setMForm({ ...mForm, from_no: Number(e.target.value) })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">To</label>
                  <input
                    type="number"
                    value={mForm.to_no}
                    onChange={(e) => setMForm({ ...mForm, to_no: Number(e.target.value) })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 uppercase">Reed</label>
                  <input
                    type="number"
                    value={mForm.reed}
                    onChange={(e) => setMForm({ ...mForm, reed: Number(e.target.value) })}
                    className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  />
                </div>
                <Button type="submit" variant="secondary">Add Machines</Button>
              </form>
            </div>
          </div>

          {/* Machine Inventory by Factory */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Loom Inventory by Factory
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Select Factory:</span>
                <select
                  value={selectedFactoryId}
                  onChange={(e) => setSelectedFactoryId(e.target.value)}
                  className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 text-xs font-semibold"
                >
                  {factories.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} ({f.machines_count} looms)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-3">
              {factoryMachines.map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-center space-y-1.5"
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">MCN {m.no}</div>
                  <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                    <span>Reed:</span>
                    <input
                      type="number"
                      defaultValue={m.reed}
                      onBlur={(e) => handleUpdateMachineReed(m.id, e.target.value)}
                      className="w-12 text-center rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-semibold py-0.5"
                    />
                  </div>
                  <button
                    onClick={() => handleDeleteMachine(m.id)}
                    className="text-[10px] text-red-500 hover:text-red-700 block mx-auto pt-1"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!factoryMachines.length && (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                  No looms set up for this factory yet. Use the batch adder above.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Coordinators */}
      {activeTab === 'coords' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Add Factory Coordinator</h3>
            <form onSubmit={handleAddCoord} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Coordinator Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mayur"
                  value={cForm.name}
                  onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-500 uppercase">Phone Number</label>
                <input
                  type="text"
                  placeholder="Optional phone"
                  value={cForm.phone}
                  onChange={(e) => setCForm({ ...cForm, phone: e.target.value })}
                  className="w-full mt-1 h-9 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-xs"
                />
              </div>
              <Button type="submit" variant="primary" className="w-full">Add Coordinator</Button>
            </form>
          </div>

          <div className="md:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Registered Coordinators
              </h3>
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Assigned Factories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {coords.map((c) => {
                  const assigned = factories.filter((f) => f.coord === c.id).map((f) => f.name).join(', ') || 'None';
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{c.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{c.phone || '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">{assigned}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
