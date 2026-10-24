import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Sliders,
  Search,
  Filter,
  Check,
  X,
  FileText,
  User,
  ArrowRight,
  Plus,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import KpiCard from '../../components/ui/KpiCard';
import { approvalService } from '../../services/domainServices';

const DOCUMENT_TYPE_LABELS = {
  purchase_order_rate: 'PO Rate Change / Excess',
  jobwork_order_rate: 'Job-Work Rate Change',
  jobwork_wastage: 'Job-Work Wastage > Tolerance',
  reprocess_order: 'Reprocess / Write-Off',
  discount_limit: 'Sales Discount > Authority',
  below_margin_sale: 'Sale Below Min Margin',
  credit_limit_exceeded: 'Credit Limit / Days Exceeded',
  stock_adjustment: 'Manual Stock Adjustment',
  brokerage_rate_change: 'Brokerage % Change',
  incentive_adjustment: 'Incentive Adjustment',
  standalone_note: 'Debit / Credit Note',
  vendor_bill_mismatch: 'Vendor Bill 3-Way Mismatch',
  production_final_po: 'Final PO Post-Verification',
};

const urgencyPill = (urgency) => {
  if (urgency === 'Urgent') return 'bg-rose-100 text-rose-700 border-rose-300 font-bold animate-pulse';
  if (urgency === 'High') return 'bg-amber-100 text-amber-700 border-amber-300 font-semibold';
  return 'bg-slate-100 text-slate-600 border-slate-200';
};

const statusPill = (status) => {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200 font-medium';
  if (status === 'Rejected') return 'bg-rose-50 text-rose-700 border-rose-200 font-medium';
  if (status === 'Returned') return 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
  return 'bg-amber-50 text-amber-700 border-amber-200 font-medium';
};

