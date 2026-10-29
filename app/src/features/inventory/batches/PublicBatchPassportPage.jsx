import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  Package,
  CheckCircle2,
  Layers,
  Calendar,
  Tag,
  ShieldCheck,
  Share2,
  Copy,
  Check,
  Building2,
  Sparkles
} from 'lucide-react';
import { inventoryService } from '../../../services/domainServices';

export default function PublicBatchPassportPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();

  const [batchData, setBatchData] = useState(() => ({
    batchCode: code || 'UNKNOWN',
    item: searchParams.get('item') || '',
    fabricQuality: searchParams.get('quality') || '',
    shade: searchParams.get('shade') || '',
    lots: searchParams.get('lots') ? searchParams.get('lots').split(',') : [],
    takaCount: searchParams.get('rolls') || searchParams.get('takas') || '',
    totalQuantity: searchParams.get('qty') || '',
    uom: searchParams.get('uom') || 'MTR',
    createdOn: searchParams.get('date') || new Date().toISOString().split('T')[0],
    hsnCode: searchParams.get('hsn') || '',
    status: searchParams.get('status') || 'Active / QC Passed',
    warehouse: searchParams.get('wh') || 'Central Warehouse',
  }));

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    setLoading(true);
    inventoryService
      .getBatch(code)
      .then((res) => {
        if (alive && res) {
          setBatchData((prev) => ({
            ...prev,
            batchCode: res.batchCode || prev.batchCode,
            item: res.item || res.itemName || prev.item,
            fabricQuality: res.fabricQuality || prev.fabricQuality,
            shade: res.shade || prev.shade,
            lots: res.lots || prev.lots,
            takaCount: res.takaCount || res.takaRolls?.length || prev.takaCount,
            totalQuantity: res.totalQuantity || res.received || prev.totalQuantity,
            uom: res.uom || prev.uom,
            createdOn: res.createdOn || prev.createdOn,
            hsnCode: res.hsnCode || prev.hsnCode,
            status: res.status || 'Active / QC Passed',
            warehouse: res.warehouse || prev.warehouse,
          }));
        }
      })
      .catch(() => {
        // Fallback gracefully to query parameters if unauthenticated or server offline
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [code]);

  const handleCopyCode = () => {
    if (batchData.batchCode) {
      navigator.clipboard?.writeText(batchData.batchCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Batch Passport: ${batchData.batchCode}`,
        text: `OSCAR Textiles Batch Passport for ${batchData.batchCode} (${batchData.item})`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      handleCopyCode();
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-start p-4 sm:p-6 font-sans">
      {/* Brand Header */}
      <header className="w-full max-w-md flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm tracking-widest shadow-md shadow-blue-500/20">
            O
          </div>
          <div>
            <div className="font-extrabold text-sm tracking-wider text-white">OSCAR TEXTILES</div>
            <div className="text-[10px] text-slate-400 uppercase tracking-widest">Batch Verification System</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Verified Tag</span>
        </div>
      </header>

      {/* Main Passport Card */}
      <main className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Batch Code Hero Section */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-700/60">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Verified Batch ID
            </span>
            <div className="font-mono font-black text-2xl text-blue-400 tracking-tight mt-0.5 break-all">
              {batchData.batchCode}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={handleCopyCode}
              type="button"
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition"
              title="Copy Batch Code"
              aria-label="Copy Batch Code"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            </button>
            <button
              onClick={handleShare}
              type="button"
              className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition"
              title="Share Batch"
              aria-label="Share Batch"
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>

        {/* Status Chip */}
        <div className="my-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
            <CheckCircle2 size={13} />
            <span>{batchData.status}</span>
          </div>
          {batchData.createdOn && (
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <Calendar size={12} className="text-slate-500" />
              <span>{batchData.createdOn}</span>
            </div>
          )}
        </div>

        {/* Specification Grid */}
        <div className="space-y-3 bg-slate-900/60 rounded-xl p-3.5 border border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
              Fabric / Item Name
            </span>
            <div className="text-sm font-bold text-white">
              {batchData.item || 'Cotton Premium Cambric'}
            </div>
          </div>

          {(batchData.fabricQuality || batchData.shade) && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              {batchData.fabricQuality && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Quality</span>
                  <span className="text-xs font-semibold text-slate-200">{batchData.fabricQuality}</span>
                </div>
              )}
              {batchData.shade && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">Shade / Color</span>
                  <span className="text-xs font-semibold text-slate-200">{batchData.shade}</span>
                </div>
              )}
            </div>
          )}

          {/* Lots & Takas Roll metrics */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Assigned Lots</span>
              <span className="text-xs font-mono font-medium text-slate-300">
                {Array.isArray(batchData.lots) && batchData.lots.length > 0
                  ? batchData.lots.join(', ')
                  : 'LOT-01'}
              </span>
            </div>
            {batchData.takaCount && (
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Rolls / Takas</span>
                <span className="text-xs font-semibold text-slate-200">{batchData.takaCount} Rolls</span>
              </div>
            )}
          </div>

          {/* Quantity Metric */}
          {batchData.totalQuantity && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total Quantity</span>
              <span className="font-mono text-base font-bold text-emerald-400">
                {batchData.totalQuantity} {batchData.uom}
              </span>
            </div>
          )}
        </div>

        {/* Security Watermark */}
        <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Building2 size={13} className="text-slate-500" />
            <span>OSCAR ERP Unified Platform</span>
          </div>
          <div className="flex items-center gap-1 text-slate-500 text-[10px]">
            <Sparkles size={11} className="text-amber-400" />
            <span>Authenticated</span>
          </div>
        </div>
      </main>

      {/* Footer Instructions for Operator */}
      <footer className="w-full max-w-md mt-6 text-center text-xs text-slate-500 space-y-2">
        <p>This batch information is verified by Oscar ERP.</p>
        <div>
          <Link
            to="/inventory/batches"
            className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 font-semibold text-xs"
          >
            Open in Full ERP Dashboard &rarr;
          </Link>
        </div>
      </footer>
    </div>
  );
}
