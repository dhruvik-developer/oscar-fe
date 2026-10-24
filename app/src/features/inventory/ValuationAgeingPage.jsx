import React, { useState, useEffect } from 'react';
import { useERP } from '../../context/ERPContext';
import { DataTable } from '../../components/ui/DataTable';
import { StatCard } from '../../components/ui/StatCard';
import { DollarSign, Clock, AlertTriangle, Layers, Calendar, Package, ArrowRight } from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { api } from '../../services/api';
import { inventoryService } from '../../services/domainServices';

// Must match the backend's STOCK_AGE_BUCKETS (apps/inventory/views.py).
const BUCKETS = ['0-30', '31-60', '61-90', '91-180', '180+'];

const BUCKET_STYLE = {
  '0-30': 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  '31-60': 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  '61-90': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  '91-180': 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
  '180+': 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
};

export const ValuationAgeingPage = () => {
  const { formatCurrency } = useERP();
  const [activeTab, setActiveTab] = useState('valuation'); // 'valuation' | 'ageing' | 'slow_moving'

  // Tab 1: Valuation State
  const [selectedBucket, setSelectedBucket] = useState('All');
  const [loadingValuation, setLoadingValuation] = useState(true);
  const [valuationError, setValuationError] = useState(null);
  const [rows, setRows] = useState([]);
  const [aggs, setAggs] = useState(null);

  // Tab 2: Stock Ageing Analysis State
  const [ageingData, setAgeingData] = useState(null);
  const [loadingAgeing, setLoadingAgeing] = useState(false);
  const [ageingError, setAgeingError] = useState(null);

  // Tab 3: Slow-Moving Stock State
  const [slowMovingRows, setSlowMovingRows] = useState([]);
  const [slowMovingThreshold, setSlowMovingThreshold] = useState(60);
  const [loadingSlowMoving, setLoadingSlowMoving] = useState(false);
  const [slowMovingError, setSlowMovingError] = useState(null);

  // Load Valuation Data
  useEffect(() => {
    let active = true;
    setLoadingValuation(true);
    setValuationError(null);
    api.get('/inventory/valuation/')
      .then((res) => {
        if (!active) return;
        setRows(Array.isArray(res?.results) ? res.results : []);
        setAggs(res?.aggregates || null);
      })
      .catch((err) => {
        if (!active) return;
        setRows([]);
        setAggs(null);
        setValuationError(err?.message || 'Could not load valuation.');
      })
      .finally(() => {
        if (active) setLoadingValuation(false);
      });
    return () => { active = false; };
  }, []);

  // Load Ageing Data
  const loadAgeingData = () => {
    setLoadingAgeing(true);
    setAgeingError(null);
    inventoryService.getStockAgeing()
      .then((res) => {
        setAgeingData(res?.data || res);
      })
      .catch((err) => {
        setAgeingError(err?.response?.data?.message || err?.message || 'Failed to load stock ageing.');
      })
      .finally(() => setLoadingAgeing(false));
  };

  // Load Slow-Moving Data
  const loadSlowMovingData = (threshold) => {
    setLoadingSlowMoving(true);
    setSlowMovingError(null);
    inventoryService.getSlowMovingStock({ thresholdDays: threshold })
      .then((res) => {
        const data = res?.data || res;
        setSlowMovingRows(Array.isArray(data?.results) ? data.results : Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        setSlowMovingError(err?.response?.data?.message || err?.message || 'Failed to load slow-moving stock.');
      })
      .finally(() => setLoadingSlowMoving(false));
  };

  useEffect(() => {
    if (activeTab === 'ageing' && !ageingData) {
      loadAgeingData();
    } else if (activeTab === 'slow_moving') {
      loadSlowMovingData(slowMovingThreshold);
    }
  }, [activeTab, slowMovingThreshold]);

  const bucketValue = (label) => Number(aggs?.buckets?.find((b) => b.bucket === label)?.value || 0);
  const filteredData = selectedBucket === 'All' ? rows : rows.filter((r) => r.agingBucket === selectedBucket);

  const columnsValuation = [
    {
      key: 'sku',
      header: 'SKU Code',
      width: '12%',
      render: (r) => <span className="font-mono font-bold text-primary whitespace-nowrap">{r.sku}</span>,
    },
    {
      key: 'name',
      header: 'Item / Lot',
      width: '24%',
      render: (r) => (
        <div>
          <p className="font-bold text-text">{r.name}</p>
          <span className="text-[10px] text-muted">
            {[r.category, r.lotNo, r.takaId].filter(Boolean).join(' · ') || '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      width: '12%',
      render: (r) => <span className="text-xs text-text-secondary">{r.location || '—'}</span>,
    },
    {
      key: 'qty',
      header: 'Holding Qty',
      align: 'center',
      width: '10%',
      render: (r) => (
        <span className="font-mono font-semibold text-text whitespace-nowrap">
          {Number(r.qty).toLocaleString('en-IN')} {r.uom || ''}
        </span>
      ),
    },
    {
      key: 'unitCost',
      header: 'Unit Cost (WAC)',
      align: 'right',
      width: '11%',
      render: (r) => <span className="font-mono text-muted whitespace-nowrap">{formatCurrency(r.unitCost)}</span>,
    },
    {
      key: 'value',
      header: 'Carrying Value',
      align: 'right',
      width: '12%',
      render: (r) => <span className="font-mono font-bold text-text whitespace-nowrap">{formatCurrency(r.value)}</span>,
    },
    {
      key: 'ageDays',
      header: 'Age',
      align: 'center',
      width: '9%',
      render: (r) => (
        <span className="font-mono text-text text-xs whitespace-nowrap">
          {r.ageDays === null || r.ageDays === undefined ? '—' : `${r.ageDays} days`}
        </span>
      ),
    },
    {
      key: 'agingBucket',
      header: 'Ageing Bucket',
      align: 'center',
      width: '10%',
      render: (r) => (r.agingBucket ? (
        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${BUCKET_STYLE[r.agingBucket] || ''}`}>
          {r.agingBucket} days
        </span>
      ) : <span className="text-xs text-muted">No inward date</span>),
    },
  ];

  const columnsSlowMoving = [
    {
      key: 'barcode',
      header: 'Taka / Barcode',
      width: '15%',
      render: (r) => (
        <div>
          <span className="font-mono font-bold text-blue-600 block">{r.barcode || r.taka_no || r.id}</span>
          <span className="text-[10px] text-slate-400 font-mono">Lot: {r.lot_number || r.lotNo || '—'}</span>
        </div>
      ),
    },
    {
      key: 'item',
      header: 'Item / Fabric',
      width: '25%',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-800">{r.item_name || r.item?.name || r.name || '—'}</p>
          <span className="text-[10px] text-slate-400">{r.quality || r.item?.fabric_quality || '—'}</span>
        </div>
      ),
    },
    {
      key: 'receivedDate',
      header: 'Inward Date',
      width: '12%',
      render: (r) => <span className="text-xs text-slate-600">{r.received_date || r.receivedDate || '—'}</span>,
    },
    {
      key: 'age',
      header: 'Holding Age',
      align: 'center',
      width: '12%',
      render: (r) => (
        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          {r.age || r.ageDays || 0} days
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Godown / Rack',
      width: '14%',
      render: (r) => <span className="text-xs text-slate-600">{r.location_name || r.location?.name || '—'}</span>,
    },
    {
      key: 'qty',
      header: 'Available Qty',
      align: 'right',
      width: '11%',
      render: (r) => (
        <span className="font-mono font-semibold text-slate-800">
          {Number(r.available_quantity || r.qty || 0).toLocaleString()} m
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Blocked Value',
      align: 'right',
      width: '11%',
      render: (r) => {
        const qty = parseFloat(r.available_quantity || r.qty || 0);
        const rate = parseFloat(r.rate || 0);
        const val = r.value !== undefined ? r.value : qty * rate;
        return <span className="font-mono font-bold text-rose-700">{formatCurrency(val)}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Valuation & Stock Ageing"
        subtitle="Weighted-average inventory valuation, holding age breakdown across buckets, and slow-moving stock identification."
      />

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-[#CED4DA] gap-1 text-xs">
        <button
          onClick={() => setActiveTab('valuation')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'valuation'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Valuation Overview
        </button>
        <button
          onClick={() => setActiveTab('ageing')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'ageing'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Stock Ageing Analysis
        </button>
        <button
          onClick={() => setActiveTab('slow_moving')}
          className={`px-4 py-2.5 font-bold transition-all border-b-2 cursor-pointer ${
            activeTab === 'slow_moving'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          Slow-Moving Stock
        </button>
      </div>

      {/* TAB 1: VALUATION OVERVIEW */}
      {activeTab === 'valuation' && (
        <div className="space-y-6">
          {valuationError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{valuationError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Inventory Value" value={loadingValuation ? '…' : formatCurrency(aggs?.totalValuation || 0, { noDecimals: true })} icon={DollarSign}/>
            <StatCard label="0-30 Days" value={loadingValuation ? '…' : formatCurrency(bucketValue('0-30'), { noDecimals: true })}/>
            <StatCard label="31-90 Days" value={loadingValuation ? '…' : formatCurrency(bucketValue('31-60') + bucketValue('61-90'), { noDecimals: true })}/>
            <StatCard label="Over 90 Days" value={loadingValuation ? '…' : formatCurrency(aggs?.staleValuation || 0, { noDecimals: true })}/>
          </div>

          <div className="flex flex-nowrap items-center gap-2 border-b border-[#CED4DA] pb-2 text-xs overflow-x-auto lg:overflow-visible whitespace-nowrap lg:whitespace-normal scrollbar-none">
            <span className="shrink-0 lg:shrink text-slate-500 font-semibold">Ageing Bucket:</span>
            {['All', ...BUCKETS].map((b) => (
              <button
                key={b}
                onClick={() => setSelectedBucket(b)}
                className={`shrink-0 lg:shrink px-3 py-1 rounded-full font-medium transition cursor-pointer ${
                  selectedBucket === b
                    ? 'bg-[#1F2E4A] text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {b === 'All' ? 'All' : `${b} days`}
              </button>
            ))}
          </div>

          {loadingValuation ? (
            <div className="bg-white border border-[#dce5f4] rounded-xl p-8 text-center text-sm text-slate-500">Loading valuation…</div>
          ) : (
            <DataTable
              title="Inventory Ageing Valuation"
              columns={columnsValuation}
              data={filteredData}
              keyExtractor={(r) => r.id}
              searchPlaceholder="Filter SKU, item, lot or location..."
              searchFilter={(r, term) =>
                String(r.sku ?? '').toLowerCase().includes(term) ||
                String(r.name ?? '').toLowerCase().includes(term) ||
                String(r.lotNo ?? '').toLowerCase().includes(term) ||
                String(r.location ?? '').toLowerCase().includes(term)
              }
            />
          )}
        </div>
      )}

      {/* TAB 2: STOCK AGEING ANALYSIS */}
      {activeTab === 'ageing' && (
        <div className="space-y-6">
          {ageingError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{ageingError}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Stock Holding"
              value={loadingAgeing ? '…' : `${Number(ageingData?.summary?.totalQty || 0).toLocaleString()} meters`}
              icon={Package}
            />
            <StatCard
              label="Total Carrying Value"
              value={loadingAgeing ? '…' : formatCurrency(ageingData?.summary?.totalValue || 0)}
              icon={DollarSign}
              tone="blue"
            />
            <StatCard
              label="Total Rolls / Takas"
              value={loadingAgeing ? '…' : Number(ageingData?.summary?.totalTakas || 0).toLocaleString()}
              icon={Layers}
              tone="emerald"
            />
          </div>

          {/* Ageing Bucket Distribution Cards */}
          <div className="bg-white border border-[#dce5f4] rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
              Holding Age Distribution Buckets
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              {(ageingData?.buckets || []).map((b) => (
                <div key={b.key} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <span className="font-bold text-slate-700 text-xs block">{b.label}</span>
                  <p className="font-mono font-bold text-sm text-slate-900">{formatCurrency(b.value)}</p>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{Number(b.qty).toLocaleString()} m</span>
                    <span>{b.takaCount} takas</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${b.pct || 0}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400 block text-right font-mono">{b.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Quality Breakdown Table */}
          {ageingData?.byQuality && ageingData.byQuality.length > 0 && (
            <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
              <div className="p-4 bg-slate-50 border-b border-[#dce5f4]">
                <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Holding Distribution by Fabric Quality
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10.5px] border-b border-[#dce5f4]">
                      <th className="py-2.5 px-4">Fabric Quality</th>
                      <th className="py-2.5 px-4 text-center">Takas / Rolls</th>
                      <th className="py-2.5 px-4 text-right">Available Meters</th>
                      <th className="py-2.5 px-4 text-right">Holding Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#dce5f4]">
                    {ageingData.byQuality.map((q) => (
                      <tr key={q.quality} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{q.quality}</td>
                        <td className="py-2.5 px-4 text-center font-mono text-slate-600">{q.takas}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium text-slate-700">
                          {Number(q.qty).toLocaleString()} m
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(q.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SLOW-MOVING STOCK */}
      {activeTab === 'slow_moving' && (
        <div className="space-y-6">
          {slowMovingError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm">{slowMovingError}</div>
          )}

          {/* Filter Bar */}
          <div className="bg-white border border-[#dce5f4] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">Holding Age Threshold:</span>
              {[30, 60, 90, 180, 365].map((days) => (
                <button
                  key={days}
                  onClick={() => setSlowMovingThreshold(days)}
                  className={`px-3 py-1 rounded-full font-semibold transition cursor-pointer ${
                    slowMovingThreshold === days
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  &ge; {days} Days
                </button>
              ))}
            </div>

            <span className="font-mono text-slate-400">
              {slowMovingRows.length} stale roll{slowMovingRows.length === 1 ? '' : 's'} identified
            </span>
          </div>

          {/* Slow-Moving DataTable */}
          <DataTable
            title={`Slow-Moving Takas (${slowMovingThreshold}+ Days with Zero Movements)`}
            columns={columnsSlowMoving}
            data={slowMovingRows}
            keyExtractor={(r) => r.id}
            searchPlaceholder="Filter barcode, item, lot, or location..."
            searchFilter={(r, term) =>
              String(r.barcode ?? '').toLowerCase().includes(term) ||
              String(r.lot_number ?? '').toLowerCase().includes(term) ||
              String(r.item_name ?? '').toLowerCase().includes(term) ||
              String(r.location_name ?? '').toLowerCase().includes(term)
            }
          />
        </div>
      )}
    </div>
  );
};
