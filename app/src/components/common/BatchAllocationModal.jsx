import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Layers,
  Package,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Search,
  RotateCcw,
  IndianRupee,
  MapPin,
  Calendar,
  Building2,
  Check,
} from 'lucide-react';
import { inventoryService } from '../../services/domainServices';

/**
 * Format quantity with 2-4 decimals, trimming trailing zeros.
 */
function formatNum(val) {
  const n = Number(val || 0);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

function formatCurrency(val) {
  const n = Number(val || 0);
  if (isNaN(n)) return '₹0.00';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * BatchAllocationModal
 *
 * Allows allocating sales order / invoice / challan line items across multiple
 * inventory batches (Lots) and rolls (Takas). Preserves distinct costing per batch
 * to ensure accurate P&L calculation and batch-wise stock reduction.
 */
export const BatchAllocationModal = ({
  isOpen,
  onClose,
  item = {},
  currentAllocations = [],
  onSave,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [takas, setTakas] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBatches, setExpandedBatches] = useState({});

  // Map of takaId/id -> allocated quantity (number)
  const [rollAllocations, setRollAllocations] = useState({});

  const requiredQty = Math.max(0, Number(item.qty || item.quantity || 0));
  const uom = item.uom || item.unit || 'Mtr';

  // Load available QC-passed takas for this item
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchLots = async () => {
      setLoading(true);
      setError('');
      try {
        const query = {
          available_only: 'true',
          qc_status: 'Passed',
        };
        if (item.itemId) {
          query.itemId = item.itemId;
        } else if (item.sku) {
          query.search = item.sku;
        } else if (item.name) {
          query.search = item.name;
        }

        const res = await inventoryService.getLotRegister(query);
        if (!isMounted) return;

        const records = Array.isArray(res) ? res : (res?.records || []);
        setTakas(records);

        // Initialize existing allocations
        const initial = {};
        if (Array.isArray(currentAllocations) && currentAllocations.length > 0) {
          currentAllocations.forEach((alloc) => {
            const id = alloc.lotTakaId || alloc.id;
            if (id) {
              initial[id] = Number(alloc.qty || 0);
            }
          });
        }
        setRollAllocations(initial);

        // Expand first 2 batches by default
        const batches = [...new Set(records.map((r) => r.lotNo || 'UNBATCHED'))];
        const initialExpanded = {};
        batches.slice(0, 2).forEach((b) => {
          initialExpanded[b] = true;
        });
        setExpandedBatches(initialExpanded);
      } catch (err) {
        if (!isMounted) return;
        console.error('Failed to load batch lots:', err);
        setError(err?.message || 'Could not load inventory batches for this item.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLots();
    return () => {
      isMounted = false;
    };
  }, [isOpen, item.itemId, item.sku, item.name, currentAllocations]);

  // Group takas by Batch (lotNo)
  const batches = useMemo(() => {
    const map = {};
    takas.forEach((taka) => {
      const lot = taka.lotNo || 'UNBATCHED';
      if (!map[lot]) {
        map[lot] = {
          lotNo: lot,
          rate: Number(taka.rate || 0),
          location: taka.location || 'Main Godown',
          locationId: taka.locationId,
          supplier: taka.supplier || '-',
          receivedDate: taka.receivedDate || '-',
          rawDate: taka.rawDate || taka.createdAt,
          totalAvailable: 0,
          rolls: [],
        };
      }
      map[lot].rolls.push(taka);
      map[lot].totalAvailable += Number(taka.availableQty || 0);
      if (Number(taka.rate || 0) > 0 && map[lot].rate === 0) {
        map[lot].rate = Number(taka.rate);
      }
    });

    return Object.values(map).sort((a, b) => {
      // Sort oldest first
      const dateA = a.rawDate ? new Date(a.rawDate) : 0;
      const dateB = b.rawDate ? new Date(b.rawDate) : 0;
      return dateA - dateB;
    });
  }, [takas]);

  // Filter batches & rolls by search query
  const filteredBatches = useMemo(() => {
    if (!searchQuery.trim()) return batches;
    const q = searchQuery.toLowerCase();
    return batches
      .map((batch) => {
        const batchMatches =
          batch.lotNo.toLowerCase().includes(q) ||
          batch.location.toLowerCase().includes(q) ||
          batch.supplier.toLowerCase().includes(q);

        const matchingRolls = batch.rolls.filter(
          (r) =>
            (r.takaId && r.takaId.toLowerCase().includes(q)) ||
            (r.takaRoll && String(r.takaRoll).toLowerCase().includes(q))
        );

        if (batchMatches) return batch;
        if (matchingRolls.length > 0) {
          return { ...batch, rolls: matchingRolls };
        }
        return null;
      })
      .filter(Boolean);
  }, [batches, searchQuery]);

  // Total allocated meters & real-time cost breakdown
  const summary = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    const batchSummaryMap = {};
    let rollCount = 0;

    Object.entries(rollAllocations).forEach(([takaId, qty]) => {
      const numQty = Number(qty || 0);
      if (numQty <= 0) return;

      const taka = takas.find((t) => t.id === takaId);
      if (!taka) return;

      totalQty += numQty;
      rollCount += 1;
      const rate = Number(taka.rate || 0);
      totalCost += numQty * rate;

      const lot = taka.lotNo || 'UNBATCHED';
      if (!batchSummaryMap[lot]) {
        batchSummaryMap[lot] = {
          batchCode: lot,
          qty: 0,
          rate: rate,
          rollsCount: 0,
        };
      }
      batchSummaryMap[lot].qty += numQty;
      batchSummaryMap[lot].rollsCount += 1;
    });

    const blendedCost = totalQty > 0 ? totalCost / totalQty : 0;
    const diff = totalQty - requiredQty;
    const isFull = Math.abs(diff) < 0.0001;
    const isShort = totalQty < requiredQty - 0.0001;
    const isOver = totalQty > requiredQty + 0.0001;

    return {
      totalQty,
      totalCost,
      blendedCost,
      rollCount,
      batchCount: Object.keys(batchSummaryMap).length,
      batches: Object.values(batchSummaryMap),
      diff,
      isFull,
      isShort,
      isOver,
    };
  }, [rollAllocations, takas, requiredQty]);

  // FIFO Auto Allocate
  const handleAutoAllocate = () => {
    let remainingToFill = requiredQty;
    const next = {};

    // Sort all rolls by batch rawDate, then roll index
    const allRolls = [];
    batches.forEach((b) => {
      b.rolls.forEach((r) => {
        allRolls.push({ ...r, batchDate: b.rawDate });
      });
    });

    allRolls.sort((a, b) => {
      const dateA = a.batchDate ? new Date(a.batchDate) : 0;
      const dateB = b.batchDate ? new Date(b.batchDate) : 0;
      if (dateA !== dateB) return dateA - dateB;
      return (Number(a.takaRoll) || 0) - (Number(b.takaRoll) || 0);
    });

    for (const roll of allRolls) {
      if (remainingToFill <= 0) break;
      const avail = Number(roll.availableQty || 0);
      if (avail <= 0) continue;

      const take = Math.min(avail, remainingToFill);
      next[roll.id] = Math.round(take * 10000) / 10000;
      remainingToFill -= take;
    }

    setRollAllocations(next);
  };

  // Clear all allocations
  const handleClearAll = () => {
    setRollAllocations({});
  };

  // Toggle batch expansion
  const toggleExpand = (lotNo) => {
    setExpandedBatches((prev) => ({
      ...prev,
      [lotNo]: !prev[lotNo],
    }));
  };

  // Update roll-level allocation
  const handleRollQtyChange = (roll, val) => {
    const rawVal = parseFloat(val);
    const maxAvail = Number(roll.availableQty || 0);
    const newQty = isNaN(rawVal) ? 0 : Math.max(0, Math.min(rawVal, maxAvail));

    setRollAllocations((prev) => {
      const next = { ...prev };
      if (newQty <= 0) {
        delete next[roll.id];
      } else {
        next[roll.id] = newQty;
      }
      return next;
    });
  };

  // Toggle entire roll (all or 0)
  const handleRollToggle = (roll) => {
    const current = rollAllocations[roll.id] || 0;
    const maxAvail = Number(roll.availableQty || 0);
    setRollAllocations((prev) => {
      const next = { ...prev };
      if (current > 0) {
        delete next[roll.id];
      } else {
        next[roll.id] = maxAvail;
      }
      return next;
    });
  };

  // Set quantity at Batch level (auto-distributes FIFO across batch's rolls)
  const handleBatchQtyChange = (batch, val) => {
    const targetQty = parseFloat(val);
    if (isNaN(targetQty) || targetQty <= 0) {
      // Clear this batch's rolls
      setRollAllocations((prev) => {
        const next = { ...prev };
        batch.rolls.forEach((r) => delete next[r.id]);
        return next;
      });
      return;
    }

    const capped = Math.min(targetQty, batch.totalAvailable);
    let rem = capped;
    const next = { ...rollAllocations };

    // Clear existing for this batch first
    batch.rolls.forEach((r) => delete next[r.id]);

    for (const roll of batch.rolls) {
      if (rem <= 0) break;
      const avail = Number(roll.availableQty || 0);
      const take = Math.min(avail, rem);
      next[roll.id] = Math.round(take * 10000) / 10000;
      rem -= take;
    }

    setRollAllocations(next);
  };

  // Allocate all available in batch
  const handlePickFullBatch = (batch) => {
    handleBatchQtyChange(batch, batch.totalAvailable);
  };

  // Apply allocation and save
  const handleApply = () => {
    const allocationsList = [];
    Object.entries(rollAllocations).forEach(([takaId, qty]) => {
      const numQty = Number(qty || 0);
      if (numQty <= 0) return;
      const taka = takas.find((t) => t.id === takaId);
      if (!taka) return;
      allocationsList.push({
        lotTakaId: taka.id,
        qty: numQty,
        takaId: taka.takaId || taka.barcode,
        lotNo: taka.lotNo,
        rollNo: taka.takaRoll,
        rate: Number(taka.rate || 0),
        locationId: taka.locationId,
      });
    });

    onSave(allocationsList, summary);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg">
                <Layers size={18} />
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                Multi-Batch &amp; Taka Allocation
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Select and allocate meters across individual QC-passed batches &amp; rolls.
              Independent landed costs are tracked per batch for accurate P&amp;L.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Item Target & Live Allocation Progress Bar */}
        <div className="px-5 py-3.5 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  {item.name || item.description || 'Fabric Item'}
                </span>
                {item.sku && (
                  <span className="font-mono text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded font-bold">
                    {item.sku}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                <span>
                  Order Target:{' '}
                  <strong className="text-slate-900 dark:text-slate-100 font-bold">
                    {formatNum(requiredQty)} {uom}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Allocated:{' '}
                  <strong
                    className={`font-bold ${
                      summary.isFull
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : summary.isOver
                        ? 'text-rose-700 dark:text-rose-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {formatNum(summary.totalQty)} {uom}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Batches:{' '}
                  <strong className="text-slate-900 dark:text-slate-100">
                    {summary.batchCount} ({summary.rollCount} Rolls)
                  </strong>
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {summary.isFull ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <CheckCircle2 size={13} /> 100% Matched
                </span>
              ) : summary.isOver ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                  <AlertCircle size={13} /> Over by {formatNum(Math.abs(summary.diff))} {uom}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  <AlertCircle size={13} /> Short by {formatNum(Math.abs(summary.diff))} {uom}
                </span>
              )}
            </div>
          </div>

          {/* Visual Progress Meter */}
          <div className="mt-2.5 w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                summary.isFull
                  ? 'bg-emerald-500'
                  : summary.isOver
                  ? 'bg-rose-500'
                  : 'bg-indigo-600'
              }`}
              style={{
                width: `${Math.min(
                  100,
                  requiredQty > 0 ? (summary.totalQty / requiredQty) * 100 : 0
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Toolbar: Search, FIFO Auto-Allocate, Clear */}
        <div className="p-3 sm:px-5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Filter by Batch Code, Roll #, Location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoAllocate}
              disabled={takas.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
              title="Automatically allocate oldest QC-passed rolls to reach target quantity"
            >
              <Sparkles size={13} />
              <span>⚡ Auto-Allocate (FIFO)</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              disabled={summary.totalQty === 0}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Batch List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-500 dark:text-slate-400 text-sm">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-3" />
              Loading available QC-passed batches &amp; rolls...
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <AlertCircle size={15} /> Error loading batches
              </div>
              {error}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-sm">
              <Package size={40} className="mx-auto mb-2 opacity-50" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No QC-passed stock available for this item.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Please ensure rolls have passed QC inspection in the Lot / Taka Register.
              </p>
            </div>
          ) : (
            filteredBatches.map((batch) => {
              // Sum allocated for this batch
              const batchAllocated = batch.rolls.reduce(
                (sum, r) => sum + (Number(rollAllocations[r.id]) || 0),
                0
              );
              const isExpanded = Boolean(expandedBatches[batch.lotNo]);
              const isFullyAllocated = batchAllocated >= batch.totalAvailable - 0.0001;

              return (
                <div
                  key={batch.lotNo}
                  className={`border rounded-xl transition duration-150 overflow-hidden ${
                    batchAllocated > 0
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/20 dark:bg-indigo-950/10'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Batch Card Header */}
                  <div className="p-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(batch.lotNo)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition cursor-pointer"
                        title={isExpanded ? 'Collapse rolls' : 'Expand rolls'}
                      >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            Batch: {batch.lotNo}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            QC Passed
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 inline-flex items-center gap-1">
                            <IndianRupee size={10} /> Cost: {formatCurrency(batch.rate)}/{uom}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={11} /> {batch.location}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Building2 size={11} /> {batch.supplier}
                          </span>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={11} /> {batch.receivedDate}
                          </span>
                          <span>•</span>
                          <span>
                            Available:{' '}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {formatNum(batch.totalAvailable)} {uom}
                            </strong>{' '}
                            ({batch.rolls.length} rolls)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Batch Allocation Input & Actions */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                          Allocate:
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={batch.totalAvailable}
                          placeholder="0.00"
                          value={batchAllocated > 0 ? batchAllocated : ''}
                          onChange={(e) => handleBatchQtyChange(batch, e.target.value)}
                          className="w-24 text-right text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-xs text-slate-500 font-medium">{uom}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePickFullBatch(batch)}
                        disabled={isFullyAllocated}
                        className="px-2 py-1 text-[11px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition disabled:opacity-40 cursor-pointer"
                        title="Pick all available quantity from this batch"
                      >
                        Pick All
                      </button>
                    </div>
                  </div>

                  {/* Expanded Individual Rolls Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider flex items-center justify-between">
                        <span>Individual Rolls in Batch {batch.lotNo}</span>
                        <span>{batch.rolls.length} Rolls Available</span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                              <th className="py-1.5 px-2 w-8">#</th>
                              <th className="py-1.5 px-2">Taka / Roll ID</th>
                              <th className="py-1.5 px-2">Roll #</th>
                              <th className="py-1.5 px-2 text-right">Available ({uom})</th>
                              <th className="py-1.5 px-2">Weight / Details</th>
                              <th className="py-1.5 px-2 text-right w-36">Allocated ({uom})</th>
                              <th className="py-1.5 px-2 text-center w-12">Select</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700/60">
                            {batch.rolls.map((roll, idx) => {
                              const rollAlloc = rollAllocations[roll.id] || 0;
                              const isAllocated = rollAlloc > 0;
                              const isFullRoll =
                                Math.abs(rollAlloc - Number(roll.availableQty || 0)) < 0.0001;

                              return (
                                <tr
                                  key={roll.id}
                                  className={`hover:bg-white dark:hover:bg-slate-800/60 transition ${
                                    isAllocated
                                      ? 'bg-indigo-50/60 dark:bg-indigo-950/30 font-medium'
                                      : ''
                                  }`}
                                >
                                  <td className="py-1.5 px-2 text-slate-400">{idx + 1}</td>
                                  <td className="py-1.5 px-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                                    {roll.takaId || roll.barcode || '-'}
                                  </td>
                                  <td className="py-1.5 px-2 text-slate-600 dark:text-slate-300">
                                    Roll {roll.takaRoll || idx + 1}
                                  </td>
                                  <td className="py-1.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                                    {formatNum(roll.availableQty)}
                                  </td>
                                  <td className="py-1.5 px-2 text-slate-500 text-[11px]">
                                    {roll.rollWeight ? `${roll.rollWeight} kg` : ''}
                                    {roll.shade ? ` • Shade: ${roll.shade}` : ''}
                                    {roll.quality ? ` • ${roll.quality}` : ''}
                                  </td>
                                  <td className="py-1.5 px-2 text-right">
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={roll.availableQty}
                                      value={rollAlloc > 0 ? rollAlloc : ''}
                                      onChange={(e) => handleRollQtyChange(roll, e.target.value)}
                                      placeholder="0.00"
                                      className="w-24 text-right text-xs font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                                    />
                                  </td>
                                  <td className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRollToggle(roll)}
                                      className={`w-5 h-5 rounded border flex items-center justify-center transition cursor-pointer ${
                                        isFullRoll
                                          ? 'bg-indigo-600 border-indigo-600 text-white'
                                          : isAllocated
                                          ? 'bg-indigo-100 border-indigo-500 text-indigo-700'
                                          : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400'
                                      }`}
                                      title={isFullRoll ? 'Unselect roll' : 'Select full roll'}
                                    >
                                      {isAllocated && <Check size={12} strokeWidth={3} />}
                                    </button>
                                  </td>
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
            })
          )}
        </div>

        {/* Footer: Summary & Action Buttons */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Total Allocated
              </span>
              <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatNum(summary.totalQty)} {uom}
              </strong>
            </div>

            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Batches Selected
              </span>
              <strong className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {summary.batchCount} ({summary.rollCount} Rolls)
              </strong>
            </div>

            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Blended Landed Cost
              </span>
              <strong className="text-sm font-bold text-indigo-700 dark:text-indigo-400 tabular-nums">
                {formatCurrency(summary.blendedCost)}/{uom}
              </strong>
            </div>

            <div className="border-l border-slate-200 dark:border-slate-700 pl-4">
              <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                Total Realized Cost
              </span>
              <strong className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {formatCurrency(summary.totalCost)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={summary.totalQty === 0}
              className="px-5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              <span>Apply Allocation ({formatNum(summary.totalQty)} {uom})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchAllocationModal;
