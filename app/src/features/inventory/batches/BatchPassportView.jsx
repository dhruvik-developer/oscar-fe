import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  ShieldCheck,
  Package,
  Layers,
  Calendar,
  Tag,
  Copy,
  Check,
  Share2,
  Printer,
  RefreshCw,
  ExternalLink,
  Factory,
  Droplets,
  Warehouse,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Search,
  ShoppingCart,
  DollarSign,
  AlertTriangle,
  History,
  Scissors,
  TrendingUp,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowLeft,
  Building2,
  ShieldAlert,
  Info,
  Lock,
  Boxes,
  Truck,
  RotateCcw
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';
import { formatINR, formatNumberIN, describeApiError } from '../../accounts/accountingShared';
import { ColourChip } from '../../purchase/DyeingColourField';
import { printBatchTags, batchHistoryUrl, batchUrl } from './printBatchTag';

// Quantity metrics configuration
const QUANTITY_METRICS = [
  { key: 'available', label: 'Available Stock', tone: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/20', isPrimary: true },
  { key: 'received', label: 'Total Received', tone: 'text-blue-300', border: 'border-blue-500/30', bg: 'bg-blue-950/20', isPrimary: true },
  { key: 'onHand', label: 'In Hand (Godown)', tone: 'text-slate-200', border: 'border-slate-600/40', bg: 'bg-slate-800/40', isPrimary: true },
  { key: 'reserved', label: 'Reserved (Orders)', tone: 'text-indigo-300', border: 'border-indigo-500/30', bg: 'bg-indigo-950/20', isPrimary: true },
  { key: 'qcHold', label: 'QC Hold / Pending', tone: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/20', isPrimary: true },
  { key: 'rework', label: 'In Rework', tone: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-950/20', isPrimary: true },
  { key: 'rejected', label: 'Rejected / Waste', tone: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-950/20', isPrimary: true },
  { key: 'withJobWorker', label: 'At Mill / Job Worker', tone: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-950/20', isPrimary: true },
  { key: 'sold', label: 'Sold (Net)', tone: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-950/20', isPrimary: false },
  { key: 'secondQuality', label: 'Second Quality', tone: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20', isPrimary: false },
  { key: 'sentForJobWork', label: 'Sent for Job Work', tone: 'text-purple-300', border: 'border-purple-500/30', bg: 'bg-purple-950/20', isPrimary: false },
  { key: 'returnedFromJobWork', label: 'Returned from JW', tone: 'text-teal-300', border: 'border-teal-500/30', bg: 'bg-teal-950/20', isPrimary: false },
  { key: 'unregistered', label: 'Unregistered Bulk', tone: 'text-amber-300', border: 'border-amber-500/30', bg: 'bg-amber-950/20', isPrimary: false },
];

const KIND_STYLE = {
  BATCH_CREATED: { dot: 'bg-slate-300', tag: 'bg-slate-800 text-slate-300 border-slate-700' },
  MOVEMENT: { dot: 'bg-blue-400', tag: 'bg-blue-950/60 text-blue-300 border-blue-800/60' },
  LOSS: { dot: 'bg-rose-400', tag: 'bg-rose-950/60 text-rose-300 border-rose-800/60' },
  QC: { dot: 'bg-amber-400', tag: 'bg-amber-950/60 text-amber-300 border-amber-800/60' },
  JOB_WORK_OUT: { dot: 'bg-violet-400', tag: 'bg-violet-950/60 text-violet-300 border-violet-800/60' },
  JOB_WORK_IN: { dot: 'bg-violet-500', tag: 'bg-violet-950/60 text-violet-300 border-violet-800/60' },
  COST: { dot: 'bg-emerald-400', tag: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60' },
  YARN: { dot: 'bg-teal-400', tag: 'bg-teal-950/60 text-teal-300 border-teal-800/60' },
};

const KIND_FILTERS = [
  ['', 'All Events'],
  ['MOVEMENT', 'Stock Movements'],
  ['QC', 'Quality Control'],
  ['JOB_WORK', 'Job Work & Processing'],
  ['YARN', 'Yarn Usage'],
  ['LOSS', 'Rejections & Claims'],
  ['COST', 'Costing & Charges']
];

export default function BatchPassportView({ isPublic = false }) {
  const { code } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [historyKind, setHistoryKind] = useState('');
  const [showUsedUpTakas, setShowUsedUpTakas] = useState(false);
  const [takaSearch, setTakaSearch] = useState('');
  const [qrSrc, setQrSrc] = useState('');

  // Fallback initial metadata from query params (useful when offline/unauthenticated)
  const fallbackMetadata = useMemo(() => ({
    batchCode: code || 'UNKNOWN',
    item: searchParams.get('item') || '',
    fabricQuality: searchParams.get('quality') || '',
    shade: searchParams.get('shade') || '',
    lots: searchParams.get('lots') ? searchParams.get('lots').split(',') : [],
    takaCount: searchParams.get('rolls') || searchParams.get('takas') || '',
    quantities: {
      received: searchParams.get('qty') || '',
      available: searchParams.get('qty') || '',
      uom: searchParams.get('uom') || 'MTR',
    },
    createdOn: searchParams.get('date') || new Date().toISOString().split('T')[0],
    hsnCode: searchParams.get('hsn') || '',
    status: searchParams.get('status') || 'Active / QC Passed',
    warehouse: searchParams.get('wh') || 'Central Warehouse',
  }), [code, searchParams]);

  // Load batch data
  const loadBatchData = async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      let res = null;
      if (isPublic) {
        // Public Batch Passport (no login required)
        try {
          res = await inventoryService.getPublicBatch(code);
        } catch (pubErr) {
          try {
            res = await inventoryService.getBatch(code);
          } catch {
            throw pubErr;
          }
        }
      } else {
        // Authenticated batch workspace
        try {
          res = await inventoryService.getBatch(code);
        } catch (authErr) {
          // Fallback to public endpoint
          res = await inventoryService.getPublicBatch(code);
        }
      }
      if (res) {
        setBatch(res);
      } else {
        setBatch(fallbackMetadata);
      }
    } catch (err) {
      console.warn('Could not load full batch detail, using available parameters:', err);
      if (!batch) {
        setBatch(fallbackMetadata);
      }
      setError(describeApiError(err) || 'The batch could not be loaded from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatchData();
  }, [code]);

  // Generate QR code
  useEffect(() => {
    if (!code) return;
    let live = true;
    const url = batchHistoryUrl(code);
    QRCode.toDataURL(url, { margin: 1, width: 260, errorCorrectionLevel: 'M' })
      .then((data) => { if (live) setQrSrc(data); })
      .catch(() => { if (live) setQrSrc(''); });
    return () => { live = false; };
  }, [code]);

  const handleCopyCode = () => {
    const textToCopy = batch?.batchCode || code;
    if (textToCopy) {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    const batchId = batch?.batchCode || code;
    if (!batchId) return;
    const targetUrl = batchHistoryUrl(batchId);
    const title = `OSCAR Batch Passport: ${batchId}`;
    const desc = `OSCAR Digital Batch Passport for ${batchId} (${batch?.item || 'Fabric Batch'})`;

    // 1. If mobile device with native sharing capability
    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent || '')) {
      try {
        await navigator.share({ title, text: desc, url: targetUrl });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
      }
    }

    // 2. Otherwise copy public URL to clipboard
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = targetUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch (err) {
      console.warn('Could not copy URL to clipboard:', err);
    }
  };

  const handlePrint = async () => {
    if (batch) {
      await printBatchTags([batch]);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/inventory/batches');
    }
  };

  const currentBatch = batch || fallbackMetadata;
  const q = currentBatch?.quantities || {};
  const uom = q.uom || currentBatch?.uom || 'MTR';
  const trace = currentBatch?.purchaseTrace || null;
  const flowB = trace?.fabricFlow === 'FACTORY_TO_MILL';
  const receipt = trace?.receipt || {};
  const takas = currentBatch?.takas || [];
  const timeline = currentBatch?.timeline || [];
  const costing = currentBatch?.costing || null;
  const documents = currentBatch?.documents || [];
  const sales = currentBatch?.sales || [];
  const jobWork = currentBatch?.jobWork || [];
  const productionRuns = currentBatch?.productionRuns || [];
  const yarn = currentBatch?.yarn || { issues: [], manual: [], totals: {} };
  const qc = currentBatch?.qc || { results: [], inspected: {}, now: {} };
  const vendorReturns = currentBatch?.vendorReturns || [];

  // Filtered takas
  const filteredTakas = useMemo(() => {
    let list = takas;
    if (!showUsedUpTakas) {
      list = list.filter((t) => Number(t.availableQuantity || 0) > 0);
    }
    if (takaSearch.trim()) {
      const s = takaSearch.toLowerCase().trim();
      list = list.filter((t) =>
        String(t.takaId || '').toLowerCase().includes(s) ||
        String(t.takaNumber || '').toLowerCase().includes(s) ||
        String(t.lotNumber || '').toLowerCase().includes(s) ||
        String(t.location || '').toLowerCase().includes(s) ||
        String(t.shade || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [takas, showUsedUpTakas, takaSearch]);

  // Filtered timeline
  const filteredTimeline = useMemo(() => {
    if (!historyKind) return timeline;
    return timeline.filter((e) => (historyKind === 'JOB_WORK' ? e.kind?.startsWith('JOB_WORK') : e.kind === historyKind));
  }, [timeline, historyKind]);

  // Navigation tab definitions
  const TABS = [
    { id: 'overview', label: 'Overview & Traceability', icon: Layers },
    { id: 'stock', label: 'Rolls & Takas', icon: Package, count: takas.length },
    { id: 'qc', label: 'Quality & QC', icon: ShieldCheck, count: qc.results?.length },
    { id: 'production', label: 'Daily Production', icon: Scissors, count: productionRuns.length },
    { id: 'yarn', label: 'Yarn Usage', icon: Sparkles, count: (yarn.issues?.length || 0) + (yarn.manual?.length || 0) },
    { id: 'dyeing', label: 'Dyeing & Job Work', icon: Droplets, count: jobWork.length },
    { id: 'sales', label: 'Sales & Dispatches', icon: ShoppingCart, count: sales.length },
    { id: 'cost', label: 'Cost & Profit', icon: DollarSign, badge: currentBatch.canSeeCost ? 'Available' : 'Restricted' },
    { id: 'documents', label: 'Linked Documents', icon: FileText, count: documents.length },
    { id: 'history', label: 'Complete History', icon: History, count: timeline.length },
    { id: 'qr', label: 'Live QR Tag', icon: Tag },
  ];

  if (loading && !batch) {
    return (
      <div className="min-h-screen bg-[#070d1e] text-slate-100 flex flex-col items-center justify-center p-6">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-400">Loading OSCAR Batch Passport for {code}…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070d1e] text-slate-100 antialiased selection:bg-blue-500 selection:text-white">
      {/* Background Decorative Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8 space-y-5">
        {/* Top Brand Bar */}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {!isPublic && (
              <button
                type="button"
                onClick={handleBack}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition cursor-pointer"
                title="Back to Batch Registry"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base tracking-widest shadow-lg shadow-blue-500/25 border border-blue-400/30">
              O
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wider text-white">OSCAR TEXTILES</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">ERP</span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium tracking-wide">Batch Passport &amp; Digital Traceability</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-xs">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Verified Tag</span>
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Print Official Batch Tag"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print Tag</span>
            </button>

            <button
              type="button"
              onClick={handleShare}
              className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Share Passport Link"
            >
              {copiedUrl ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
              <span className="hidden sm:inline">{copiedUrl ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
              type="button"
              onClick={loadBatchData}
              className="h-8 px-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer"
              title="Refresh Live Data"
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="underline text-rose-200 cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* Hero Batch Passport Card */}
        <div className="rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="space-y-3 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Batch ID</span>
                {currentBatch.status && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                    currentBatch.status === 'In Stock' || currentBatch.status.includes('Passed')
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      : currentBatch.status === 'QC Hold'
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : currentBatch.status === 'At Job Worker'
                      ? 'bg-violet-500/15 border-violet-500/30 text-violet-300'
                      : 'bg-slate-700/50 border-slate-600 text-slate-300'
                  }`}>
                    {currentBatch.status}
                  </span>
                )}
                {currentBatch.fabricTypeLabel && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                    {currentBatch.fabricTypeLabel}
                  </span>
                )}
                {currentBatch.processed && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300">
                    Processed / Dyed
                  </span>
                )}
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {currentBatch.ownership === 'OSCAR' ? 'OSCAR Owned' : `Party Material: ${currentBatch.ownerPartyName || currentBatch.ownership}`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <h1 className="font-mono font-black text-2xl sm:text-3xl text-blue-400 tracking-tight break-all">
                  {currentBatch.batchCode}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  title="Copy Batch Code"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Fabric Item & Spec Line */}
              <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base font-semibold text-slate-200">
                <span>{currentBatch.item || 'Fabric Batch'}</span>
                {currentBatch.fabricQuality && <span className="text-slate-400">· Quality: <strong className="text-slate-200 font-semibold">{currentBatch.fabricQuality}</strong></span>}
                {currentBatch.design && <span className="text-slate-400">· Design: <strong className="text-slate-200 font-semibold">{currentBatch.design}</strong></span>}
                {currentBatch.shade && <span className="text-slate-400">· Shade: <strong className="text-slate-200 font-semibold">{currentBatch.shade}</strong></span>}
                {currentBatch.dyeingColourName && (
                  <ColourChip name={currentBatch.dyeingColourName} hex={currentBatch.dyeingColourHex} />
                )}
              </div>

              {/* Specifications Summary Grid */}
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 text-xs">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">HSN Code</dt>
                  <dd className="font-mono font-bold text-slate-200">{currentBatch.hsnCode || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Vendor / Supplier</dt>
                  <dd className="font-semibold text-slate-200 truncate">{currentBatch.supplierName || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Purchase Order</dt>
                  <dd className="font-mono font-bold text-blue-400">
                    {currentBatch.purchaseOrderId && !isPublic ? (
                      <Link to={`/purchase/orders?po=${encodeURIComponent(currentBatch.purchaseOrderId)}`} className="hover:underline">
                        {currentBatch.poNumber || currentBatch.purchaseOrderId}
                      </Link>
                    ) : (
                      currentBatch.poNumber || '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Source GRN / Doc</dt>
                  <dd className="font-mono text-slate-200">{[currentBatch.sourceDocumentType, currentBatch.sourceDocumentNumber].filter(Boolean).join(' ') || currentBatch.sourceDocumentNumber || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Creation Date</dt>
                  <dd className="font-mono text-slate-200">{currentBatch.createdOn || '-'}</dd>
                </div>

                {/* Additional conditional metadata */}
                {(currentBatch.width || currentBatch.gsm) && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">Width / GSM</dt>
                    <dd className="font-semibold text-slate-200">{[currentBatch.width && `${currentBatch.width}" W`, currentBatch.gsm && `${currentBatch.gsm} GSM`].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
                {currentBatch.lots && currentBatch.lots.length > 0 && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">Lot Numbers</dt>
                    <dd className="font-mono text-slate-200 truncate">{currentBatch.lots.join(', ')}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Rolls / Takas</dt>
                  <dd className="font-bold text-slate-200">{currentBatch.takaCount || takas.length || '-'}</dd>
                </div>
                {currentBatch.parentBatches && currentBatch.parentBatches.length > 0 && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">Made From (Parent)</dt>
                    <dd className="font-mono text-slate-200 truncate">{currentBatch.parentBatches.join(', ')}</dd>
                  </div>
                )}
                {currentBatch.childBatches && currentBatch.childBatches.length > 0 && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-slate-400">Used In (Child)</dt>
                    <dd className="font-mono text-slate-200 truncate">{currentBatch.childBatches.join(', ')}</dd>
                  </div>
                )}
              </dl>

              {currentBatch.notes && (
                <div className="pt-2 text-xs text-slate-400 bg-slate-800/40 border border-slate-800 p-2.5 rounded-lg">
                  <span className="font-semibold text-slate-300">Notes: </span>{currentBatch.notes}
                </div>
              )}
            </div>

            {/* Quick Mini QR Card */}
            <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-950/80 border border-slate-800 w-36 self-center lg:self-start">
              {qrSrc ? (
                <img src={qrSrc} alt={`QR for ${currentBatch.batchCode}`} className="w-28 h-28 rounded-lg bg-white p-1" />
              ) : (
                <div className="w-28 h-28 rounded-lg border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-[10px]">
                  Generating QR…
                </div>
              )}
              <span className="mt-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider text-center">Scan Tag</span>
            </div>
          </div>
        </div>

        {/* Quantity & Stock Balances Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Boxes size={16} className="text-blue-400" /> Quantity &amp; Stock Balances
            </h2>
            <span className="text-xs text-slate-400 font-mono">Unit: <strong className="text-slate-200 font-bold">{uom}</strong></span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {QUANTITY_METRICS.slice(0, 8).map((m) => (
              <div key={m.key} className={`rounded-xl border ${m.border} ${m.bg} p-3 text-center sm:text-left transition hover:border-slate-500`}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{m.label}</div>
                <div className={`text-lg sm:text-xl font-mono font-black tabular-nums mt-1 ${m.tone}`}>
                  {q[m.key] !== undefined && q[m.key] !== null ? formatNumberIN(q[m.key]) : '0'}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{uom}</div>
              </div>
            ))}
          </div>

          {/* Secondary Quantities Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {QUANTITY_METRICS.slice(8).map((m) => (
              <div key={m.key} className={`rounded-xl border border-slate-800/80 bg-slate-900/50 p-2.5 text-center sm:text-left`}>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">{m.label}</div>
                <div className={`text-sm sm:text-base font-mono font-bold tabular-nums mt-0.5 ${m.tone}`}>
                  {q[m.key] !== undefined && q[m.key] !== null ? formatNumberIN(q[m.key]) : '0'} <span className="text-[10px] text-slate-400 font-normal">{uom}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Order Traceability & Fabric Journey (PurchaseTraceCard) */}
        {trace && (
          <section className="rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Truck size={17} className="text-blue-400" /> Order Traceability &amp; Journey
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {trace.fabricFlowLabel} · PO <span className="font-mono font-semibold text-slate-200">{trace.poNumber}</span>
                </p>
              </div>

              {trace.purchaseOrderId && !isPublic && (
                <Link
                  to={`/purchase/orders?po=${encodeURIComponent(trace.purchaseOrderId)}`}
                  className="h-8 px-3 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 font-semibold text-xs text-blue-300 inline-flex items-center gap-1.5 transition"
                >
                  <ExternalLink size={12} /> Open PO
                </Link>
              )}
            </div>

            {/* Visual Step Timeline */}
            <ol className="flex flex-wrap items-center gap-2 py-1 text-xs font-semibold text-slate-300">
              <li className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5">
                <Factory size={14} className="text-blue-400" />
                <span>{trace.factoryName || currentBatch.supplierName || 'Factory'}</span>
              </li>
              {flowB && (
                <>
                  <ArrowRight size={14} className="text-slate-500" />
                  <li className="inline-flex items-center gap-1.5 rounded-lg bg-violet-950/40 border border-violet-800/60 px-3 py-1.5 text-violet-300">
                    <Droplets size={14} className="text-violet-400" />
                    <span>{trace.dyeingMillName || trace.millProcesses?.[0]?.millName || 'Dyeing Mill'}</span>
                  </li>
                </>
              )}
              <ArrowRight size={14} className="text-slate-500" />
              <li className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-3 py-1.5 text-emerald-300">
                <Warehouse size={14} className="text-emerald-400" />
                <span>OSCAR Godown · {receipt.grnNumber || 'GRN'}</span>
              </li>
            </ol>

            {/* Traceability Details Grid */}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
              {trace.dyeingColourName && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Dyeing Colour</dt>
                  <dd className="mt-0.5"><ColourChip name={trace.dyeingColourName} hex={trace.dyeingColourHex} /></dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Receipt Date</dt>
                <dd className="font-mono text-slate-200">{receipt.receiptDate || '-'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Received Quantity</dt>
                <dd className="font-mono font-bold text-slate-200">{formatNumberIN(receipt.receivedQty)} {uom}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Accepted (QC)</dt>
                <dd className="font-mono font-bold text-emerald-400">{receipt.acceptedQty != null ? `${formatNumberIN(receipt.acceptedQty)} ${uom}` : '-'}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">QC Status</dt>
                <dd className="font-semibold text-slate-200">{receipt.qcStatus || '-'}</dd>
              </div>
              {trace.allocatedTotal != null && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Allocated Landed Cost</dt>
                  <dd className="font-mono font-bold text-blue-300">{formatINR(trace.allocatedTotal)}</dd>
                </div>
              )}
              {trace.landedRate != null && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-slate-400">Landed Rate / Unit</dt>
                  <dd className="font-mono font-bold text-blue-300">{formatINR(trace.landedRate)} / {uom}</dd>
                </div>
              )}
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Landed Cost Status</dt>
                <dd className="font-semibold text-slate-200">
                  {{ PROVISIONAL: 'Provisional', COMPLETE: 'Complete', NOT_STARTED: 'Not Started' }[trace.landedCostStatus] || trace.landedCostStatus || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-slate-400">Challan Reference</dt>
                <dd className="font-mono text-slate-200">{receipt.challanNo || '-'}</dd>
              </div>
            </dl>

            {/* Allocated Landed Cost Breakdown Chips */}
            {trace.allocatedCosts && trace.allocatedCosts.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Landed Cost Breakdown</div>
                <div className="flex flex-wrap gap-2">
                  {trace.allocatedCosts.map((c) => (
                    <span key={c.label} className="rounded-lg bg-slate-800 border border-slate-700 px-2.5 py-1 text-xs text-slate-300">
                      {c.label}: <strong className="font-mono text-white tabular-nums">{formatINR(c.amount)}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Yarn Planned on PO */}
            {trace.yarnLines && trace.yarnLines.length > 0 && (
              <div className="pt-2 border-t border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Yarn Planned on the Purchase Order</div>
                <ul className="space-y-1 text-xs text-slate-300 bg-slate-800/50 p-2.5 rounded-lg border border-slate-800">
                  {trace.yarnLines.map((y, idx) => (
                    <li key={y.id || idx} className="flex flex-wrap items-center gap-x-2">
                      <span className="font-semibold text-white">{y.item || y.yarnQuality}</span>
                      <span className="font-mono text-slate-400">— {formatNumberIN(y.requiredQty)} {y.uom}</span>
                      {y.yarnLot && <span className="text-slate-400">· Lot: <span className="font-mono text-slate-200">{y.yarnLot}</span></span>}
                      {y.supplierName && <span className="text-slate-400">· Supplier: <span className="text-slate-200">{y.supplierName}</span></span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Factory to Mill Dispatches and Mill Processing (Flow B) */}
            {flowB && (
              <div className="pt-2 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Factory → Mill Dispatches <span className="font-normal text-slate-500">(Trace Only)</span></div>
                  {(trace.factoryToMill || []).length === 0 ? (
                    <p className="text-xs text-slate-500">None recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-slate-300">
                      {trace.factoryToMill.map((d, idx) => (
                        <li key={d.id || idx} className="bg-slate-800/40 p-2 rounded border border-slate-800">
                          <span className="font-mono font-bold text-white">{d.deliveryNumber}</span> · {d.dispatchDate} · {formatNumberIN(d.dispatchedQty)} {uom} to {d.millName}
                          {d.challanNo && <span className="text-slate-400 font-mono"> · Challan: {d.challanNo}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mill Receipt &amp; Processing</div>
                  {(trace.millProcesses || []).length === 0 ? (
                    <p className="text-xs text-slate-500">None recorded.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-slate-300">
                      {trace.millProcesses.map((m, idx) => (
                        <li key={m.id || idx} className="bg-slate-800/40 p-2 rounded border border-slate-800">
                          {m.millReceiptDate} · Received {formatNumberIN(m.qtyReceived)} {uom} · {[m.processType, m.shade].filter(Boolean).join(' ')} {formatNumberIN(m.processedQty)} {uom}
                          {m.millDispatchedQty && <span> · Dispatched {formatNumberIN(m.millDispatchedQty)} {uom} on {m.millDispatchDate || '-'}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tab Navigation Navigation Bar */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700" role="tablist">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setActiveTab(tab.id);
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', tab.id);
                  setSearchParams(next, { replace: true });
                }}
                className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 border border-blue-400/40 font-bold'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700'
                }`}
              >
                <Icon size={14} className={active ? 'text-white' : 'text-slate-500'} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-300'
                  }`}>
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="text-[10px] text-amber-300 font-normal">({tab.badge})</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* TAB CONTENTS */}

        {/* 1. OVERVIEW & TRACEABILITY TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Info size={16} className="text-blue-400" /> Complete Batch Profile
                </h3>

                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Batch Code</dt>
                    <dd className="font-mono font-bold text-blue-400 text-sm mt-0.5">{currentBatch.batchCode}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Fabric Item</dt>
                    <dd className="font-bold text-slate-200 mt-0.5">{currentBatch.item || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Fabric Type</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5">{currentBatch.fabricTypeLabel || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Quality</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5">{currentBatch.fabricQuality || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Design</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5">{currentBatch.design || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Shade / Colour</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5 flex items-center gap-1.5">
                      <span>{currentBatch.shade || currentBatch.dyeingColourName || '-'}</span>
                      {currentBatch.dyeingColourName && <ColourChip name={currentBatch.dyeingColourName} hex={currentBatch.dyeingColourHex} />}
                    </dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Origin</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5">{currentBatch.origin || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Supplier / Vendor</dt>
                    <dd className="font-semibold text-slate-200 mt-0.5 truncate">{currentBatch.supplierName || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Purchase Order</dt>
                    <dd className="font-mono font-bold text-blue-400 mt-0.5">{currentBatch.poNumber || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Source Document</dt>
                    <dd className="font-mono text-slate-200 mt-0.5">{[currentBatch.sourceDocumentType, currentBatch.sourceDocumentNumber].filter(Boolean).join(' ') || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Creation Date</dt>
                    <dd className="font-mono text-slate-200 mt-0.5">{currentBatch.createdOn || '-'}</dd>
                  </div>
                  <div className="bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                    <dt className="text-[10px] uppercase font-semibold text-slate-400">Current Status</dt>
                    <dd className="font-bold text-emerald-400 mt-0.5">{currentBatch.status || '-'}</dd>
                  </div>
                </dl>
              </div>

              {/* QR Code & Scan Instructions Card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 flex flex-col items-center justify-between text-center space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Scannable QR Passport</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Use camera to verify batch integrity</p>
                </div>

                <div className="p-3 bg-white rounded-2xl shadow-xl shadow-black/40">
                  {qrSrc ? (
                    <img src={qrSrc} alt={`QR code for ${currentBatch.batchCode}`} className="w-44 h-44 rounded-lg block" />
                  ) : (
                    <div className="w-44 h-44 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                      Rendering QR…
                    </div>
                  )}
                </div>

                <div className="w-full space-y-2">
                  <div className="font-mono font-bold text-xs text-blue-400 break-all bg-slate-950 p-2 rounded-lg border border-slate-800">
                    {currentBatch.batchCode}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Printer size={13} /> Print Label
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="px-3 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs inline-flex items-center justify-center gap-1.5 border border-slate-700 transition cursor-pointer"
                    >
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. ROLLS & TAKAS TAB */}
        {activeTab === 'stock' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <Package size={17} className="text-blue-400" /> Roll &amp; Taka Level Inventory ({filteredTakas.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Physical taka tracking, location, inspection status and available metres</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search taka, lot, location…"
                    value={takaSearch}
                    onChange={(e) => setTakaSearch(e.target.value)}
                    className="h-8 pl-8 pr-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48 sm:w-56"
                  />
                </div>

                <label className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <input
                    type="checkbox"
                    checked={showUsedUpTakas}
                    onChange={(e) => setShowUsedUpTakas(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-blue-600"
                  />
                  <span>Show empty rolls</span>
                </label>
              </div>
            </div>

            {filteredTakas.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No takas match the current view.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Taka ID</th>
                      <th className="py-2.5 px-3">Lot / Roll #</th>
                      <th className="py-2.5 px-3">Storage Location</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">QC Status</th>
                      <th className="py-2.5 px-3">Design / Shade</th>
                      <th className="py-2.5 px-3 text-right">Received</th>
                      <th className="py-2.5 px-3 text-right">Available</th>
                      <th className="py-2.5 px-3">Source Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredTakas.map((t) => (
                      <tr key={t.id || t.takaId} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                          {t.takaId}
                          {t.bulk && <span className="ml-1.5 px-1 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">bulk</span>}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{t.lotNumber} / {t.takaNumber}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{t.location || '-'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.status === 'In Stock' ? 'bg-emerald-500/20 text-emerald-300' :
                            t.status === 'Reserved' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {t.status || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            t.qcStatus === 'Passed' || t.qcStatus === 'Pass' ? 'bg-emerald-500/20 text-emerald-300' :
                            t.qcStatus === 'QC Hold' ? 'bg-amber-500/20 text-amber-300' :
                            t.qcStatus === 'Rejected' ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {t.qcStatus || '-'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{[t.design, t.shade].filter(Boolean).join(' · ') || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400">{formatNumberIN(t.receivedQuantity)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-400">{formatNumberIN(t.availableQuantity)}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">{[t.sourceDocumentType, t.sourceDocumentNumber].filter(Boolean).join(' ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. QUALITY & QC TAB */}
        {activeTab === 'qc' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck size={17} className="text-emerald-400" /> Quality Control &amp; Inspection Results
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Lab inspection logs, defect classification, rework routing and supplier claims</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">QC Status</div>
                <div className="text-base font-bold text-emerald-400 mt-1">{qc.state || receipt.qcStatus || currentBatch.status || 'Verified'}</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Good / Passed</div>
                <div className="text-base font-mono font-bold text-emerald-400 mt-1">{formatNumberIN(q.available || receipt.acceptedQty || 0)} {uom}</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">QC Hold</div>
                <div className="text-base font-mono font-bold text-amber-400 mt-1">{formatNumberIN(q.qcHold || 0)} {uom}</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">In Rework</div>
                <div className="text-base font-mono font-bold text-orange-400 mt-1">{formatNumberIN(q.rework || 0)} {uom}</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Rejected / Loss</div>
                <div className="text-base font-mono font-bold text-rose-400 mt-1">{formatNumberIN(q.rejected || 0)} {uom}</div>
              </div>
            </div>

            {/* QC Inspection Records */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">Inspection Logs ({(qc.results || []).length})</h4>
              {(qc.results || []).length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">No explicit QC inspection results logged for this batch.</p>
              ) : (
                <div className="space-y-2">
                  {qc.results.map((r, i) => (
                    <div key={r.id || i} className="p-3 rounded-xl bg-slate-800/40 border border-slate-800 text-xs flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{r.inspectionDate || r.date} · Inspector: {r.inspector || 'QC Lab'}</div>
                        <div className="text-slate-400 text-[11px] mt-0.5">{r.remarks || 'Standard visual & physical inspection'}</div>
                      </div>
                      <div className="flex items-center gap-3 font-mono">
                        <span className="text-emerald-400 font-bold">Good: {formatNumberIN(r.goodQty)} {uom}</span>
                        {Number(r.rejectedQty) > 0 && <span className="text-rose-400 font-bold">Rejected: {formatNumberIN(r.rejectedQty)} {uom}</span>}
                        {Number(r.reprocessQty) > 0 && <span className="text-amber-400 font-bold">Rework: {formatNumberIN(r.reprocessQty)} {uom}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. DAILY PRODUCTION RUNS TAB */}
        {activeTab === 'production' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Scissors size={17} className="text-blue-400" /> Daily Production Runs ({productionRuns.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Manufacturing runs, loom allocations, material issues, and output logs</p>
            </div>

            {productionRuns.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">This batch has no internal manufacturing runs recorded (e.g. direct fabric purchase).</p>
            ) : (
              <div className="space-y-3">
                {productionRuns.map((run) => (
                  <div key={run.id || run.runNumber} className="rounded-xl bg-slate-800/40 border border-slate-800 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">{run.runNumber}</span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">{run.status}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">Date: {run.date || run.startDate}</div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Operator</span>
                        <span className="font-semibold text-slate-200">{run.operator || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Loom / Machine</span>
                        <span className="font-semibold text-slate-200">{run.loom || run.machine || '-'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Produced Output</span>
                        <span className="font-mono font-bold text-emerald-400">{formatNumberIN(run.outputQty || run.totalOutput)} {run.uom || uom}</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block">Wastage</span>
                        <span className="font-mono text-rose-400">{formatNumberIN(run.wastageQty || 0)} {run.wastageUom || 'Kg'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. YARN USAGE TAB */}
        {activeTab === 'yarn' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Sparkles size={17} className="text-teal-400" /> Yarn to Fabric Consumption
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Yarn lots, issued quantities, consumption, returns, and wastage breakdown</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Total Issued</div>
                <div className="text-base font-mono font-bold text-white mt-1">{formatNumberIN(yarn.totals?.issued || 0)} Kg</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Consumed in Batch</div>
                <div className="text-base font-mono font-bold text-teal-400 mt-1">{formatNumberIN(yarn.totals?.consumed || 0)} Kg</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Returned to Godown</div>
                <div className="text-base font-mono font-bold text-blue-300 mt-1">{formatNumberIN(yarn.totals?.returned || 0)} Kg</div>
              </div>
              <div className="bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <div className="text-[10px] font-bold uppercase text-slate-400">Yarn Waste</div>
                <div className="text-base font-mono font-bold text-rose-400 mt-1">{formatNumberIN(yarn.totals?.waste || 0)} Kg</div>
              </div>
            </div>

            {((yarn.issues || []).length === 0 && (yarn.manual || []).length === 0) ? (
              <p className="text-xs text-slate-500 py-8 text-center">No direct yarn issues recorded for this fabric batch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Yarn Item</th>
                      <th className="py-2.5 px-3">Lot Number</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Issued</th>
                      <th className="py-2.5 px-3 text-right">Consumed</th>
                      <th className="py-2.5 px-3 text-right">Returned</th>
                      <th className="py-2.5 px-3 text-right">Waste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {[...(yarn.issues || []), ...(yarn.manual || [])].map((item, i) => (
                      <tr key={item.id || i} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-semibold text-white">{item.yarnName || item.item || item.yarnQuality || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{item.yarnLot || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-300">{item.supplierName || '-'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300">{formatNumberIN(item.issuedQty || item.quantity)} Kg</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-teal-400">{formatNumberIN(item.consumedQty)} Kg</td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-300">{formatNumberIN(item.returnedQty)} Kg</td>
                        <td className="py-2.5 px-3 text-right font-mono text-rose-400">{formatNumberIN(item.wasteQty)} Kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 6. DYEING & JOB WORK TAB */}
        {activeTab === 'dyeing' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <Droplets size={17} className="text-violet-400" /> Dyeing, Printing &amp; Job Work ({jobWork.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Job work orders sent to external mills, outward challans, processed receipts, and charges</p>
            </div>

            {jobWork.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No external dyeing or job work orders have been dispatched for this batch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Order #</th>
                      <th className="py-2.5 px-3">Processor / Mill</th>
                      <th className="py-2.5 px-3">Process</th>
                      <th className="py-2.5 px-3">Sent Date</th>
                      <th className="py-2.5 px-3 text-right">Sent Qty</th>
                      <th className="py-2.5 px-3">Received Date</th>
                      <th className="py-2.5 px-3 text-right">Received Qty</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {jobWork.map((jw, i) => {
                      const orderNum = jw.jwoNo || jw.orderNumber || jw.orderNo || '-';
                      const millName = jw.vendor || jw.processorName || jw.millName || '-';
                      const proc = jw.process || jw.processType || 'Dyeing';
                      const sDate = jw.orderDate || jw.sentDate || jw.outwards?.[0]?.date || '-';
                      const rDate = jw.receivedDate || jw.inwards?.[0]?.date || '-';
                      const sQty = jw.sent ?? jw.sentQty ?? (jw.outwards?.[0]?.meters ?? null);
                      const rQty = jw.received ?? jw.receivedQty ?? (jw.inwards?.[0]?.meters ?? null);
                      const stat = jw.status || 'Active';

                      return (
                        <tr key={orderNum || i} className="hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-3 font-mono font-bold text-violet-400">{orderNum}</td>
                          <td className="py-2.5 px-3 font-semibold text-white">{millName}</td>
                          <td className="py-2.5 px-3 text-slate-300">{proc}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{sDate}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                            {sQty != null && sQty !== '' ? `${formatNumberIN(sQty)} ${uom}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-400">{rDate}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {rQty != null && rQty !== '' ? `${formatNumberIN(rQty)} ${uom}` : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                              {stat}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. SALES & CUSTOMERS TAB */}
        {activeTab === 'sales' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <ShoppingCart size={17} className="text-cyan-400" /> Sales Invoices &amp; Dispatches ({sales.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Commercial sales deliveries, customer allocations, rates, and vendor returns</p>
            </div>

            {sales.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">Nothing from this batch has been sold yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Document</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                      {currentBatch.canSeeCost && <th className="py-2.5 px-3 text-right">Selling Rate</th>}
                      {currentBatch.canSeeCost && <th className="py-2.5 px-3 text-right">Amount</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {sales.map((r, i) => (
                      <tr key={`${r.documentId}-${r.kind}-${i}`} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{r.date || '-'}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-400">
                          {r.documentNumber || '-'}
                          <span className="block text-[10px] text-slate-500 font-sans">{r.documentType}{r.status ? ` · ${r.status}` : ''}</span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">{r.customer || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-300">{r.kind}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-cyan-300">{formatNumberIN(r.quantity)} {uom}</td>
                        {currentBatch.canSeeCost && <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{r.rate ? formatINR(r.rate) : (r.kind === 'Sale' ? 'unpriced' : '-')}</td>}
                        {currentBatch.canSeeCost && <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums text-emerald-400">{r.amount ? formatINR(r.amount) : '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Vendor Returns */}
            {vendorReturns.length > 0 && (
              <div className="pt-3 border-t border-slate-800 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400">Returned to Vendor ({vendorReturns.length})</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Return Ref</th>
                        <th className="py-2 px-3 text-right">Quantity</th>
                        <th className="py-2 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {vendorReturns.map((vr, i) => (
                        <tr key={vr.reference || i}>
                          <td className="py-2 px-3 font-mono text-slate-400">{vr.date}</td>
                          <td className="py-2 px-3 font-mono font-bold text-rose-400">{vr.reference}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums text-rose-300">{formatNumberIN(vr.quantity)} {uom}</td>
                          <td className="py-2 px-3 text-slate-400">{vr.notes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 8. COST & PROFIT TAB */}
        {activeTab === 'cost' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <DollarSign size={17} className="text-emerald-400" /> Landed Cost, Revenue &amp; Unit Economics
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Calculated exclusively from posted transactions and audited GL cost distributions</p>
            </div>

            {!currentBatch.canSeeCost || !costing ? (
              <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-center space-y-2">
                <ShieldAlert size={28} className="text-amber-400 mx-auto" />
                <h4 className="text-sm font-bold text-white">Costing Data Protected</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Cost and profit metrics are restricted to users with Accounts &amp; Ledger viewing permissions.
                </p>
                {isPublic && (
                  <Link to="/login" className="mt-3 inline-block px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs">
                    Sign in to OSCAR ERP
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cost Side */}
                  <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/60 pb-1.5">
                      Batch Incurred Costs
                    </div>
                    <dl className="space-y-2 text-xs">
                      {Object.entries(costing.costByType || {}).map(([type, amount]) => (
                        <div key={type} className="flex justify-between text-slate-300">
                          <dt>{type}</dt>
                          <dd className="font-mono font-semibold">{formatINR(amount)}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2 text-sm">
                        <dt>Total Batch Cost</dt>
                        <dd className="font-mono text-blue-300">{formatINR(costing.totalCost)}</dd>
                      </div>
                      {Number(costing.pendingCost) > 0 && (
                        <div className="flex justify-between text-amber-400 pt-1">
                          <dt>Awaiting Approval (Estimates)</dt>
                          <dd className="font-mono">{formatINR(costing.pendingCost)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-300 pt-1">
                        <dt>Good Output Produced</dt>
                        <dd className="font-mono">{formatNumberIN(costing.goodOutput)} {uom}</dd>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-200">
                        <dt>Actual Cost / {uom}</dt>
                        <dd className="font-mono text-emerald-400">{formatINR(costing.costPerUnit)}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Revenue & Realization Side */}
                  <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-700/60 pb-1.5">
                      Realized Sales &amp; Margin
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <dt>Sold {formatNumberIN(costing.soldQty)} {uom} at avg {formatINR(costing.averageSellingRate)}</dt>
                        <dd className="font-mono font-semibold text-white">{formatINR(costing.revenue)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <dt>Cost of Sold Fabric</dt>
                        <dd className="font-mono text-rose-300">− {formatINR(costing.costOfSold)}</dd>
                      </div>
                      <div className={`flex justify-between font-bold border-t border-slate-700 pt-2 text-sm ${Number(costing.realizedProfit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        <dt>Realized Profit</dt>
                        <dd className="font-mono">{formatINR(costing.realizedProfit)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-300 pt-1">
                        <dt>Unsold Inventory Valuation</dt>
                        <dd className="font-mono text-blue-300">{formatINR(costing.unsoldInventoryValue)}</dd>
                      </div>

                      <div className="pt-2 border-t border-slate-700/60 text-[11px] uppercase font-semibold text-slate-400">
                        Loss &amp; Claims ({formatNumberIN(costing.rejectedQty)} {uom})
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <dt>Normal Loss Absorbed ({formatNumberIN(costing.normalLossQty)} {uom})</dt>
                        <dd className="font-mono text-slate-300">{formatINR(costing.normalLossAbsorbedCost)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <dt>Supplier Claims ({formatNumberIN(costing.claimableQty)} {uom})</dt>
                        <dd className="font-mono text-amber-300">{formatINR(costing.claimValue)}</dd>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <dt>Claim Recovered</dt>
                        <dd className="font-mono text-emerald-400">{formatINR(costing.recoveredAmount)}</dd>
                      </div>
                      <div className="flex justify-between text-amber-400">
                        <dt>Outstanding Claim</dt>
                        <dd className="font-mono">{formatINR(costing.outstandingClaim)}</dd>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <dt>Written Off Loss</dt>
                        <dd className="font-mono">{formatINR(costing.writtenOffLoss)}</dd>
                      </div>
                      <div className="flex justify-between font-bold text-white border-t border-slate-700 pt-2 text-sm">
                        <dt>Net Batch Result</dt>
                        <dd className="font-mono text-emerald-400">{formatINR(costing.netResult)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {costing.rule && (
                  <p className="text-[11px] text-slate-400 italic bg-slate-950 p-2 rounded-lg border border-slate-800">
                    Valuation Rule: {costing.rule}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 9. LINKED DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <FileText size={17} className="text-blue-400" /> Linked Transaction Documents ({documents.length})
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Every financial, warehouse, and commercial instrument connected to this batch</p>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No linked documents found for this batch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Document Type</th>
                      <th className="py-2.5 px-3">Document #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Party Name</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {documents.map((d, i) => (
                      <tr key={`${d.type}-${d.number}-${i}`} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {d.role || 'Reference'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">{d.type}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-blue-400">{d.number || '-'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{d.date || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-200">{d.party || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 10. COMPLETE HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <History size={17} className="text-blue-400" /> Complete Audit Trail &amp; Lifecycle Timeline ({filteredTimeline.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Chronological record of every movement, inspection, job work step and charge</p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
                {KIND_FILTERS.filter(([k]) => k !== 'COST' || currentBatch.canSeeCost).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setHistoryKind(k)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      historyKind === k
                        ? 'bg-blue-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTimeline.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No timeline events match the selected filter.</p>
            ) : (
              <ol className="relative border-l border-slate-800 ml-3 space-y-4 py-2">
                {filteredTimeline.map((e, idx) => {
                  const style = KIND_STYLE[e.kind] || { dot: 'bg-slate-400', tag: 'bg-slate-800 text-slate-300 border-slate-700' };
                  return (
                    <li key={`${e.kind}-${idx}`} className="ml-5">
                      <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-slate-900 ${style.dot}`} />
                      <div className="bg-slate-800/40 hover:bg-slate-800/70 transition border border-slate-800 p-3 rounded-xl space-y-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-semibold text-white text-xs sm:text-sm">{e.title}</span>
                          <span className="font-mono text-[11px] text-slate-400 tabular-nums">{e.date}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 pt-0.5">
                          {e.quantity && <span className="font-mono text-slate-200 font-semibold">Qty: {formatNumberIN(e.quantity)} {e.uom || uom}</span>}
                          {e.amount && <span className="font-mono font-bold text-emerald-400">{formatINR(e.amount)}</span>}
                          {e.unitCost && <span className="font-mono text-slate-300">@ {formatINR(e.unitCost)}</span>}
                          {e.location && <span>Godown: <strong className="text-slate-200 font-normal">{e.location}</strong></span>}
                          {e.taka && <span className="font-mono text-blue-400">{e.taka}</span>}
                          {e.reference && <span>Ref: <span className="font-mono text-slate-200">{e.referenceType ? `${e.referenceType} ` : ''}{e.reference}</span></span>}
                          {e.status && <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-700 text-slate-200">{e.status}</span>}
                          {e.by && <span className="text-slate-400">by {e.by}</span>}
                        </div>

                        {e.notes && (
                          <p className="text-[11px] text-slate-400 pt-1 italic">{e.notes}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {/* 11. LIVE QR TAG TAB */}
        {activeTab === 'qr' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <h3 className="text-base font-bold text-white">OSCAR Verified Batch Tag</h3>
            <p className="text-xs text-slate-400 max-w-md">
              Scan with any mobile device camera to open this digital product passport on the shop floor or in transit.
            </p>

            <div className="p-4 bg-white rounded-3xl shadow-2xl shadow-black/50 border border-slate-200">
              {qrSrc ? (
                <img src={qrSrc} alt={`QR Code for batch ${currentBatch.batchCode}`} className="w-64 h-64 rounded-xl block" />
              ) : (
                <div className="w-64 h-64 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                  Generating high-resolution QR…
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="font-mono font-black text-xl text-blue-400 tracking-wider">
                {currentBatch.batchCode}
              </div>
              <p className="text-xs text-slate-400 font-semibold">
                {currentBatch.item} · {currentBatch.fabricQuality || currentBatch.fabricTypeLabel}
              </p>
            </div>

            <div className="mt-1 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 max-w-md w-full flex items-center justify-between gap-2 text-xs font-mono">
              <span className="text-blue-400 truncate select-all">{batchHistoryUrl(currentBatch.batchCode || code)}</span>
              <a
                href={batchHistoryUrl(currentBatch.batchCode || code)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white font-sans font-bold flex-shrink-0 text-[11px] underline px-2 py-0.5 rounded bg-slate-800"
              >
                Open
              </a>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs inline-flex items-center gap-2 shadow-lg shadow-blue-500/25 transition cursor-pointer"
              >
                <Printer size={14} /> Print Batch Tags
              </button>
              <button
                type="button"
                onClick={handleCopyCode}
                className="h-9 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs inline-flex items-center gap-2 transition cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />} Copy Code
              </button>
              <button
                type="button"
                onClick={handleShare}
                className="h-9 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs inline-flex items-center gap-2 transition cursor-pointer"
              >
                {copiedUrl ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
                {copiedUrl ? 'Copied Public URL!' : 'Share Passport URL'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-6 text-xs text-slate-500 border-t border-slate-800/80">
          <p>© {new Date().getFullYear()} OSCAR Textile ERP · Digital Batch Passport System</p>
          <p className="text-[11px] text-slate-600 mt-1">Verified serial records synchronized with central inventory ledger.</p>
        </footer>
      </div>
    </div>
  );
}
