import React from 'react';
import {
  Box,
  Boxes,
  ShoppingCart,
  Truck,
  Layers,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  IndianRupee,
  ClipboardList,
  Cog,
  ArrowDownToLine,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Check,
  Factory,
  FileText,
} from 'lucide-react';

const ICON_MAP = {
  Box,
  Boxes,
  ShoppingCart,
  Truck,
  Layers,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  IndianRupee,
  ClipboardList,
  Cog,
  ArrowDownToLine,
  CheckCircle2,
  Factory,
  FileText,
};

/**
 * Standard Unified Stage Workspace Header
 * Provides identical typography, stage numbering, department, status pill,
 * and top navigation controls across ALL stages in the PMS cycle.
 */
export function StageWorkspaceHeader({
  stage,
  project,
  currentSeq,
  totalStages = 18,
  prevStage,
  nextStage,
  onSelectStage,
  onRefresh,
  refreshing = false,
  titleOverride,
  subtitleOverride,
  actionButton,
  extraControls,
  children,
}) {
  const seq = Number(stage?.sequence ?? currentSeq ?? 1);
  const rawName = stage?.name || 'Stage Workspace';
  // Strip redundant "Stage X: " or "Stage X - " from name if present
  const cleanName = titleOverride || rawName.replace(/^Stage\s*\d+\s*[:\-\.]\s*/i, '').trim();

  const department = stage?.department || 'Operations';
  const status = stage?.status || 'In Progress';
  const weight = stage?.percentage ?? stage?.weight ?? null;

  // Resolve Stage Icon
  let IconComponent = Boxes;
  if (typeof stage?.icon === 'string' && ICON_MAP[stage.icon]) {
    IconComponent = ICON_MAP[stage.icon];
  } else if (seq === 1) IconComponent = Box;
  else if (seq === 2) IconComponent = ShoppingCart;
  else if (seq === 3) IconComponent = Truck;
  else if (seq === 4) IconComponent = Boxes;
  else if (seq === 5) IconComponent = Layers;
  else if (seq === 6) IconComponent = ShieldCheck;
  else if (seq === 7) IconComponent = Boxes;
  else if (seq === 8) IconComponent = Receipt;
  else if (seq === 9) IconComponent = FileSpreadsheet;
  else if (seq === 10) IconComponent = IndianRupee;
  else if (seq === 11) IconComponent = ClipboardList;
  else if (seq === 12) IconComponent = Truck;
  else if (seq === 13) IconComponent = Cog;
  else if (seq === 14) IconComponent = ArrowDownToLine;
  else if (seq === 15) IconComponent = ShieldCheck;
  else if (seq === 16) IconComponent = Boxes;
  else if (seq === 17) IconComponent = IndianRupee;
  else if (seq === 18) IconComponent = CheckCircle2;

  // Resolve Subtitle
  const subtitle =
    subtitleOverride ||
    stage?.description ||
    stage?.subtitle ||
    (seq === 1
      ? 'Check available grey fabric stock in OSCAR godown and allocate rolls for this project.'
      : seq === 2
      ? 'Procure required shortage grey fabric from external approved suppliers via official Purchase Order.'
      : seq === 3
      ? 'Track vendor fabric dispatches, challans, transporter vehicles, and delivery transit against Purchase Orders.'
      : seq === 4
      ? 'Dock gate inward receipt, inspect rolls, verify supplier challan, and receive material into warehouse.'
      : seq === 5
      ? 'Generate individual traceable lot numbers and barcode takas for inward fabric rolls.'
      : seq === 6
      ? 'Conduct 4-point grey fabric quality inspection, record defects, and approve usable rolls.'
      : seq === 7
      ? 'Finalize verified grey fabric inventory into godown stock and update available project allocation.'
      : seq === 8
      ? 'Receive and record external vendor commercial bill against received purchase quantities.'
      : seq === 9
      ? 'Perform 3-way matching between PO, GRN receipt, and supplier tax invoice before payment approval.'
      : seq === 10
      ? 'Approve and record supplier payment vouchers and disburse commercial dues.'
      : seq === 11
      ? 'Allocate traceable grey rolls, configure process specifications, and assign dyeing/printing mills.'
      : seq === 12
      ? 'Generate gate-pass and outward delivery challan to dispatch grey rolls to external processor WIP.'
      : seq === 13
      ? 'Monitor vendor dyeing/finishing progress, outward-inward balance, and loss tolerance.'
      : seq === 14
      ? 'Receive finished fabric rolls back from processor into godown with partial return tracking.'
      : seq === 15
      ? 'Finished goods 4-point quality inspection, grade disposition (Grade A / Seconds / Reject), and stock allocation.'
      : seq === 16
      ? 'Warehouse packing, customer outbound delivery challan, transporter LR manifest, and shipping.'
      : seq === 17
      ? 'Commercial dual-settlement: Customer sales invoice collections vs Processor job work charge payables.'
      : seq === 18
      ? 'Final commercial audit verification, reconciliation balance confirmation, and project sign-off.'
      : 'Execute operations and manage transactions for this stage.');

  const isCompleted = status === 'Completed';

  const prevSeq = prevStage ? Number(prevStage.sequence) : seq > 1 ? seq - 1 : null;
  const nextSeq = nextStage ? Number(nextStage.sequence) : seq < totalStages ? seq + 1 : null;

  return (
    <div className="rounded-xl border border-[#dce5f4] bg-white p-4 sm:p-5 shadow-2xs space-y-4">
      {/* Top Main Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Icon + Title Group */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-blue-200 bg-blue-50/70 text-blue-600 shadow-2xs">
            <IconComponent size={22} strokeWidth={2.2} />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Stage Number Badge */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
                Stage {seq}
              </span>

              {/* Department Pill */}
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {department}
              </span>

              {/* Stage Weight if available */}
              {weight !== null && (
                <span className="text-[11px] font-medium text-slate-400">
                  Weight: <strong className="text-slate-700">{weight}%</strong>
                </span>
              )}

              {/* Status Pill */}
              {isCompleted ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Check size={11} strokeWidth={3} />
                  <span>Completed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>{status}</span>
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              {cleanName}
            </h2>

            <p className="text-xs text-slate-500 line-clamp-2 max-w-3xl">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Controls & Top Navigation */}
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start lg:self-center">
          {extraControls}

          {actionButton}

          {onRefresh && (
            <button
              type="button"
              disabled={refreshing}
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-[#dce5f4] bg-white text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
              title="Refresh stage data"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Navigation Buttons: Previous / Next Stage */}
          {onSelectStage && (
            <div className="inline-flex items-center rounded-lg border border-[#dce5f4] bg-slate-50/80 p-0.5 shadow-2xs">
              <button
                type="button"
                disabled={!prevSeq || prevSeq < 1}
                onClick={() => prevSeq && onSelectStage(prevSeq)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-white hover:text-blue-600 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                title="Back to Previous Stage"
              >
                <ArrowLeft size={13} />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <span className="px-2 text-[11px] font-bold text-slate-400">
                {seq}/{totalStages}
              </span>

              <button
                type="button"
                disabled={!nextSeq || nextSeq > totalStages}
                onClick={() => nextSeq && onSelectStage(nextSeq)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-slate-700 hover:bg-white hover:text-blue-600 transition-all cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                title="Proceed to Next Stage"
              >
                <span className="hidden sm:inline">Next</span>
                <ArrowRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

export default StageWorkspaceHeader;
