import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Calendar,
  Plus,
  RefreshCw,
  CheckCircle2,
  Trash2,
  Truck,
  Layers,
  Clock,
  AlertCircle,
  LayoutGrid,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import { loomService } from '../../../services/loomService';
import { formatNum, preventNegativeInput } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';

export default function YarnManagementPage() {
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);
  const [deleteBookingConfirmId, setDeleteBookingConfirmId] = useState(null);
  const [yarns, setYarns] = useState([]);
  const [factories, setFactories] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [stockOverview, setStockOverview] = useState([]);
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_yarn_tab') || 'actions'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_yarn_tab', tabId);
  };

  // Step 1: Book Yarn Form
  const [bkSupplier, setBkSupplier] = useState('');
  const [bkYarn, setBkYarn] = useState('');
  const [bkKgs, setBkKgs] = useState('');
  const [bkRate, setBkRate] = useState('');
  const [bkDate, setBkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bkNote, setBkNote] = useState('');

  // Step 2: Schedule Delivery Form
  const [schBooking, setSchBooking] = useState('');
  const [schFactory, setSchFactory] = useState('');
  const [schKgs, setSchKgs] = useState('');
  const [schRate, setSchRate] = useState('');
  const [schDue, setSchDue] = useState(() => new Date().toISOString().slice(0, 10));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [yRes, fRes, bRes] = await Promise.all([
        loomService.getYarns(),
        loomService.getFactories(),
        loomService.getYarnBookings(),
      ]);
      const yList = Array.isArray(yRes) ? yRes : yRes?.results || [];
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const bList = Array.isArray(bRes) ? bRes : bRes?.results || [];

      setYarns(yList);
      setFactories(fList);
      setBookings(bList);

      if (yList.length && !bkYarn) setBkYarn(yList[0].id);
      if (bList.length && !schBooking) setSchBooking(bList[0].id);
      if (fList.length && !schFactory) setSchFactory(fList[0].id);

      // Collect all deliveries and factory stock
      const allDels = [];
      bList.forEach((b) => {
        (b.deliveries || []).forEach((d) => allDels.push(d));
      });
      setDeliveries(allDels);

      // Load stock for all factories
      const stockArr = [];
      for (const f of fList) {
        const sRes = await loomService.getFactoryYarnStock(f.id);
        const sList = Array.isArray(sRes) ? sRes : sRes?.results || [];
        sList.forEach((item) => {
          stockArr.push({ factory_name: f.name, ...item });
        });
      }
      setStockOverview(stockArr);
    } catch (err) {
      console.error('Failed to load yarn management:', err);
    } finally {
      setLoading(false);
    }
  }, [bkYarn, schBooking, schFactory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Step 1: Book Yarn
  const handleAddBooking = async (e) => {
    e.preventDefault();
    if (!bkSupplier || !bkKgs || !bkRate) {
      showToast('Supplier, Kgs, and Rate are required', 'warning');
      return;
    }
    if (Number(bkKgs) <= 0 || Number(bkRate) < 0) {
      showToast('Kgs must be greater than 0 and rate cannot be negative', 'error');
      return;
    }
    try {
      await loomService.createYarnBooking({
        supplier: bkSupplier,
        yarn: bkYarn,
        kgs: Number(bkKgs),
        rate: Number(bkRate),
        date: bkDate,
        note: bkNote,
      });
      showToast('Yarn booking created successfully', 'success');
      setBkSupplier('');
      setBkKgs('');
      setBkRate('');
      setBkNote('');
      loadData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to book yarn', 'error');
    }
  };

  // Step 2: Schedule Delivery
  const handleAddDelivery = async (e) => {
    e.preventDefault();
    if (!schBooking || !schFactory || !schKgs) {
      showToast('Booking, Factory, and Kgs are required', 'warning');
      return;
    }
    if (Number(schKgs) <= 0 || (schRate && Number(schRate) < 0)) {
      showToast('Kgs to send must be greater than 0 and rate cannot be negative', 'error');
      return;
    }
    const b = bookings.find((x) => x.id === schBooking);
    if (!b) return;

    if (Number(schKgs) > Number(b.unscheduled_kgs)) {
      showToast(`Only ${formatNum(b.unscheduled_kgs)} kg available to schedule on this booking.`, 'warning');
      return;
    }

    try {
      await loomService.createYarnDelivery({
        booking: schBooking,
        factory: schFactory,
        kgs: Number(schKgs),
        rate: schRate ? Number(schRate) : Number(b.rate),
        due: schDue,
        status: 'Scheduled',
      });
      showToast('Delivery scheduled successfully', 'success');
      setSchKgs('');
      setSchRate('');
      loadData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to schedule delivery', 'error');
    }
  };

  // Step 3: Confirm Receipt
  const handleConfirmReceipt = async (delId, defaultKgs) => {
    const kgInput = document.getElementById(`recd_${delId}`);
    const dtInput = document.getElementById(`date_${delId}`);
    const recdKgs = kgInput ? Number(kgInput.value) : defaultKgs;
    const recdDate = dtInput ? dtInput.value : new Date().toISOString().slice(0, 10);

    if (recdKgs <= 0) {
      showToast('Please enter received kgs', 'warning');
      return;
    }
    try {
      await loomService.confirmYarnDelivery(delId, recdKgs, recdDate);
      showToast('Yarn receipt confirmed & factory stock updated!', 'success');
      loadData();
    } catch (err) {
      showToast(err?.payload?.detail || 'Failed to confirm receipt', 'error');
    }
  };

  const handleDeleteBooking = async (id) => {
    try {
      await loomService.deleteYarnBooking(id);
      showToast('Booking deleted successfully', 'success');
      loadData();
    } catch (err) {
      showToast('Cannot delete booking with active deliveries.', 'error');
    }
  };

  const pendingDeliveries = deliveries.filter((d) => d.status === 'Scheduled');
  const todayStr = new Date().toISOString().slice(0, 10);

  const tabs = [
    {
      id: 'actions',
      label: 'Book & Schedule',
      icon: Plus,
    },
    {
      id: 'receipt',
      label: 'Confirm Receipt',
      icon: CheckCircle2,
      badge: pendingDeliveries.length,
      badgeColor: pendingDeliveries.length > 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : undefined,
    },
    {
      id: 'bookings',
      label: 'Procurement Bookings',
      icon: Package,
      badge: bookings.length,
    },
    {
      id: 'stock',
      label: 'Live Factory Stock',
      icon: Layers,
      badge: stockOverview.filter((s) => s.recd > 0 || s.pending > 0 || s.warp > 0 || s.weft > 0).length,
    },
    {
      id: 'all',
      label: 'Show All',
      icon: LayoutGrid,
    },
  ];

  return (
    <div className="pms-screen w-full space-y-6">
      <PageHeader
        title="Yarn Procurement & Delivery Pipeline"
        subtitle="Manage the 3-step yarn supply chain: Book Yarn → Schedule Factory Delivery → Confirm Receipt at Factory."
        actions={
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="pms-btn-secondary"
          >
            <RefreshCw size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Screen Section Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl shadow-2xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                      tab.badgeColor ||
                      (isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                        : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300')
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <span>Active view: <b className="text-slate-700 dark:text-slate-300 font-semibold">{tabs.find((t) => t.id === activeTab)?.label}</b></span>
        </div>
      </div>

      {/* Section 1: 3 Step Action Grid (Booking & Delivery forms) */}
      {(activeTab === 'actions' || activeTab === 'all') && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Step 1: Book Yarn */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center">1</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Book Yarn Lot <span className="text-slate-400 font-normal text-xs">(CEO Sharad)</span>
            </h3>
          </div>
          <form onSubmit={handleAddBooking} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <label className="pms-label">Supplier</label>
              <input
                type="text"
                placeholder="e.g. Indospun Yarn"
                value={bkSupplier}
                onChange={(e) => setBkSupplier(e.target.value)}
                className="pms-input w-full"
                required
              />
            </div>
            <div>
              <label className="pms-label">Yarn</label>
              <select
                value={bkYarn}
                onChange={(e) => setBkYarn(e.target.value)}
                className="pms-select w-full cursor-pointer"
              >
                {yarns.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="pms-label">Total Kg</label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="10000"
                value={bkKgs}
                onChange={(e) => setBkKgs(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full font-mono"
                required
              />
            </div>
            <div>
              <label className="pms-label">Rate ₹/kg</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="210"
                value={bkRate}
                onChange={(e) => setBkRate(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full font-mono"
                required
              />
            </div>
            <div>
              <label className="pms-label">Booking Date</label>
              <input
                type="date"
                value={bkDate}
                onChange={(e) => setBkDate(e.target.value)}
                className="pms-input w-full"
              />
            </div>
            <div>
              <label className="pms-label">Note</label>
              <input
                type="text"
                placeholder="Optional notes"
                value={bkNote}
                onChange={(e) => setBkNote(e.target.value)}
                className="pms-input w-full"
              />
            </div>
            <div className="sm:col-span-2 pt-1">
              <button type="submit" className="pms-btn-blue w-full">
                <Plus size={16} /> Book Yarn
              </button>
            </div>
          </form>
        </div>

        {/* Step 2: Schedule Delivery */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3.5">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-xs font-bold flex items-center justify-center">2</span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Schedule Delivery to Factory <span className="text-slate-400 font-normal text-xs">(When supplier confirms lot)</span>
            </h3>
          </div>
          <form onSubmit={handleAddDelivery} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="pms-label">From Active Booking</label>
              <select
                value={schBooking}
                onChange={(e) => setSchBooking(e.target.value)}
                className="pms-select w-full cursor-pointer"
              >
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.supplier} — {b.yarn_name} ({formatNum(b.unscheduled_kgs)} kg left of {formatNum(b.kgs)} kg @ ₹{b.rate})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="pms-label">Target Factory</label>
              <select
                value={schFactory}
                onChange={(e) => setSchFactory(e.target.value)}
                className="pms-select w-full cursor-pointer"
              >
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="pms-label">Kg to Send</label>
              <input
                type="number"
                min="0.01"
                step="any"
                placeholder="5000"
                value={schKgs}
                onChange={(e) => setSchKgs(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full font-mono"
                required
              />
            </div>
            <div>
              <label className="pms-label">Rate ₹/kg (blank = booked)</label>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Rate"
                value={schRate}
                onChange={(e) => setSchRate(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full"
              />
            </div>
            <div>
              <label className="pms-label">Expected Due Date</label>
              <input
                type="date"
                value={schDue}
                onChange={(e) => setSchDue(e.target.value)}
                className="pms-input w-full"
              />
            </div>
            <div className="sm:col-span-2 pt-1">
              <button type="submit" className="pms-btn-emerald w-full">
                <Truck size={16} /> Schedule Delivery
              </button>
            </div>
          </form>
        </div>
      </div>
      )}

      {/* Section 2: Confirm Receipt at Factory (Coordinator) */}
      {(activeTab === 'receipt' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-sm space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-200 text-xs font-bold flex items-center justify-center">3</span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
            Confirm Receipt at Factory <span className="text-slate-400 font-normal text-xs">(Coordinator — the only manual stock entry)</span>
          </h3>
        </div>

        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-275px)] min-h-[360px]'}`}>
          <table className="w-full text-xs text-left pms-sticky-header">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Due Date</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Factory</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Yarn</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Supplier</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Scheduled kg</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Rate</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Received kg</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Received Date</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingDeliveries.map((d) => {
                const isLate = d.due < todayStr;
                return (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium">
                      {isLate ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          {d.due} (Overdue)
                        </span>
                      ) : (
                        d.due
                      )}
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-semibold text-slate-800 dark:text-slate-200">{d.factory_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">{d.yarn_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500">{d.supplier}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-medium">{formatNum(d.kgs)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">₹{d.rate}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        id={`recd_${d.id}`}
                        defaultValue={d.kgs}
                        onKeyDown={preventNegativeInput}
                        className="w-20 sm:w-24 h-8 px-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                      <input
                        type="date"
                        id={`date_${d.id}`}
                        defaultValue={todayStr}
                        className="h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                      />
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleConfirmReceipt(d.id, d.kgs)}
                        className="h-8 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer"
                      >
                        Confirm Receipt
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!pendingDeliveries.length && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    No pending yarn deliveries right now.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Section 3: Bookings Overview Table */}
      {(activeTab === 'bookings' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Yarn Procurement Bookings
          </h3>
        </div>
        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-275px)] min-h-[360px]'}`}>
          <table className="w-full text-xs text-left pms-sticky-header">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Supplier</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Yarn</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Date</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Booked kg</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Scheduled kg</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Not Scheduled</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Delivered</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Pending Arrival</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Rate</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-bold text-slate-800 dark:text-slate-200">{b.supplier}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium text-slate-700 dark:text-slate-300">{b.yarn_name}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-slate-500">{b.date}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-medium">{formatNum(b.kgs)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{formatNum(b.scheduled_kgs)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(b.unscheduled_kgs)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-emerald-600 font-medium">{formatNum(b.delivered_kgs)}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">
                    {b.pending_kgs > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {formatNum(b.pending_kgs)}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">₹{b.rate}</td>
                  <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center">
                    <button
                      onClick={() => setDeleteBookingConfirmId(b.id)}
                      className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                      title="Delete yarn booking"
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

      {/* Section 4: Stock by Factory (Auto calculated) */}
      {(activeTab === 'stock' || activeTab === 'all') && (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Automated Live Stock by Factory
          </h3>
        </div>
        <div className={`pms-table-container overflow-y-auto ${activeTab === 'all' ? 'max-h-[360px]' : 'max-h-[calc(100vh-275px)] min-h-[360px]'}`}>
          <table className="w-full text-xs text-left pms-sticky-header">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Factory</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3">Yarn</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Received (kg)</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Warp (Beams Made)</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Weft (Meters Woven)</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-bold">Balance kg</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Bags</th>
                <th className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right">Pending Arrival</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {stockOverview
                .filter((s) => s.recd > 0 || s.pending > 0 || s.warp > 0 || s.weft > 0)
                .map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-semibold text-slate-800 dark:text-slate-200">{s.factory_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 font-medium text-slate-700 dark:text-slate-300">{s.yarn_name}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">{formatNum(s.recd)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(s.warp, 1)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(s.weft, 1)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono font-bold">
                      <span className={s.bal < 0 ? 'text-rose-600 font-bold' : 'text-blue-600'}>
                        {formatNum(s.bal)}
                      </span>
                    </td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-slate-500">{formatNum(s.bags, 1)}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono text-amber-600">{formatNum(s.pending)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteBookingConfirmId)}
        onClose={() => setDeleteBookingConfirmId(null)}
        onConfirm={async () => {
          const id = deleteBookingConfirmId;
          setDeleteBookingConfirmId(null);
          await handleDeleteBooking(id);
        }}
        title="Delete Yarn Booking"
        message="Are you sure you want to delete this yarn booking? This cannot be undone."
        confirmText="Delete Booking"
        variant="danger"
      />
    </div>
  );
}
