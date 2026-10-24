import React, { useEffect } from 'react';
import { X, Printer, CheckCircle2, GitBranch, Calendar, User, Package, Layers, IndianRupee } from 'lucide-react';
import { SignatureSlot, useDocumentSignatures } from '../../../../components/common/SignatureSlot';
import { useERP } from '../../../../context/ERPContext';
import { formatCurrency } from '../../../../utils/currencyUtils';

function fmtM(n) {
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  return isNaN(num) ? '—' : `${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Mtr`;
}

function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : d;
}

export function PrintProjectModal({ isOpen, onClose, project }) {
  const docSigs = useDocumentSignatures('PmsProject', project?.id, `Project ${project?.code || ''}`);
  const { companyProfile } = useERP();
  const companyName = companyProfile?.name || 'OSCAR TEXTILES & APPAREL ERP';
  const companyAddress = companyProfile?.address || 'MIDC Industrial Area, Weaving & Processing Zone, India';
  const gstin = companyProfile?.gstin || '';
  const pan = companyProfile?.pan || '';
  const phone = companyProfile?.phone || '+91 98765 43210';

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  const handlePrint = () => {
    window.print();
  };

  const stages = project.stages || [];
  const customerTotal = Number(project.customerProjectTotalMeters ?? project.requirementMeters ?? project.quantity ?? 0);
  const customerReceived = Number(project.customerProjectReceivedMeters ?? 0);
  const ownTotal = Number(project.ownProjectTotalMeters ?? project.ownMeters ?? 0);
  const ownReceived = Number(project.ownProjectReceivedMeters ?? 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Screen Only - Hidden during print) */}
        <div className="bg-[#1F2E4A] text-white px-5 py-3.5 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
              <GitBranch size={16} />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block">
                Official Project Status & Production Report
              </span>
              <span className="text-[11px] text-blue-200 font-mono">
                Project Code: {project.code || project.id}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Download clean PDF or Print"
            >
              <Printer size={15} />
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
              title="Close Preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex-1 print:bg-white print:p-0 print:overflow-visible">
          <div className="p-8 sm:p-12 text-slate-800 bg-white font-sans text-xs space-y-6 printable-document shadow-sm print:shadow-none border border-slate-200 print:border-none rounded-xl print:rounded-none max-w-3xl mx-auto print:max-w-none">
            
            {/* Header Letterhead */}
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#1F2E4A] text-white flex items-center justify-center font-bold text-base font-mono">
                    {companyName.charAt(0)}
                  </div>
                  <div>
                    <h1 className="text-lg font-black text-[#1F2E4A] tracking-tight uppercase leading-tight">
                      {companyName}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase">
                      Textile Production Management System (PMS)
                    </p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5 pt-2">
                  <p>{companyAddress}</p>
                  <p>
                    {gstin ? `GSTIN: ${gstin}` : ''}
                    {pan ? ` • PAN: ${pan}` : ''}
                    {phone ? ` • Tel: ${phone}` : ''}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-3 py-1 rounded-full text-[10.5px] font-black uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                  {project.status || 'Active'}
                </span>
                <p className="font-mono font-bold text-sm text-slate-900 mt-2">{project.code || project.id}</p>
                <p className="text-[11px] text-slate-500">
                  Completion: <strong className="text-slate-900">{project.overallCompletionPct || 0}%</strong>
                </p>
                <p className="text-[11px] text-slate-500">
                  Priority: <strong>{project.priority || 'Normal'}</strong>
                </p>
              </div>
            </div>

            {/* Document Title Banner */}
            <div className="text-center py-2 border-b border-slate-200 bg-slate-50 rounded-lg">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Project Execution & Material Pipeline Report
              </h2>
            </div>

            {/* Project Context 2-Column Grid */}
            <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-3.5 bg-slate-50/50">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  CUSTOMER & COMMERCIAL CONTEXT
                </span>
                <strong className="text-slate-900 text-xs block">{project.customerName || '—'}</strong>
                <p className="text-slate-600 text-[11px]">Product: <strong>{project.productDetails?.productName || '—'}</strong></p>
                {project.crmOrderId && (
                  <p className="text-slate-600 text-[11px]">Sales / CRM Order Ref: <strong className="font-mono">{project.crmOrderId}</strong></p>
                )}
                <p className="text-slate-600 text-[11px]">Commercial Value: <strong>{formatCurrency(project.productDetails?.orderValue ?? 0)}</strong></p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  TIMELINE & DATES
                </span>
                <p className="text-slate-600 text-[11px]">Start Date: <strong>{fmtDate(project.startDate || project.createdAt)}</strong></p>
                <p className="text-slate-600 text-[11px]">Target Delivery: <strong>{fmtDate(project.targetDeliveryDate || project.expectedCompletionDate)}</strong></p>
                <p className="text-slate-600 text-[11px]">Overdue Status: <strong className={project.isOverdue ? 'text-rose-600 font-bold' : 'text-emerald-700'}>{project.isOverdue ? 'Overdue' : 'On Track'}</strong></p>
              </div>
            </div>

            {/* Customer vs Own Project Allocation */}
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                1. Fabric Allocation & Fulfillment Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/40">
                  <div className="flex items-center justify-between pb-1.5 border-b border-amber-200 mb-2">
                    <span className="font-bold text-amber-900 text-xs">Customer Order Fabric</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                      {project.customerProjectStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Requirement Target:</span>
                      <strong className="text-slate-900">{fmtM(customerTotal)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Received / Produced:</span>
                      <strong className="text-emerald-700">{fmtM(customerReceived)}</strong>
                    </div>
                  </div>
                </div>

                <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/40">
                  <div className="flex items-center justify-between pb-1.5 border-b border-blue-200 mb-2">
                    <span className="font-bold text-blue-900 text-xs">Own Inventory Fabric</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {project.ownProjectStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="space-y-1 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Inventory Buffer Target:</span>
                      <strong className="text-slate-900">{fmtM(ownTotal)}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-sans text-slate-600">Received into Stock:</span>
                      <strong className="text-blue-700">{fmtM(ownReceived)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stage Pipeline Table */}
            {stages.length > 0 && (
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-2">
                  2. Stage Execution Pipeline & Status
                </h3>
                <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs">
                  <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Seq</th>
                      <th className="px-3 py-2">Stage Name</th>
                      <th className="px-3 py-2">Department</th>
                      <th className="px-3 py-2">Assigned Party / Vendor</th>
                      <th className="px-3 py-2 text-right">Weight</th>
                      <th className="px-3 py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {stages.map((stg, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-slate-400">{stg.sequence || i + 1}</td>
                        <td className="px-3 py-2 font-sans font-semibold text-slate-800">{stg.name}</td>
                        <td className="px-3 py-2 font-sans text-slate-500">{stg.department || 'Production'}</td>
                        <td className="px-3 py-2 font-sans text-slate-700">{stg.assignedToName || stg.vendorName || '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-600">{stg.weight ? `${stg.weight}%` : '—'}</td>
                        <td className="px-3 py-2 text-right font-sans">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            stg.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' :
                            stg.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                            stg.status === 'Delayed' ? 'bg-rose-50 text-rose-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {stg.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Official Signatures Grid */}
            <div className="pt-8 grid grid-cols-3 gap-6 text-center border-t border-slate-200">
              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="manager" label="Project Manager" modalType="authorized" className="h-10" defaultDesignation="Project Manager" />
                </div>
                <p className="font-bold text-slate-800 text-xs">Project Manager</p>
                <p className="text-[10px] text-slate-400">PMS Operations</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="production" label="Production In-Charge" modalType="authorized" className="h-10" defaultDesignation="Production In-Charge" />
                </div>
                <p className="font-bold text-slate-800 text-xs">Production In-Charge</p>
                <p className="text-[10px] text-slate-400">Weaving & Mill Coordination</p>
              </div>

              <div className="space-y-1">
                <div className="border-b border-dashed border-slate-300 pb-1">
                  <SignatureSlot doc={docSigs} signatory="commercial" label="Commercial Controller" modalType="authorized" className="h-10" defaultDesignation="Commercial Controller" />
                </div>
                <p className="font-bold text-slate-800 text-xs">Commercial Controller</p>
                <p className="text-[10px] text-slate-400">Audited & Approved</p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintProjectModal;
