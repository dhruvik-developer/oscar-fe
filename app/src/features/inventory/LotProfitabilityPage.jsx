import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Search,
  Plus,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
  Filter,
  CheckCircle2,
  PieChart,
  X,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { inventoryService } from '../../services/domainServices';
import { formatINR, formatDate, unwrapList, describeApiError } from '../accounts/accountingShared';

const COST_TYPE_LABELS = {
  GREY_PURCHASE: 'Grey Fabric Purchase',
  PURCHASE_FREIGHT: 'Inward Freight / Cartage',
  PROCESSING: 'Job Work Dyeing / Printing',
  PROCESSING_TRANSPORT: 'Mill Transport & Delivery',
  PACKING: 'Packing & Finishing',
  OTHER: 'Other Direct Surcharge',
};

const COST_TYPE_COLORS = {
  GREY_PURCHASE: 'bg-blue-100 text-blue-800 border-blue-200',
  PURCHASE_FREIGHT: 'bg-amber-100 text-amber-800 border-amber-200',
  PROCESSING: 'bg-purple-100 text-purple-800 border-purple-200',
  PROCESSING_TRANSPORT: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  PACKING: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  OTHER: 'bg-slate-100 text-slate-800 border-slate-200',
};

export default function LotProfitabilityPage() {
  const [profitabilityRows, setProfitabilityRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLotNo, setSelectedLotNo] = useState(null);

  // Detail lot landed cost data
  const [lotDetail, setLotDetail] = useState(null);
  const [lotDetailLoading, setLotDetailLoading] = useState(false);

  // Add Cost Entry Modal
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [submittingEntry, setSubmittingEntry] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [entryForm, setEntryForm] = useState({
    lot_number: '',
    cost_type: 'PROCESSING',
    amount: '',
    quantity: '',
    source_document_type: 'JWO',
    source_document_number: '',
    remarks: '',
  });

  const loadProfitability = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await inventoryService.getLotProfitability();
      const rows = Array.isArray(res) ? res : unwrapList(res);
      setProfitabilityRows(rows);
      if (rows.length > 0 && !selectedLotNo) {
        setSelectedLotNo(rows[0].lotNumber);
      }
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadLotLandedCost = async (lotNo) => {
    if (!lotNo) return;
    setLotDetailLoading(true);
    try {
      const res = await inventoryService.getLotLandedCost(lotNo);
      setLotDetail(res?.data || res);
    } catch {
      setLotDetail(null);
    } finally {
      setLotDetailLoading(false);
    }
  };

  useEffect(() => {
    loadProfitability();
  }, []);

  useEffect(() => {
    if (selectedLotNo) {
      loadLotLandedCost(selectedLotNo);
    }
  }, [selectedLotNo]);

  const handleOpenAddEntry = (lotNo) => {
    setEntryForm({
      lot_number: lotNo || selectedLotNo || '',
      cost_type: 'PROCESSING',
      amount: '',
      quantity: '',
      source_document_type: 'JWO',
      source_document_number: '',
      remarks: '',
    });
    setEntryError('');
    setShowAddEntryModal(true);
  };

  const handleEntrySubmit = async (e) => {
    e.preventDefault();
    if (!entryForm.lot_number) {
      setEntryError('Lot Number is required.');
      return;
    }
    if (!entryForm.amount || parseFloat(entryForm.amount) <= 0) {
      setEntryError('Amount must be greater than 0.');
      return;
    }

    setSubmittingEntry(true);
    setEntryError('');
    try {
      await inventoryService.createLotCostEntry({
        lot_number: entryForm.lot_number,
        cost_type: entryForm.cost_type,
        amount: parseFloat(entryForm.amount),
        quantity: parseFloat(entryForm.quantity) || 0,
        source_document_type: entryForm.source_document_type,
        source_document_number: entryForm.source_document_number || undefined,
        remarks: entryForm.remarks || undefined,
      });
      setShowAddEntryModal(false);
      loadLotLandedCost(entryForm.lot_number);
      loadProfitability();
    } catch (err) {
      setEntryError(describeApiError(err));
    } finally {
      setSubmittingEntry(false);
    }
  };

  // Filter lots
  const filteredRows = useMemo(() => {
    if (!search.trim()) return profitabilityRows;
    const q = search.toLowerCase();
    return profitabilityRows.filter((r) => String(r.lotNumber || '').toLowerCase().includes(q));
  }, [profitabilityRows, search]);

  const selectedSummary = useMemo(() => {
    return profitabilityRows.find((r) => r.lotNumber === selectedLotNo) || null;
  }, [profitabilityRows, selectedLotNo]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Landed Cost & Lot Profitability"
        subtitle="Track complete fabric cost ledgers, multi-stage processing charges, finished meters yield, and commercial profit margins per lot."
        actions={
          <Button
            icon={Plus}
            onClick={() => handleOpenAddEntry(selectedLotNo)}
            className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
          >
            Post Cost Entry
          </Button>
        }
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Stat Cards for Selected Lot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Selected Lot"
          value={selectedLotNo || 'None selected'}
          icon={Layers}
        />
        <StatCard
          label="Total Landed Cost"
          value={lotDetailLoading ? '…' : formatINR(lotDetail?.totalCost || selectedSummary?.totalLotCost || 0)}
          icon={DollarSign}
          tone="blue"
        />
        <StatCard
          label="Cost / Good Meter"
          value={
            lotDetailLoading
              ? '…'
              : `₹${parseFloat(lotDetail?.costPerMeter || selectedSummary?.unitCost || 0).toFixed(2)}/m`
          }
          icon={TrendingUp}
          tone="emerald"
        />
        <StatCard
          label="Net Contribution Margin"
          value={
            loading
              ? '…'
              : `${parseFloat(selectedSummary?.netMarginPct || 0).toFixed(1)}% (${formatINR(
                  selectedSummary?.netContribution || 0
                )})`
          }
          icon={PieChart}
          tone={parseFloat(selectedSummary?.netMarginPct || 0) < 0 ? 'rose' : 'amber'}
        />
      </div>

      {/* Main Split View: Left List of Lots, Right Detailed Ledger & Margins */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Lot Profitability Table (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white border border-[#dce5f4] rounded-xl p-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Filter by lot number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs border-none outline-none bg-transparent"
            />
          </div>

          <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
            <div className="p-3 border-b border-[#dce5f4] bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                Lots ({filteredRows.length})
              </span>
              <span className="text-[11px] text-slate-400">Click to view ledger</span>
            </div>

            <div className="max-h-[580px] overflow-y-auto divide-y divide-[#dce5f4]">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading lots…</div>
              ) : filteredRows.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No lot cost data found.</div>
              ) : (
                filteredRows.map((row) => {
                  const isSelected = row.lotNumber === selectedLotNo;
                  const marginPct = parseFloat(row.netMarginPct || 0);

                  return (
                    <div
                      key={row.lotNumber}
                      onClick={() => setSelectedLotNo(row.lotNumber)}
                      className={`p-3 text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{row.lotNumber}</span>
                        <span
                          className={`font-semibold font-mono text-[11px] ${
                            marginPct < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {marginPct.toFixed(1)}% Margin
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px] text-slate-500">
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">TOTAL COST</span>
                          <span className="font-mono font-medium text-slate-700">
                            {formatINR(row.totalLotCost)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">SOLD METERS</span>
                          <span className="font-mono font-medium text-slate-700">
                            {Number(row.soldMeters || 0).toLocaleString()} m
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9.5px]">SALES VALUE</span>
                          <span className="font-mono font-medium text-slate-700">
                            {formatINR(row.salesValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Lot Cost Ledger & Profitability (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {selectedLotNo ? (
            <>
              {/* Cost Breakdown Cards */}
              <div className="bg-white border border-[#dce5f4] rounded-xl p-4 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#dce5f4]">
                  <div>
                    <h3 className="font-bold text-base text-[#1F2E4A] font-mono flex items-center gap-2">
                      {selectedLotNo}
                      <span className="text-xs font-sans font-normal text-slate-500">
                        (Finished: {Number(lotDetail?.goodFinishedMeters || 0).toLocaleString()} m)
                      </span>
                    </h3>
                  </div>
                  <button
                    onClick={() => handleOpenAddEntry(selectedLotNo)}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Cost
                  </button>
                </div>

                {/* Breakdown Tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-2.5 bg-blue-50/50 rounded-lg border border-blue-100">
                    <span className="text-[10px] uppercase font-bold text-blue-700 block">Grey Purchase</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {formatINR(lotDetail?.breakdown?.grey_purchase || 0)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Processing</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {formatINR(lotDetail?.breakdown?.processing || 0)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-amber-50/50 rounded-lg border border-amber-100">
                    <span className="text-[10px] uppercase font-bold text-amber-700 block">Freight</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {formatINR(lotDetail?.breakdown?.purchase_freight || 0)}
                    </span>
                  </div>
                  <div className="p-2.5 bg-cyan-50/50 rounded-lg border border-cyan-100">
                    <span className="text-[10px] uppercase font-bold text-cyan-700 block">Transport</span>
                    <span className="font-mono font-bold text-slate-900 mt-0.5 block">
                      {formatINR(lotDetail?.breakdown?.processing_transport || 0)}
                    </span>
                  </div>
                </div>

                {/* Sales Realization & Margins Bar */}
                {selectedSummary && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                    <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                      Commercial Margin Breakdown
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Gross Sales:</span>
                        <span className="font-mono font-semibold text-slate-800">
                          {formatINR(selectedSummary.salesValue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Discounts:</span>
                        <span className="font-mono text-rose-600">
                          -{formatINR(selectedSummary.discounts || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Brokerage:</span>
                        <span className="font-mono text-rose-600">
                          -{formatINR(selectedSummary.brokerage || 0)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Net Contribution:</span>
                        <span
                          className={`font-mono font-bold ${
                            parseFloat(selectedSummary.netMarginPct || 0) < 0 ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {formatINR(selectedSummary.netContribution)} ({parseFloat(selectedSummary.netMarginPct || 0).toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Complete Cost Ledger Table */}
              <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 border-b border-[#dce5f4] flex items-center justify-between">
                  <span className="font-bold text-slate-700 text-xs uppercase tracking-wide">
                    Cost Ledger Postings ({lotDetail?.entries?.length || 0})
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Audited source document entries
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-[#dce5f4] text-slate-600 font-semibold uppercase text-[10.5px]">
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Cost Type</th>
                        <th className="py-2.5 px-3">Source Doc</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#dce5f4]">
                      {lotDetailLoading ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            Loading cost ledger…
                          </td>
                        </tr>
                      ) : !lotDetail?.entries || lotDetail.entries.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-400">
                            No individual cost postings recorded for this lot.
                          </td>
                        </tr>
                      ) : (
                        lotDetail.entries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                              {formatDate(entry.date)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  COST_TYPE_COLORS[entry.costType] || 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {COST_TYPE_LABELS[entry.costType] || entry.costType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              <span className="font-medium">{entry.sourceDocumentType}</span>
                              {entry.sourceDocumentNumber && (
                                <span className="block font-mono text-[10px] text-slate-400">
                                  #{entry.sourceDocumentNumber}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {entry.quantity ? `${Number(entry.quantity).toLocaleString()} m` : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {formatINR(entry.amount)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 max-w-[150px] truncate" title={entry.remarks}>
                              {entry.remarks || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-[#dce5f4] rounded-xl p-12 text-center text-slate-400 text-xs">
              Select a lot from the left list to view its landed cost breakdown and postings.
            </div>
          )}
        </div>
      </div>

      {/* POST COST ENTRY MODAL */}
      {showAddEntryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A]">Post Lot Cost Entry</h3>
              <button
                type="button"
                onClick={() => setShowAddEntryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {entryError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{entryError}</span>
              </div>
            )}

            <form onSubmit={handleEntrySubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Lot Number *</label>
                <input
                  type="text"
                  required
                  value={entryForm.lot_number}
                  onChange={(e) => setEntryForm({ ...entryForm, lot_number: e.target.value })}
                  placeholder="e.g. LOT-2026-001"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Cost Type *</label>
                  <select
                    value={entryForm.cost_type}
                    onChange={(e) => setEntryForm({ ...entryForm, cost_type: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  >
                    <option value="GREY_PURCHASE">Grey Fabric Purchase</option>
                    <option value="PURCHASE_FREIGHT">Inward Freight</option>
                    <option value="PROCESSING">Job Work Processing</option>
                    <option value="PROCESSING_TRANSPORT">Processing Transport</option>
                    <option value="PACKING">Packing & Finishing</option>
                    <option value="OTHER">Other Surcharge</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={entryForm.amount}
                    onChange={(e) => setEntryForm({ ...entryForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity (Meters)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={entryForm.quantity}
                    onChange={(e) => setEntryForm({ ...entryForm, quantity: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Source Doc Type</label>
                  <select
                    value={entryForm.source_document_type}
                    onChange={(e) => setEntryForm({ ...entryForm, source_document_type: e.target.value })}
                    className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                  >
                    <option value="PO">Purchase Order</option>
                    <option value="GRN">Goods Receipt Note</option>
                    <option value="JWO">Job Work Order</option>
                    <option value="BILL">Vendor Bill</option>
                    <option value="MANUAL">Manual Adjustment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Source Doc Number</label>
                <input
                  type="text"
                  value={entryForm.source_document_number}
                  onChange={(e) => setEntryForm({ ...entryForm, source_document_number: e.target.value })}
                  placeholder="e.g. JWO-2026-0042"
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={entryForm.remarks}
                  onChange={(e) => setEntryForm({ ...entryForm, remarks: e.target.value })}
                  placeholder="Notes / description..."
                  className="w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEntry}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submittingEntry ? 'Posting…' : 'Post Cost Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
