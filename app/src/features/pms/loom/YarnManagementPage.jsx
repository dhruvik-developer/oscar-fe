import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Building2,
  ExternalLink,
  Pencil,
  X,
  ArrowUpRight,
} from 'lucide-react';
import PageHeader from '../../../components/ui/PageHeader';
import { Button } from '../../../components/ui/Button';
import TablePagination from '../../../components/ui/TablePagination';
import { loomService } from '../../../services/loomService';
import { partiesService } from '../../../services/domainServices';
import { formatNum, preventNegativeInput } from '../utils/loomCalculations';
import { useERP } from '../../../context/ERPContext';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { Modal } from '../../../components/ui/Modal';

export default function YarnManagementPage() {
  const { showToast } = useERP();
  const [loading, setLoading] = useState(true);

  // Data states
  const [yarns, setYarns] = useState([]);
  const [factories, setFactories] = useState([]);
  const [parties, setParties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [stockOverview, setStockOverview] = useState([]);

  // Active view tab
  const [activeTab, setActiveTab] = useState(
    () => localStorage.getItem('oscar_pms_yarn_tab') || 'actions'
  );

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('oscar_pms_yarn_tab', tabId);
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Step 1: Book Yarn Form
  const [bkSupplier, setBkSupplier] = useState('');
  const [bkSupplierParty, setBkSupplierParty] = useState('');
  const [bkYarn, setBkYarn] = useState('');
  const [bkKgs, setBkKgs] = useState('');
  const [bkRate, setBkRate] = useState('');
  const [bkDate, setBkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bkNote, setBkNote] = useState('');
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Step 2: Schedule Delivery Form
  const [schBooking, setSchBooking] = useState('');
  const [schFactory, setSchFactory] = useState('');
  const [schKgs, setSchKgs] = useState('');
  const [schRate, setSchRate] = useState('');
  const [schDue, setSchDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [autoIncreaseBooking, setAutoIncreaseBooking] = useState(true);
  const [isSubmittingDelivery, setIsSubmittingDelivery] = useState(false);

  // Controlled inputs for Step 3: Confirm Receipt
  const [receiptInputs, setReceiptInputs] = useState({});
  const [confirmingReceiptId, setConfirmingReceiptId] = useState(null);

  // Modals state
  const [editBooking, setEditBooking] = useState(null);
  const [editBookingKgs, setEditBookingKgs] = useState('');
  const [editBookingRate, setEditBookingRate] = useState('');
  const [editBookingDate, setEditBookingDate] = useState('');
  const [editBookingNote, setEditBookingNote] = useState('');
  const [editBookingSaving, setEditBookingSaving] = useState(false);

  const [editDelivery, setEditDelivery] = useState(null);
  const [editDeliveryKgs, setEditDeliveryKgs] = useState('');
  const [editDeliveryRate, setEditDeliveryRate] = useState('');
  const [editDeliveryFactory, setEditDeliveryFactory] = useState('');
  const [editDeliveryDue, setEditDeliveryDue] = useState('');
  const [editDeliveryAutoIncrease, setEditDeliveryAutoIncrease] = useState(true);
  const [editDeliverySaving, setEditDeliverySaving] = useState(false);

  const [deleteBookingConfirmId, setDeleteBookingConfirmId] = useState(null);
  const [deleteDeliveryConfirmId, setDeleteDeliveryConfirmId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [yRes, fRes, bRes, pRes] = await Promise.all([
        loomService.getYarns(),
        loomService.getFactories(),
        loomService.getYarnBookings(),
        partiesService.getParties({ type: 'Vendor' }).catch(() => partiesService.getParties().catch(() => [])),
      ]);
      const yList = Array.isArray(yRes) ? yRes : yRes?.results || [];
      const fList = Array.isArray(fRes) ? fRes : fRes?.results || [];
      const bList = Array.isArray(bRes) ? bRes : bRes?.results || [];
      const pList = Array.isArray(pRes) ? pRes : pRes?.results || [];

      setYarns(yList);
      setFactories(fList);
      setBookings(bList);
      setParties(pList);

      if (yList.length) setBkYarn((prev) => prev || yList[0].id);
      if (bList.length) setSchBooking((prev) => prev || bList[0].id);
      if (fList.length) setSchFactory((prev) => prev || fList[0].id);

      // Collect all deliveries
      const allDels = [];
      bList.forEach((b) => {
        (b.deliveries || []).forEach((d) => allDels.push(d));
      });
      setDeliveries(allDels);

      // Initialize receipt inputs with existing delivery kgs & date
      setReceiptInputs((prev) => {
        const next = { ...prev };
        allDels.forEach((d) => {
          if (!next[d.id]) {
            next[d.id] = { kgs: d.kgs, date: todayStr };
          }
        });
        return next;
      });

      // Load stock for all factories
      const stockArr = [];
      for (const f of fList) {
        const sRes = await loomService.getFactoryYarnStock(f.id);
        const sList = Array.isArray(sRes) ? sRes : sRes?.results || [];
        sList.forEach((item) => {
          stockArr.push({ factory_name: f.name, ...item });
        });
        return next;
      });

      // Load stock for all factories in parallel
      const stockResults = await Promise.all(
        fList.map(async (f) => {
          try {
            const sRes = await loomService.getFactoryYarnStock(f.id);
            const sList = Array.isArray(sRes) ? sRes : sRes?.results || [];
            return sList.map((item) => ({ factory_name: f.name, ...item }));
          } catch (stockErr) {
            console.error(`Failed to load stock for factory ${f.id}:`, stockErr);
            return [];
          }
        })
      );
      setStockOverview(stockResults.flat());
    } catch (err) {
      console.error('Failed to load yarn management:', err);
    } finally {
      setLoading(false);
    }
  }, [bkYarn, schBooking, schFactory, todayStr]);

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
    const numKgs = Number(bkKgs);
    const numRate = Number(bkRate);
    if (numKgs <= 0 || numRate < 0) {
      showToast('Kgs must be greater than 0 and rate cannot be negative', 'error');
      return;
    }

    setIsSubmittingBooking(true);
    try {
      await loomService.createYarnBooking({
        supplier: bkSupplier,
        supplier_party: bkSupplierParty || null,
        yarn: bkYarn,
        kgs: numKgs,
        rate: numRate,
        date: bkDate,
        note: bkNote,
      });
      showToast('Yarn booking created successfully', 'success');
      setBkSupplier('');
      setBkSupplierParty('');
      setBkKgs('');
      setBkRate('');
      setBkNote('');
      loadData();
    } catch (err) {
      const msg = err?.payload?.detail || err?.payload?.kgs?.[0] || err?.message || 'Failed to book yarn';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Step 2: Schedule Delivery
  const selectedBooking = useMemo(
    () => bookings.find((x) => x.id === schBooking),
    [bookings, schBooking]
  );

  const schShortage = useMemo(() => {
    if (!selectedBooking || !schKgs) return 0;
    const num = Number(schKgs);
    const avail = Number(selectedBooking.unscheduled_kgs || 0);
    return num > avail ? num - avail : 0;
  }, [selectedBooking, schKgs]);

  const handleAddDelivery = async (e) => {
    e.preventDefault();
    if (!schBooking || !schFactory || !schKgs) {
      showToast('Booking, Factory, and Kgs are required', 'warning');
      return;
    }
    const numKgs = Number(schKgs);
    if (numKgs <= 0 || (schRate && Number(schRate) < 0)) {
      showToast('Kgs to send must be greater than 0 and rate cannot be negative', 'error');
      return;
    }
    const b = bookings.find((x) => x.id === schBooking);
    if (!b) {
      showToast('Selected booking not found', 'warning');
      return;
    }

    const avail = Number(b.unscheduled_kgs || 0);
    const shortage = numKgs > avail ? numKgs - avail : 0;

    if (shortage > 0 && !autoIncreaseBooking) {
      showToast(
        `Only ${formatNum(avail)} kg available to schedule on this booking. Check "Auto-increase booking total" to expand quantity.`,
        'warning'
      );
      return;
    }

    setIsSubmittingDelivery(true);
    try {
      // Auto-increase booking if requested quantity exceeds remaining unscheduled kg
      if (shortage > 0) {
        const newTotal = Number(b.kgs) + shortage;
        await loomService.updateYarnBooking(b.id, { kgs: newTotal });
      }

      await loomService.createYarnDelivery({
        booking: schBooking,
        factory: schFactory,
        kgs: numKgs,
        rate: schRate ? Number(schRate) : Number(b.rate),
        due: schDue,
        status: 'Scheduled',
      });

      if (shortage > 0) {
        showToast(
          `Booking increased by ${formatNum(shortage)} kg (New Total: ${formatNum(Number(b.kgs) + shortage)} kg) & delivery scheduled successfully!`,
          'success'
        );
      } else {
        showToast('Delivery scheduled successfully', 'success');
      }
      setSchKgs('');
      setSchRate('');
      loadData();
    } catch (err) {
      const msg = err?.payload?.detail || err?.payload?.kgs?.[0] || err?.message || 'Failed to schedule delivery';
      showToast(msg, 'error');
    } finally {
      setIsSubmittingDelivery(false);
    }
  };

  // Step 3: Controlled input handler & Confirm Receipt
  const handleReceiptChange = (delId, field, val) => {
    setReceiptInputs((prev) => ({
      ...prev,
      [delId]: {
        ...(prev[delId] || {}),
        [field]: val,
      },
    }));
  };

  const handleConfirmReceipt = async (delId) => {
    const d = deliveries.find((x) => x.id === delId);
    const state = receiptInputs[delId];
    const recdKgs = state?.kgs !== undefined && state.kgs !== '' ? Number(state.kgs) : Number(d?.kgs || 0);
    const recdDate = state?.date || todayStr;

    if (recdKgs <= 0) {
      showToast('Please enter received kgs greater than 0', 'warning');
      return;
    }

    setConfirmingReceiptId(delId);
    try {
      await loomService.confirmYarnDelivery(delId, recdKgs, recdDate);
      showToast('Yarn receipt confirmed & factory stock updated!', 'success');
      loadData();
    } catch (err) {
      const msg =
        err?.payload?.detail ||
        err?.payload?.recd_kgs?.[0] ||
        err?.payload?.non_field_errors?.[0] ||
        err?.message ||
        'Failed to confirm receipt';
      showToast(msg, 'error');
    } finally {
      setConfirmingReceiptId(null);
    }
  };

  // Edit Booking Modal logic
  const openEditBookingModal = (b) => {
    setEditBooking(b);
    setEditBookingKgs(b.kgs);
    setEditBookingRate(b.rate);
    setEditBookingDate(b.date || todayStr);
    setEditBookingNote(b.note || '');
  };

  const addQuickKg = (amount) => {
    setEditBookingKgs((prev) => {
      const val = Number(prev) || 0;
      return (val + amount).toString();
    });
  };

  const handleUpdateBooking = async (e) => {
    if (e) e.preventDefault();
    if (!editBooking) return;
    const numKgs = Number(editBookingKgs);
    const numRate = Number(editBookingRate);

    if (numKgs <= 0 || numRate < 0) {
      showToast('Quantity must be greater than 0 and rate cannot be negative', 'warning');
      return;
    }

    if (numKgs < Number(editBooking.scheduled_kgs || 0)) {
      showToast(
        `Cannot reduce total booked kg below already scheduled deliveries (${formatNum(editBooking.scheduled_kgs)} kg).`,
        'warning'
      );
      return;
    }

    setEditBookingSaving(true);
    try {
      await loomService.updateYarnBooking(editBooking.id, {
        kgs: numKgs,
        rate: numRate,
        date: editBookingDate,
        note: editBookingNote,
      });
      showToast('Yarn booking updated successfully!', 'success');
      setEditBooking(null);
      loadData();
    } catch (err) {
      const msg = err?.payload?.detail || err?.payload?.kgs?.[0] || err?.message || 'Failed to update booking';
      showToast(msg, 'error');
    } finally {
      setEditBookingSaving(false);
    }
  };

  // Delete Booking
  const handleDeleteBooking = async (id) => {
    try {
      await loomService.deleteYarnBooking(id);
      showToast('Booking deleted successfully', 'success');
      loadData();
    } catch (err) {
      const msg =
        err?.payload?.detail ||
        err?.payload?.message ||
        err?.message ||
        'Cannot delete booking with active deliveries.';
      showToast(msg, 'error');
    }
  };

  // Edit Delivery Modal logic
  const openEditDeliveryModal = (d) => {
    setEditDelivery(d);
    setEditDeliveryKgs(d.kgs);
    setEditDeliveryRate(d.rate);
    setEditDeliveryFactory(d.factory);
    setEditDeliveryDue(d.due);
    setEditDeliveryAutoIncrease(true);
  };

  const handleUpdateDelivery = async (e) => {
    if (e) e.preventDefault();
    if (!editDelivery) return;
    const numKgs = Number(editDeliveryKgs);
    const numRate = Number(editDeliveryRate);

    if (numKgs <= 0 || numRate < 0) {
      showToast('Quantity must be greater than 0 and rate cannot be negative', 'warning');
      return;
    }

    // Check if new delivery kgs exceeds available booking unscheduled kg
    const parentBooking = bookings.find((b) => b.id === editDelivery.booking);
    const diff = numKgs - Number(editDelivery.kgs);
    const avail = parentBooking ? Number(parentBooking.unscheduled_kgs || 0) : 0;

    if (diff > avail && !editDeliveryAutoIncrease) {
      showToast(
        `Increasing delivery by ${formatNum(diff)} kg exceeds remaining unscheduled kg (${formatNum(avail)} kg). Check auto-expand to increase booking.`,
        'warning'
      );
      return;
    }

    setEditDeliverySaving(true);
    try {
      // Auto-expand booking if needed
      if (diff > avail && parentBooking) {
        const shortage = diff - avail;
        const newTotal = Number(parentBooking.kgs) + shortage;
        await loomService.updateYarnBooking(parentBooking.id, { kgs: newTotal });
      }

      await loomService.updateYarnDelivery(editDelivery.id, {
        kgs: numKgs,
        rate: numRate,
        factory: editDeliveryFactory,
        due: editDeliveryDue,
      });

      showToast('Scheduled delivery updated successfully!', 'success');
      setEditDelivery(null);
      loadData();
    } catch (err) {
      const msg = err?.payload?.detail || err?.payload?.kgs?.[0] || err?.message || 'Failed to update delivery';
      showToast(msg, 'error');
    } finally {
      setEditDeliverySaving(false);
    }
  };

  // Cancel / Delete Delivery
  const handleDeleteDelivery = async (id) => {
    try {
      await loomService.deleteYarnDelivery(id);
      showToast('Scheduled delivery cancelled & unscheduled kg restored.', 'success');
      loadData();
    } catch (err) {
      const msg = err?.payload?.detail || err?.payload?.message || err?.message || 'Failed to cancel delivery';
      showToast(msg, 'error');
    }
  };

  const pendingDeliveries = deliveries.filter((d) => d.status === 'Scheduled');

  const [delivPage, setDelivPage] = useState(1);
  const [delivPageSize, setDelivPageSize] = useState(10);

  const [bookingPage, setBookingPage] = useState(1);
  const [bookingPageSize, setBookingPageSize] = useState(10);

  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(10);

  const paginatedDeliveries = useMemo(() => {
    const start = (delivPage - 1) * delivPageSize;
    return pendingDeliveries.slice(start, start + delivPageSize);
  }, [pendingDeliveries, delivPage, delivPageSize]);

  const paginatedBookings = useMemo(() => {
    const start = (bookingPage - 1) * bookingPageSize;
    return bookings.slice(start, start + bookingPageSize);
  }, [bookings, bookingPage, bookingPageSize]);

  const activeStockOverview = useMemo(() => {
    return stockOverview.filter((s) => s.recd > 0 || s.pending > 0 || s.warp > 0 || s.weft > 0);
  }, [stockOverview]);

  const paginatedStock = useMemo(() => {
    const start = (stockPage - 1) * stockPageSize;
    return activeStockOverview.slice(start, start + stockPageSize);
  }, [activeStockOverview, stockPage, stockPageSize]);

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
    },
    {
      id: 'bookings',
      label: 'Procurement Bookings',
      icon: Package,
    },
    {
      id: 'stock',
      label: 'Live Factory Stock',
      icon: Layers,
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
        <div className="inline-flex max-w-full overflow-x-auto no-scrollbar p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-xl shadow-2xs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'} />
                <span>{tab.label}</span>
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
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="pms-label mb-0">Supplier / Vendor</label>
                  {parties.length > 0 && (
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                      <Building2 size={11} /> Connected to Parties Master ({parties.length})
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    value={bkSupplierParty}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setBkSupplierParty(pid);
                      if (pid) {
                        const p = parties.find((x) => x.id === pid);
                        if (p) setBkSupplier(p.name);
                      }
                    }}
                    className="pms-select w-full cursor-pointer text-xs"
                  >
                    <option value="">— Pick from Parties Master —</option>
                    {parties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.gstin ? `(${p.gstin})` : p.city ? `(${p.city})` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Or enter custom supplier name"
                    value={bkSupplier}
                    onChange={(e) => {
                      setBkSupplier(e.target.value);
                      if (bkSupplierParty) {
                        const matched = parties.find((x) => x.id === bkSupplierParty);
                        if (matched && matched.name !== e.target.value) {
                          setBkSupplierParty('');
                        }
                      }
                    }}
                    className="pms-input w-full text-xs"
                    required
                  />
                </div>
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
                <button
                  type="submit"
                  disabled={isSubmittingBooking}
                  className="pms-btn-blue w-full inline-flex items-center justify-center gap-1.5"
                >
                  {isSubmittingBooking ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={16} />}
                  <span>Book Yarn</span>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="pms-label mb-0">From Active Booking</label>
                  {selectedBooking && (
                    <button
                      type="button"
                      onClick={() => openEditBookingModal(selectedBooking)}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                      title="Increase total booking quantity or edit rate"
                    >
                      <Pencil size={11} /> + Increase Booking Qty
                    </button>
                  )}
                </div>
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
                {selectedBooking && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 px-1">
                    <span>
                      Available to schedule:{' '}
                      <b className="text-emerald-600 font-mono">{formatNum(selectedBooking.unscheduled_kgs)} kg</b>
                    </span>
                    <span>
                      Booked: <b className="font-mono text-slate-700 dark:text-slate-300">{formatNum(selectedBooking.kgs)} kg</b>
                    </span>
                  </div>
                )}
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
                  className="pms-input w-full font-mono font-semibold"
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
                  className="pms-input w-full font-mono"
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

              {/* Auto-increase helper banner when delivery exceeds remaining unscheduled kg */}
              {schShortage > 0 && selectedBooking && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 space-y-2 sm:col-span-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">
                        Entered {formatNum(schKgs)} kg exceeds available booking ({formatNum(selectedBooking.unscheduled_kgs)} kg) by{' '}
                        <b className="font-mono text-amber-800 dark:text-amber-100">+{formatNum(schShortage)} kg</b>.
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        The system can auto-expand your booking total so delivery schedules seamlessly without error.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 font-medium cursor-pointer bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-md border border-amber-300 dark:border-amber-700">
                    <input
                      type="checkbox"
                      checked={autoIncreaseBooking}
                      onChange={(e) => setAutoIncreaseBooking(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-slate-800 dark:text-slate-200 text-xs">
                      Auto-increase booking total to{' '}
                      <b className="font-mono font-bold text-blue-600">{formatNum(Number(selectedBooking.kgs) + schShortage)} kg</b> (+{formatNum(schShortage)} kg)
                    </span>
                  </label>
                </div>
              )}

              <div className="sm:col-span-2 pt-1">
                <button
                  type="submit"
                  disabled={isSubmittingDelivery}
                  className="pms-btn-emerald w-full inline-flex items-center justify-center gap-1.5"
                >
                  {isSubmittingDelivery ? <RefreshCw size={15} className="animate-spin" /> : <Truck size={16} />}
                  <span>Schedule Delivery</span>
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

          <div className="pms-table-container overflow-x-auto">
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
                {paginatedDeliveries.map((d) => {
                  const isLate = d.due < todayStr;
                  const currentRecdVal =
                    receiptInputs[d.id]?.kgs !== undefined ? receiptInputs[d.id].kgs : d.kgs;
                  const currentRecdDate = receiptInputs[d.id]?.date || todayStr;

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
                          value={currentRecdVal}
                          onChange={(e) => handleReceiptChange(d.id, 'kgs', e.target.value)}
                          onKeyDown={preventNegativeInput}
                          className="w-20 sm:w-24 h-8 px-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-right outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                        <input
                          type="date"
                          value={currentRecdDate}
                          onChange={(e) => handleReceiptChange(d.id, 'date', e.target.value)}
                          className="h-8 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                        />
                      </td>
                      <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleConfirmReceipt(d.id)}
                            disabled={confirmingReceiptId === d.id}
                            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                            title="Confirm physical yarn receipt and update factory inventory"
                          >
                            {confirmingReceiptId === d.id ? (
                              <RefreshCw size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            <span>Confirm Receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditDeliveryModal(d)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Edit scheduled quantity, rate, or date"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteDeliveryConfirmId(d.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Cancel scheduled delivery"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
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

          <TablePagination
            total={pendingDeliveries.length}
            page={delivPage}
            pageSize={delivPageSize}
            onPageChange={setDelivPage}
            onPageSizeChange={(newSize) => {
              setDelivPageSize(newSize);
              setDelivPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* Section 3: Bookings Overview Table */}
      {(activeTab === 'bookings' || activeTab === 'all') && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Yarn Procurement Bookings
            </h3>
            <span className="text-[11px] text-slate-400">
              Total Bookings: <b className="font-mono text-slate-600 dark:text-slate-200">{bookings.length}</b>
            </span>
          </div>
          <div className="pms-table-container overflow-x-auto">
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
                {paginatedBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{b.supplier}</span>
                        {b.supplier_party_details ? (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono flex items-center gap-1 mt-0.5">
                            <Building2 size={10} className="shrink-0" />
                            <span>Parties Master</span>
                            {b.supplier_party_details.gstin && (
                              <span className="text-slate-400 font-normal">({b.supplier_party_details.gstin})</span>
                            )}
                          </span>
                        ) : null}
                      </div>
                    </td>
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
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-right font-mono">₹{b.rate}</td>
                    <td className="py-2 px-2.5 sm:py-2.5 sm:px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditBookingModal(b)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Edit booking / Increase booked quantity"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteBookingConfirmId(b.id)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Delete yarn booking"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!bookings.length && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-slate-400">
                      No yarn bookings recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={bookings.length}
            page={bookingPage}
            pageSize={bookingPageSize}
            onPageChange={setBookingPage}
            onPageSizeChange={(newSize) => {
              setBookingPageSize(newSize);
              setBookingPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
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
          <div className="pms-table-container overflow-x-auto">
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
                {paginatedStock.map((s, idx) => (
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
                {!activeStockOverview.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No factory yarn balances yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={activeStockOverview.length}
            page={stockPage}
            pageSize={stockPageSize}
            onPageChange={setStockPage}
            onPageSizeChange={(newSize) => {
              setStockPageSize(newSize);
              setStockPage(1);
            }}
            pageSizeOptions={[10, 20, 50]}
          />
        </div>
      )}

      {/* Edit Booking Modal */}
      <Modal
        isOpen={Boolean(editBooking)}
        onClose={() => setEditBooking(null)}
        title="Edit Yarn Booking & Adjust Quantity"
        subtitle={editBooking ? `${editBooking.supplier} — ${editBooking.yarn_name}` : ''}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setEditBooking(null)}
              className="pms-btn-secondary"
              disabled={editBookingSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateBooking}
              disabled={editBookingSaving}
              className="pms-btn-blue inline-flex items-center gap-1.5"
            >
              {editBookingSaving && <RefreshCw size={13} className="animate-spin" />}
              <span>Save Changes</span>
            </button>
          </div>
        }
      >
        {editBooking && (
          <form onSubmit={handleUpdateBooking} className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Booked</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">{formatNum(editBooking.kgs)} kg</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Scheduled</span>
                <span className="font-mono font-bold text-blue-600">{formatNum(editBooking.scheduled_kgs)} kg</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Delivered</span>
                <span className="font-mono font-bold text-emerald-600">{formatNum(editBooking.delivered_kgs)} kg</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="pms-label mb-0">Total Booked Kg</label>
                <span className="text-[10px] text-slate-400 font-medium">
                  Min: {formatNum(editBooking.scheduled_kgs)} kg
                </span>
              </div>
              <input
                type="number"
                min={editBooking.scheduled_kgs || 0.01}
                step="any"
                value={editBookingKgs}
                onChange={(e) => setEditBookingKgs(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full font-mono font-semibold"
                required
              />
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-slate-400 font-medium mr-1">Quick Increase:</span>
                {[500, 1000, 2500, 5000, 10000].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => addQuickKg(inc)}
                    className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200/80 dark:border-blue-800 transition cursor-pointer"
                  >
                    +{formatNum(inc)} kg
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="pms-label">Rate ₹/kg</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editBookingRate}
                  onChange={(e) => setEditBookingRate(e.target.value)}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                  required
                />
              </div>
              <div>
                <label className="pms-label">Booking Date</label>
                <input
                  type="date"
                  value={editBookingDate}
                  onChange={(e) => setEditBookingDate(e.target.value)}
                  className="pms-input w-full"
                />
              </div>
            </div>

            <div>
              <label className="pms-label">Note</label>
              <input
                type="text"
                value={editBookingNote}
                onChange={(e) => setEditBookingNote(e.target.value)}
                placeholder="Optional notes"
                className="pms-input w-full"
              />
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Scheduled Delivery Modal */}
      <Modal
        isOpen={Boolean(editDelivery)}
        onClose={() => setEditDelivery(null)}
        title="Edit Scheduled Delivery"
        subtitle={editDelivery ? `${editDelivery.yarn_name} for ${editDelivery.factory_name}` : ''}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              onClick={() => setEditDelivery(null)}
              className="pms-btn-secondary"
              disabled={editDeliverySaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateDelivery}
              disabled={editDeliverySaving}
              className="pms-btn-emerald inline-flex items-center gap-1.5"
            >
              {editDeliverySaving && <RefreshCw size={13} className="animate-spin" />}
              <span>Save Delivery</span>
            </button>
          </div>
        }
      >
        {editDelivery && (
          <form onSubmit={handleUpdateDelivery} className="space-y-4">
            <div>
              <label className="pms-label">Target Factory</label>
              <select
                value={editDeliveryFactory}
                onChange={(e) => setEditDeliveryFactory(e.target.value)}
                className="pms-select w-full cursor-pointer"
              >
                {factories.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="pms-label">Scheduled Kg (Kg to Send)</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={editDeliveryKgs}
                onChange={(e) => setEditDeliveryKgs(e.target.value)}
                onKeyDown={preventNegativeInput}
                className="pms-input w-full font-mono font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="pms-label">Rate ₹/kg</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={editDeliveryRate}
                  onChange={(e) => setEditDeliveryRate(e.target.value)}
                  onKeyDown={preventNegativeInput}
                  className="pms-input w-full font-mono"
                />
              </div>
              <div>
                <label className="pms-label">Expected Due Date</label>
                <input
                  type="date"
                  value={editDeliveryDue}
                  onChange={(e) => setEditDeliveryDue(e.target.value)}
                  className="pms-input w-full"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-xs text-slate-700 dark:text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={editDeliveryAutoIncrease}
                onChange={(e) => setEditDeliveryAutoIncrease(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span>Auto-expand booking quantity if new delivery kg exceeds remaining booking balance</span>
            </label>
          </form>
        )}
      </Modal>

      {/* Delete Booking Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteBookingConfirmId)}
        onClose={() => setDeleteBookingConfirmId(null)}
        onConfirm={async () => {
          const id = deleteBookingConfirmId;
          setDeleteBookingConfirmId(null);
          await handleDeleteBooking(id);
        }}
        title="Delete Yarn Booking"
        message="Are you sure you want to delete this yarn booking? Unreceived scheduled deliveries will also be cancelled. Bookings with already received yarn cannot be deleted."
        confirmText="Delete Booking"
        variant="danger"
      />

      {/* Delete / Cancel Delivery Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteDeliveryConfirmId)}
        onClose={() => setDeleteDeliveryConfirmId(null)}
        onConfirm={async () => {
          const id = deleteDeliveryConfirmId;
          setDeleteDeliveryConfirmId(null);
          await handleDeleteDelivery(id);
        }}
        title="Cancel Scheduled Delivery"
        message="Are you sure you want to cancel this scheduled delivery? The scheduled kilograms will be returned back to the booking's unscheduled balance."
        confirmText="Cancel Delivery"
        variant="danger"
      />
    </div>
  );
}
