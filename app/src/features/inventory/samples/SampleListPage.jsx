import React, { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical,
  Plus,
  RotateCcw,
  Flame,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  Layers,
  Calendar,
  User,
  Building2,
  ChevronRight,
  X,
  FileText,
} from 'lucide-react';
import { api } from '../../../services/api';
import { inventoryService, partiesService } from '../../../services/domainServices';
import PageInfoButton from '../../../components/ui/PageInfoButton';
import MasterSourceLink from '../../../components/common/MasterSourceLink';
import KpiCard from '../../../components/ui/KpiCard';

export default function SampleListPage() {
  const [samples, setSamples] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [parties, setParties] = useState([]);

  // Modals
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [activeSample, setActiveSample] = useState(null);

  // Form states
  const [issueForm, setIssueForm] = useState({
    partyId: '',
    salespersonId: '',
    brokerId: '',
    sampleType: 'CUT_PIECE',
    quantity: '1',
    uom: 'MTR',
    isReturnable: true,
    dueDate: '',
    remarks: '',
  });

  const [returnQty, setReturnQty] = useState('');
  const [returnCondition, setReturnCondition] = useState('Good');
  const [returnRemarks, setReturnRemarks] = useState('');

  const [consumeQty, setConsumeQty] = useState('');
  const [consumeRemarks, setConsumeRemarks] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const fetchSamples = useCallback(async () => {
    try {
      setLoading(true);
      const [samplesRes, dashRes] = await Promise.all([
        inventoryService.getSamples({ status: statusFilter || undefined }),
        inventoryService.getSampleDashboard(),
      ]);
      const data = samplesRes?.data || samplesRes?.results || samplesRes || [];
      setSamples(Array.isArray(data) ? data : []);
      setDashboard(dashRes?.data || dashRes || null);
    } catch (err) {
      console.error('Failed to load samples:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSamples();
    partiesService.getParties({ is_active: true }).then((res) => {
      const p = res?.data || res?.results || res || [];
      setParties(Array.isArray(p) ? p : []);
    }).catch(() => {});
  }, [fetchSamples]);

  const handleIssueSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await inventoryService.createSample(issueForm);
      setShowIssueModal(false);
      setIssueForm({
        partyId: '',
        salespersonId: '',
        brokerId: '',
        sampleType: 'CUT_PIECE',
        quantity: '1',
        uom: 'MTR',
        isReturnable: true,
        dueDate: '',
        remarks: '',
      });
      fetchSamples();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to issue sample.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!activeSample) return;
    try {
      setSubmitting(true);
      setError(null);
      await inventoryService.returnSampleAction(activeSample.id, {
        returnQuantity: returnQty,
        condition: returnCondition,
        remarks: returnRemarks,
      });
      setShowReturnModal(false);
      setActiveSample(null);
      setReturnQty('');
      fetchSamples();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to return sample.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsumeSubmit = async (e) => {
    e.preventDefault();
    if (!activeSample) return;
    try {
      setSubmitting(true);
      setError(null);
      await inventoryService.consumeSampleAction(activeSample.id, {
        consumeQuantity: consumeQty,
        remarks: consumeRemarks,
      });
      setShowConsumeModal(false);
      setActiveSample(null);
      setConsumeQty('');
      fetchSamples();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Failed to consume sample.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSamples = samples.filter((s) => {
    const q = search.toLowerCase();
    return (
      (s.sample_number || '').toLowerCase().includes(q) ||
      (s.party_name || s.party?.name || '').toLowerCase().includes(q) ||
      (s.sample_type || '').toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Returned':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Returned</span>;
      case 'Partially Returned':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200"><Clock className="w-3 h-3" /> Partial</span>;
      case 'Consumed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"><Flame className="w-3 h-3" /> Consumed</span>;
      case 'Overdue':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3" /> Overdue</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"><Clock className="w-3 h-3" /> Issued</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-7 h-7 text-indigo-600" />
              Sampling Register & Expense
            </h1>
            <PageInfoButton title="Sample Register & Expense" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track fabric swatches, cuts, and hangers issued to parties with automatic inventory deduction and expense booking.
          </p>
        </div>
        <button
          onClick={() => setShowIssueModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Issue New Sample
        </button>
      </div>

      {/* KPI Cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>ACTIVE SAMPLES (OUT)</span>
              <FlaskConical className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {dashboard.activeSamplesCount || 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {dashboard.activeMeters || 0} meters with parties
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>RETURNED SAMPLES</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              {dashboard.returnedCount || 0}
            </div>
            <div className="text-xs text-emerald-600 mt-1 font-medium">
              Stock returned to godown
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>CONSUMED / EXPENSE</span>
              <Flame className="w-4 h-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-2">
              ₹{(dashboard.totalExpense || 0).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {dashboard.consumedMeters || 0} meters non-returnable
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>OVERDUE RETURNS</span>
              <AlertCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {dashboard.overdueCount || 0}
            </div>
            <div className="text-xs text-rose-500 mt-1 font-medium">
              Requires customer follow-up
            </div>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search sample no, party..."
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
            className="text-sm border border-slate-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="Issued">Issued</option>
            <option value="Returned">Returned</option>
            <option value="Partially Returned">Partially Returned</option>
            <option value="Consumed">Consumed</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      {/* Samples Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                <th className="py-3 px-4">Sample No</th>
                <th className="py-3 px-4">Party & Broker</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Quantity</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">Loading samples...</td>
                </tr>
              ) : filteredSamples.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-10 text-slate-400">No samples found.</td>
                </tr>
              ) : (
                filteredSamples.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {s.sample_number}
                      <div className="text-xs text-slate-400 font-normal">{s.issue_date}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{s.party_name || s.party?.name || '—'}</div>
                      <div className="text-xs text-slate-500">
                        {s.salesperson_name ? `SP: ${s.salesperson_name}` : ''}
                        {s.broker_name ? ` • Broker: ${s.broker_name}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 font-medium">
                        {s.sample_type?.replace('_', ' ') || 'Cut Piece'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900">
                      {s.quantity} {s.uom || 'Mtr'}
                      {s.returned_quantity > 0 && (
                        <div className="text-xs text-emerald-600 font-normal">
                          Ret: {s.returned_quantity}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 text-xs">
                      {s.due_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {s.due_date}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(s.status)}</td>
                    <td className="py-3 px-4 text-right space-x-1">
                      {s.status !== 'Returned' && s.status !== 'Consumed' && (
                        <>
                          <button
                            onClick={() => {
                              setActiveSample(s);
                              setReturnQty(String(s.quantity - (s.returned_quantity || 0)));
                              setShowReturnModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                          >
                            Return
                          </button>
                          <button
                            onClick={() => {
                              setActiveSample(s);
                              setConsumeQty(String(s.quantity - (s.returned_quantity || 0)));
                              setShowConsumeModal(true);
                            }}
                            className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                          >
                            Consume
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Issue Sample Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-indigo-600" />
                Issue New Sample
              </h2>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleIssueSubmit} className="p-4 space-y-3">
              {error && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">Party / Customer *</label>
                  <MasterSourceLink source="parties" />
                </div>
                <select
                  required
                  value={issueForm.partyId}
                  onChange={(e) => setIssueForm({ ...issueForm, partyId: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Select Party</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.code || 'Party'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sample Type</label>
                  <select
                    value={issueForm.sampleType}
                    onChange={(e) => setIssueForm({ ...issueForm, sampleType: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="CUT_PIECE">Cut Piece</option>
                    <option value="HANGER">Hanger / Swatch</option>
                    <option value="FULL_TAKA">Full Taka</option>
                    <option value="BITTI">Bitti / Bit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Quantity (Meters/Pcs)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={issueForm.quantity}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Returnable Flag</label>
                  <select
                    value={issueForm.isReturnable ? 'true' : 'false'}
                    onChange={(e) => setIssueForm({ ...issueForm, isReturnable: e.target.value === 'true' })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                  >
                    <option value="true">Returnable Sample</option>
                    <option value="false">Non-Returnable (Consume)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={issueForm.dueDate}
                    onChange={(e) => setIssueForm({ ...issueForm, dueDate: e.target.value })}
                    className="w-full text-sm border border-slate-200 rounded-md p-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarks / Fabric Notes</label>
                <textarea
                  rows="2"
                  value={issueForm.remarks}
                  onChange={(e) => setIssueForm({ ...issueForm, remarks: e.target.value })}
                  placeholder="Design code, shade, shade card details..."
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm"
                >
                  {submitting ? 'Issuing...' : 'Issue Sample'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Sample Modal */}
      {showReturnModal && activeSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                Return Sample: {activeSample.sample_number}
              </h2>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReturnSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Return Quantity ({activeSample.uom || 'Mtr'})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={returnQty}
                  onChange={(e) => setReturnQty(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Condition</label>
                <select
                  value={returnCondition}
                  onChange={(e) => setReturnCondition(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white"
                >
                  <option value="Good">Good / Usable</option>
                  <option value="Damaged">Damaged / Scrap</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Notes on returned condition..."
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
                >
                  {submitting ? 'Recording...' : 'Accept Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consume Sample Modal */}
      {showConsumeModal && activeSample && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                <Flame className="w-5 h-5 text-purple-600" />
                Book Sample Expense: {activeSample.sample_number}
              </h2>
              <button onClick={() => setShowConsumeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConsumeSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Consumed Quantity ({activeSample.uom || 'Mtr'})</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Books cost directly to Sample Expense (P&L account) without customer return.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expense Reason / Remarks</label>
                <input
                  type="text"
                  value={consumeRemarks}
                  onChange={(e) => setConsumeRemarks(e.target.value)}
                  placeholder="Client kept fabric / cut testing..."
                  className="w-full text-sm border border-slate-200 rounded-md p-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConsumeModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg"
                >
                  {submitting ? 'Booking...' : 'Book Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
