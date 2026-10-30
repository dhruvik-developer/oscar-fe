import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  AlertCircle,
  MoreVertical,
  Eye,
  FileEdit,
} from 'lucide-react';
import { getProjectRowMeta } from '../../../../stores/pmsStore';
import AppPagination from '../../../../components/ui/AppPagination';
import { useTableSort } from '../../../../hooks/useTableSort';
import { SortableTh } from '../../../../components/ui/SortableTh';

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getAvatarBg(name = '') {
  const char = (name || 'A').toUpperCase().charCodeAt(0);
  const colors = [
    'bg-[#1e293b]', // Ravi Shah / navy
    'bg-[#059669]', // Sneha Patel / emerald
    'bg-[#0f766e]', // Karan Mehta / dark teal
    'bg-[#2563eb]', // Priya Desai / blue
    'bg-[#991b1b]', // Amit Joshi / maroon
    'bg-[#dc2626]', // Neha Shah / red
  ];
  return colors[char % colors.length];
}

export function ProjectsTable({
  projects = [],
  emptyTitle = 'No projects found',
  emptyDesc = 'No project matches the current filters.',
  emptyAction,
}) {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [actionMenuOpenId, setActionMenuOpenId] = useState(null);

  // Derive row metadata
  const rows = useMemo(() => {
    return projects.map((p) => {
      const meta = getProjectRowMeta(p);
      const isOverdue =
        p.isOverdue ||
        meta.isOverdue ||
        (p.expectedCompletionDate &&
          new Date(p.expectedCompletionDate).getTime() < Date.now() &&
          p.status !== 'Completed');

      return {
        ...p,
        _meta: meta,
        isOverdue,
      };
    });
  }, [projects]);

  const total = rows.length;

  const sort = useTableSort(rows, {
    accessors: {
      code: (r) => r.code || r.id,
      crmOrderId: (r) => r.crmOrderId || 'SO-026-0001',
      projectManager: (r) => r.projectManager?.name || 'Unassigned',
      requirementMeters: (r) => Number(r.requirementMeters ?? r.productDetails?.quantity ?? 0),
      dyeingSentMeters: (r) => Number(r.dyeingSentMeters ?? 0),
      customerProject: (r) => Number(r.customerProjectReceivedMeters ?? 0),
      ownProject: (r) => Number(r.ownProjectReceivedMeters ?? 0),
      paymentStatus: (r) => r.paymentStatus || 'Pending',
      status: (r) => r.status || 'In Progress',
      completion: (r) => Math.min(100, Math.max(0, r.overallCompletionPct ?? 0)),
    },
  });

  // Current page records
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sort.rows.slice(start, start + pageSize);
  }, [sort.rows, currentPage, pageSize]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1250px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              <SortableTh sort={sort} sortKey="code" className="py-3 px-3.5 whitespace-nowrap">PROJECT ID</SortableTh>
              <SortableTh sort={sort} sortKey="customerName" className="py-3 px-3.5 whitespace-nowrap">CUSTOMER</SortableTh>
              <SortableTh sort={sort} sortKey="crmOrderId" className="py-3 px-3.5 whitespace-nowrap">ORDER / ITEM</SortableTh>
              <SortableTh sort={sort} sortKey="projectManager" className="py-3 px-3.5 whitespace-nowrap">PROJECT MANAGER</SortableTh>
              <th className="py-3 px-3.5 whitespace-nowrap">TYPE</th>
              <SortableTh sort={sort} sortKey="requirementMeters" className="py-3 px-3.5 whitespace-nowrap text-right" align="right">REQUIREMENT (m)</SortableTh>
              <SortableTh sort={sort} sortKey="dyeingSentMeters" className="py-3 px-3.5 whitespace-nowrap text-right" align="right">DYEING SENT (m)</SortableTh>
              <SortableTh sort={sort} sortKey="customerProject" className="py-3 px-3.5 whitespace-nowrap">CUSTOMER PROJECT</SortableTh>
              <SortableTh sort={sort} sortKey="ownProject" className="py-3 px-3.5 whitespace-nowrap">OWN PROJECT</SortableTh>
              <SortableTh sort={sort} sortKey="paymentStatus" className="py-3 px-3.5 whitespace-nowrap text-center" align="center">PAYMENT STATUS</SortableTh>
              <SortableTh sort={sort} sortKey="status" className="py-3 px-3.5 whitespace-nowrap text-center" align="center">OVERALL STATUS</SortableTh>
              <SortableTh sort={sort} sortKey="completion" className="py-3 px-3.5 whitespace-nowrap min-w-[130px]">COMPLETION</SortableTh>
              <SortableTh sort={sort} sortKey="startDate" className="py-3 px-3.5 whitespace-nowrap">START DATE</SortableTh>
              <SortableTh sort={sort} sortKey="expectedCompletionDate" className="py-3 px-3.5 whitespace-nowrap">EXPECTED END</SortableTh>
              <th className="py-3 px-3.5 whitespace-nowrap text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={15} className="py-12 text-center text-slate-400">
                  <p className="font-semibold text-slate-600 mb-1">{emptyTitle}</p>
                  <p className="text-xs text-slate-400 mb-3">{emptyDesc}</p>
                  {emptyAction}
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => {
                const reqM = Number(row.requirementMeters ?? row.productDetails?.quantity ?? 0);
                const dyeM = Number(row.dyeingSentMeters ?? 0);

                const custRec = Number(row.customerProjectReceivedMeters ?? 0);
                const custTot = Number(row.customerProjectTotalMeters ?? reqM);
                const custStatus = row.customerProjectStatus || (row.status === 'Completed' || custRec > 0 ? 'Fabric Received' : 'Pending');

                const ownRec = Number(row.ownProjectReceivedMeters ?? 0);
                const ownTot = Number(row.ownProjectTotalMeters ?? (dyeM > reqM ? dyeM - reqM : 0));
                const ownStatus = row.ownProjectStatus || (ownRec > 0 ? 'Fabric Received' : 'Pending');

                const paymentStatus = row.paymentStatus || 'Pending';
                const overallStatus = row.status || 'In Progress';
                const completionPct = Math.min(100, Math.max(0, row.overallCompletionPct ?? 0));

                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/pms/projects/${row.id}`)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    {/* PROJECT ID */}
                    <td className="py-3.5 px-3.5 font-bold whitespace-nowrap">
                      <Link
                        to={`/pms/projects/${row.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
                      >
                        {row.code || row.id}
                      </Link>
                    </td>

                    {/* CUSTOMER */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap font-semibold text-slate-900">
                      {row.customerName || '—'}
                    </td>

                    {/* ORDER / ITEM */}
                    <td className="py-3.5 px-3.5 min-w-[160px]">
                      <div className="font-semibold text-slate-800 text-xs">
                        {row.crmOrderId || 'SO-026-0001'}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[170px] mt-0.5">
                        {row.productDetails?.productName || row.productName || 'Grey Fabric'}
                      </div>
                    </td>

                    {/* PROJECT MANAGER */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full text-white flex items-center justify-center font-bold text-xs shrink-0 ${getAvatarBg(
                            row.projectManager?.name
                          )}`}
                        >
                          {(row.projectManager?.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 text-xs whitespace-nowrap">
                          {row.projectManager?.name || 'Unassigned'}
                        </span>
                      </div>
                    </td>

                    {/* TYPE */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-[10.5px] font-semibold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded leading-tight">
                          Customer Project
                        </span>
                        <span className="text-[10.5px] font-semibold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded leading-tight">
                          Own Project
                        </span>
                      </div>
                    </td>

                    {/* REQUIREMENT (m) */}
                    <td className="py-3.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {reqM.toLocaleString()}
                    </td>

                    {/* DYEING SENT (m) */}
                    <td className="py-3.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {dyeM.toLocaleString()}
                    </td>

                    {/* CUSTOMER PROJECT */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div
                        className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-2 min-w-[130px] ${
                          custStatus === 'Fabric Received' && custRec >= custTot && custTot > 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : custStatus === 'Fabric Received' || custRec > 0
                              ? 'bg-amber-50 border-amber-200 text-amber-800'
                              : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="shrink-0">
                          {custStatus === 'Fabric Received' && custRec >= custTot && custTot > 0 ? (
                            <CheckCircle2 size={16} className="text-emerald-600" />
                          ) : custStatus === 'Fabric Received' || custRec > 0 ? (
                            <CheckCircle2 size={16} className="text-amber-600" />
                          ) : (
                            <Clock size={16} className="text-slate-400" />
                          )}
                        </div>
                        <div className="leading-tight flex-1">
                          <div className="font-semibold text-[10.5px]">{custStatus}</div>
                          <div className="font-bold flex items-center gap-1 text-[11px]">
                            <span>
                              {custRec.toLocaleString()} / {custTot.toLocaleString()}
                            </span>
                            <ExternalLink size={10} className="opacity-60" />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* OWN PROJECT */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div
                        className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-2 min-w-[120px] ${
                          ownStatus === 'Fabric Received' || ownRec > 0
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="shrink-0">
                          {ownStatus === 'Fabric Received' || ownRec > 0 ? (
                            <CheckCircle2 size={16} className="text-emerald-600" />
                          ) : (
                            <Clock size={16} className="text-slate-400" />
                          )}
                        </div>
                        <div className="leading-tight flex-1">
                          <div className="font-semibold text-[10.5px]">{ownStatus}</div>
                          <div className="font-bold flex items-center gap-1 text-[11px]">
                            <span>
                              {ownRec.toLocaleString()} / {ownTot.toLocaleString()}
                            </span>
                            <ExternalLink size={10} className="opacity-60" />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* PAYMENT STATUS */}
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          paymentStatus === 'Paid'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : paymentStatus === 'Overdue'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            paymentStatus === 'Paid'
                              ? 'bg-emerald-500'
                              : paymentStatus === 'Overdue'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                          }`}
                        />
                        {paymentStatus}
                      </span>
                    </td>

                    {/* OVERALL STATUS */}
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          overallStatus === 'Completed'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : overallStatus === 'Delayed'
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : overallStatus === 'Partial' || overallStatus === 'Partial Received'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : overallStatus === 'Dyeing'
                                  ? 'bg-sky-50 border-sky-200 text-sky-700'
                                  : overallStatus === 'Draft'
                                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}
                      >
                        {overallStatus === 'Completed' ? (
                          <CheckCircle2 size={12} className="text-emerald-600" />
                        ) : overallStatus === 'Delayed' ? (
                          <AlertCircle size={12} className="text-rose-600" />
                        ) : overallStatus === 'Partial' || overallStatus === 'Partial Received' ? (
                          <Clock size={12} className="text-amber-600" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                        {overallStatus}
                        {(overallStatus === 'Partial' || overallStatus === 'Partial Received') && (
                          <ExternalLink size={9} className="opacity-70 ml-0.5" />
                        )}
                      </span>
                    </td>

                    {/* COMPLETION */}
                    <td className="py-3.5 px-3.5 min-w-[130px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500 font-medium">Progress</span>
                        <span
                          className={`font-bold ${
                            completionPct === 100
                              ? 'text-emerald-600'
                              : completionPct > 0
                                ? 'text-rose-600'
                                : 'text-slate-500'
                          }`}
                        >
                          {completionPct}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            completionPct === 100
                              ? 'bg-emerald-500'
                              : completionPct > 0
                                ? 'bg-rose-500'
                                : 'bg-slate-300'
                          }`}
                          style={{ width: `${completionPct}%` }}
                        />
                      </div>
                    </td>

                    {/* START DATE */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap text-xs text-slate-700 font-medium">
                      {formatDate(row.startDate)}
                    </td>

                    {/* EXPECTED END */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap">
                      <div className="text-xs text-slate-700 font-medium">
                        {formatDate(row.expectedCompletionDate)}
                      </div>
                      {row.isOverdue && (
                        <div className="text-[11px] font-bold text-rose-600 mt-0.5">
                          Overdue
                        </div>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="py-3.5 px-3.5 text-center whitespace-nowrap relative">
                      <div
                        className="flex items-center justify-center gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => navigate(`/pms/projects/${row.id}`)}
                          className="px-3 py-1 rounded-lg border border-blue-400 text-blue-600 hover:bg-blue-50 font-semibold text-xs transition cursor-pointer"
                        >
                          View
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionMenuOpenId(actionMenuOpenId === row.id ? null : row.id);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition cursor-pointer"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {actionMenuOpenId === row.id && (
                            <div className="absolute right-0 top-8 z-30 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 text-xs text-slate-700">
                              <button
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  navigate(`/pms/projects/${row.id}`);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                              >
                                <Eye size={13} className="text-blue-600" /> View Details
                              </button>
                              <button
                                onClick={() => {
                                  setActionMenuOpenId(null);
                                  navigate(`/pms/delays?project=${row.id}`);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 flex items-center gap-1.5"
                              >
                                <AlertCircle size={13} className="text-rose-600" /> Log Delay
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AppPagination
        total={total}
        page={currentPage}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        pageSizeOptions={[6, 10, 20, 50]}
      />
    </div>
  );
}

export default ProjectsTable;