export default function ApprovalsInboxPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' | 'rules'
  const [requests, setRequests] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [badgeCount, setBadgeCount] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [docTypeFilter, setDocTypeFilter] = useState('All');

  // Decision Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decisionAction, setDecisionAction] = useState('Approved'); // 'Approved' | 'Rejected'
  const [comments, setComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create Rule Modal
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    document_type: 'discount_limit',
    condition_type: 'threshold_percent',
    threshold_value: '',
    approver_role_code: 'sales_manager',
    min_level: 1,
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reqRes, rulesRes, badgeRes] = await Promise.all([
        approvalService.getRequests(),
        approvalService.getRules(),
        approvalService.getRequestBadge(),
      ]);
      setRequests(reqRes.results || reqRes || []);
      setRules(rulesRes.results || rulesRes || []);
      setBadgeCount(badgeRes.pendingCount || 0);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDecision = async () => {
    if (!selectedRequest) return;
    setSubmitting(true);
    try {
      if (decisionAction === 'Approved') {
        await approvalService.approveRequest(selectedRequest.id, { comments });
      } else if (decisionAction === 'Returned') {
        await approvalService.returnRequest(selectedRequest.id, { comments });
      } else {
        await approvalService.rejectRequest(selectedRequest.id, { comments });
      }
      setSelectedRequest(null);
      setComments('');
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to submit approval decision');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleRule = async (rule) => {
    setSubmitting(true);
    try {
      await approvalService.updateRule(rule.id, { is_active: !rule.is_active });
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to update approval rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Delete approval rule "${rule.name}"? Requests already raised under it are kept.`)) return;
    setSubmitting(true);
    try {
      await approvalService.deleteRule(rule.id);
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to delete approval rule');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await approvalService.createRule({
        ...newRule,
        threshold_value: newRule.threshold_value ? parseFloat(newRule.threshold_value) : 0,
      });
      setShowRuleModal(false);
      setNewRule({
        name: '',
        document_type: 'discount_limit',
        condition_type: 'threshold_percent',
        threshold_value: '',
        approver_role_code: 'sales_manager',
        min_level: 1,
        is_active: true,
      });
      await loadData();
    } catch (err) {
      alert(err?.message || 'Failed to create approval rule');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (docTypeFilter !== 'All' && r.document_type !== docTypeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const docRef = (r.document_number || r.document_id || '').toLowerCase();
        const reason = (r.reason || '').toLowerCase();
        const user = (r.requested_by_name || '').toLowerCase();
        if (!docRef.includes(q) && !reason.includes(q) && !user.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, docTypeFilter, search]);

  const kpis = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'Pending').length;
    const approved = requests.filter((r) => r.status === 'Approved').length;
    const rejected = requests.filter((r) => r.status === 'Rejected').length;
    return { pending, approved, rejected, totalRules: rules.length };
  }, [requests, rules]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval Engine & Inbox"
        subtitle="Operational authorization points, variance thresholds, and exception controls."
      >
        <div className="flex gap-2">
          {activeTab === 'rules' && (
            <button
              onClick={() => setShowRuleModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Approval Rule
            </button>
          )}
        </div>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{kpis.pending}</div>
            <div className="text-xs text-slate-500 font-medium">Pending Approvals</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{kpis.approved}</div>
            <div className="text-xs text-slate-500 font-medium">Approved Records</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{kpis.rejected}</div>
            <div className="text-xs text-slate-500 font-medium">Rejected Records</div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800">{kpis.totalRules}</div>
            <div className="text-xs text-slate-500 font-medium">Active Approval Rules</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'inbox'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          My Approvals Inbox
          {badgeCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold">
              {badgeCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Configured Approval Rules
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* TAB 1: INBOX */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center flex-1">
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search document no, requester, reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg w-full focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending Only</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Returned">Returned for Correction</option>
              </select>
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 outline-none bg-white font-medium text-slate-700"
              >
                <option value="All">All Document Types</option>
                {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold">{filteredRequests.length}</span> request(s)
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Document / Type</th>
                    <th className="py-3 px-4">Requester</th>
                    <th className="py-3 px-4">Reason & Justification</th>
                    <th className="py-3 px-4">Variance / Value</th>
                    <th className="py-3 px-4">Urgency</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Loading approval requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No approval requests found matching the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {req.document_number || req.document_id}
                          </div>
                          <div className="text-xs text-indigo-600 font-medium">
                            {DOCUMENT_TYPE_LABELS[req.document_type] || req.document_type}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-medium text-slate-800">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {req.requested_by_name || 'System User'}
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <div className="line-clamp-2 text-xs text-slate-600">
                            {req.reason || 'No justification provided'}
                          </div>
                          {req.comments && (
                            <div className="mt-1 text-xs text-slate-400 italic">
                              Note: {req.comments}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {req.variance_amount != null && (
                            <div className="font-semibold text-slate-800">
                              ₹{parseFloat(req.variance_amount).toLocaleString('en-IN')}
                            </div>
                          )}
                          {req.variance_pct != null && (
                            <div className="text-xs text-amber-600 font-medium">
                              +{parseFloat(req.variance_pct).toFixed(2)}%
                            </div>
                          )}
                          {req.variance_amount == null && req.variance_pct == null && (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${urgencyPill(
                              req.urgency
                            )}`}
                          >
                            {req.urgency}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {req.created_at ? new Date(req.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 text-xs rounded-full border ${statusPill(
                              req.status
                            )}`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex gap-1.5 items-center">
                            {req.status === 'Pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setDecisionAction('Approved');
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setDecisionAction('Returned');
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-sm transition"
                                >
                                  Return
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setDecisionAction('Rejected');
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-sm transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => {
                                const docType = req.document_type || '';
                                if (docType === 'purchase_order' || docType.includes('purchase')) {
                                  navigate('/purchase/orders');
                                } else if (docType.includes('bill') || docType.includes('vendor')) {
                                  navigate('/purchase/vendor-bills');
                                } else if (docType.includes('qc')) {
                                  navigate('/inventory/qc');
                                } else if (docType.includes('jobwork')) {
                                  navigate('/job-work/orders');
                                } else if (docType.includes('final_po')) {
                                  navigate('/purchase/final-job-work-pos');
                                } else if (docType.includes('stock')) {
                                  navigate('/inventory/stock-position');
                                } else {
                                  navigate('/dashboard');
                                }
                              }}
                              className="px-2 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
                            >
                              View Source
                            </button>
                          </div>
                          {req.status !== 'Pending' && req.decided_by_name && (
                            <span className="text-xs text-slate-400 font-medium ml-2">
                              Decided by {req.decided_by_name}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-4">Rule Name</th>
                    <th className="py-3 px-4">Document Type</th>
                    <th className="py-3 px-4">Condition Type</th>
                    <th className="py-3 px-4">Threshold</th>
                    <th className="py-3 px-4">Approver Role</th>
                    <th className="py-3 px-4">Min Level</th>
                    <th className="py-3 px-4 text-right">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {rules.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No approval rules configured yet. Create a rule to enforce authorization thresholds.
                      </td>
                    </tr>
                  ) : (
                    rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-semibold text-slate-900">{rule.name}</td>
                        <td className="py-3 px-4 text-indigo-600 font-medium text-xs">
                          {DOCUMENT_TYPE_LABELS[rule.document_type] || rule.document_type}
                        </td>
                        <td className="py-3 px-4 text-slate-600 capitalize text-xs">
                          {rule.condition_type.replace('_', ' ')}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          {rule.threshold_value > 0 ? (
                            rule.condition_type.includes('percent') ? (
                              <span>&gt; {parseFloat(rule.threshold_value)}%</span>
                            ) : (
                              <span>&ge; ₹{parseFloat(rule.threshold_value).toLocaleString('en-IN')}</span>
                            )
                          ) : (
                            <span className="text-slate-400">Always Required</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium text-xs">
                          {rule.approver_role_name || rule.approver_role_code || 'Owner / Super Admin'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-xs">Level {rule.min_level}</td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`px-2 py-0.5 text-xs rounded-full border ${
                              rule.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleToggleRule(rule)}
                            className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:underline disabled:opacity-50"
                          >
                            {rule.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => handleDeleteRule(rule)}
                            className="px-2 py-1 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DECISION MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                {decisionAction === 'Approved' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-600" />
                )}
                Confirm {decisionAction} Decision
              </h3>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border text-xs space-y-1.5 text-slate-700">
              <div>
                <span className="font-semibold text-slate-900">Document:</span>{' '}
                {selectedRequest.document_number || selectedRequest.document_id} (
                {DOCUMENT_TYPE_LABELS[selectedRequest.document_type] || selectedRequest.document_type})
              </div>
              <div>
                <span className="font-semibold text-slate-900">Requester:</span>{' '}
                {selectedRequest.requested_by_name || 'System User'}
              </div>
              <div>
                <span className="font-semibold text-slate-900">Reason:</span>{' '}
                {selectedRequest.reason || 'None provided'}
              </div>
              {selectedRequest.variance_pct != null && (
                <div>
                  <span className="font-semibold text-slate-900">Variance:</span> +
                  {selectedRequest.variance_pct}%
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Approver Comments / Instructions
              </label>
              <textarea
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add any authorization notes, special conditions, or reason for rejection..."
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDecision}
                disabled={submitting}
                className={`px-4 py-2 text-xs font-bold text-white rounded-lg shadow-sm transition ${
                  decisionAction === 'Approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : decisionAction === 'Returned'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submitting ? 'Submitting...' : `Confirm ${decisionAction}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateRule}
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Configure New Approval Rule
              </h3>
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sales Discount Above 5% Requires Sales Manager"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Document / Exception Point</label>
                <select
                  value={newRule.document_type}
                  onChange={(e) => setNewRule({ ...newRule, document_type: e.target.value })}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none bg-white font-medium text-slate-800"
                >
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Condition Type</label>
                  <select
                    value={newRule.condition_type}
                    onChange={(e) => setNewRule({ ...newRule, condition_type: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none bg-white"
                  >
                    <option value="always">Always Require Approval</option>
                    <option value="threshold_amount">Amount Exceeds ₹</option>
                    <option value="threshold_percent">Percentage Exceeds %</option>
                    <option value="variance_percent">Variance Exceeds Tolerance %</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Threshold Value</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    disabled={newRule.condition_type === 'always'}
                    value={newRule.threshold_value}
                    onChange={(e) => setNewRule({ ...newRule, threshold_value: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Approver Role Code</label>
                  <select
                    value={newRule.approver_role_code}
                    onChange={(e) => setNewRule({ ...newRule, approver_role_code: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none bg-white"
                  >
                    <option value="owner">Owner / Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="sales_manager">Sales Manager</option>
                    <option value="purchase_manager">Purchase Manager</option>
                    <option value="accounts">Accounts</option>
                    <option value="godown_manager">Godown / Inventory Manager</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hierarchy Level</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={newRule.min_level}
                    onChange={(e) => setNewRule({ ...newRule, min_level: parseInt(e.target.value) || 1 })}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowRuleModal(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition"
              >
                {submitting ? 'Saving...' : 'Save Approval Rule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
