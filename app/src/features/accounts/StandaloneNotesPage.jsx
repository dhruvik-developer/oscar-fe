import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  BookOpen,
  Filter,
  DollarSign,
  AlertCircle,
  X,
  ExternalLink,
} from 'lucide-react';
import PageHeader from '../../components/ui/PageHeader';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import MasterSourceLink from '../../components/common/MasterSourceLink';
import { accountingService, partiesService } from '../../services/domainServices';
import {
  formatINR,
  formatDate,
  unwrapList,
  describeApiError,
  todayISO,
  inputClass,
  labelClass,
} from './accountingShared';

const STATUS_PILLS = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-300',
  'Pending Approval': 'bg-amber-50 text-amber-800 border-amber-300',
  Approved: 'bg-blue-50 text-blue-800 border-blue-300',
  Posted: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  Cancelled: 'bg-rose-50 text-rose-800 border-rose-300',
};

const DOC_TYPE_LABELS = {
  INVOICE: 'Sales Invoice',
  BILL: 'Purchase Bill',
  JWO: 'Job Work Order',
  SALES_RETURN: 'Sales Return',
  PURCHASE_RETURN: 'Purchase Return',
  MANUAL: 'Manual / Direct',
};

export default function StandaloneNotesPage() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [parties, setParties] = useState([]);
  const [partiesLoading, setPartiesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Cancel Modal
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Detail Modal
  const [viewingNote, setViewingNote] = useState(null);

  // Form State
  const initialForm = {
    note_type: 'CREDIT_NOTE',
    party: '',
    note_date: todayISO(),
    against_document_type: 'INVOICE',
    against_document_number: '',
    taxable_amount: '',
    cgst: '',
    sgst: '',
    igst: '',
    reason_notes: '',
    notes: '',
  };
  const [form, setForm] = useState(initialForm);

  const loadNotes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await accountingService.getStandaloneNotes();
      setNotes(unwrapList(res));
    } catch (err) {
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadParties = async () => {
    if (parties.length > 0) return;
    setPartiesLoading(true);
    try {
      const res = await partiesService.getParties({ page_size: 200 });
      setParties(unwrapList(res));
    } catch {
      // non-fatal
    } finally {
      setPartiesLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleOpenCreate = () => {
    setForm(initialForm);
    setFormError('');
    setShowCreateModal(true);
    loadParties();
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const calculatedTotal = useMemo(() => {
    const taxable = parseFloat(form.taxable_amount) || 0;
    const cgst = parseFloat(form.cgst) || 0;
    const sgst = parseFloat(form.sgst) || 0;
    const igst = parseFloat(form.igst) || 0;
    return taxable + cgst + sgst + igst;
  }, [form.taxable_amount, form.cgst, form.sgst, form.igst]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!form.party) {
      setFormError('Please select a party.');
      return;
    }
    if (!form.taxable_amount || parseFloat(form.taxable_amount) <= 0) {
      setFormError('Taxable amount must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const payload = {
        note_type: form.note_type,
        party: form.party,
        note_date: form.note_date,
        against_document_type: form.against_document_type,
        against_document_number: form.against_document_number || undefined,
        taxable_amount: parseFloat(form.taxable_amount) || 0,
        cgst: parseFloat(form.cgst) || 0,
        sgst: parseFloat(form.sgst) || 0,
        igst: parseFloat(form.igst) || 0,
        reason_notes: form.reason_notes || undefined,
        notes: form.notes || undefined,
      };
      await accountingService.createStandaloneNote(payload);
      setShowCreateModal(false);
      loadNotes();
    } catch (err) {
      setFormError(describeApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForApproval = async (note) => {
    try {
      await accountingService.approveStandaloneNote(note.id);
      loadNotes();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  const handlePostNote = async (note) => {
    try {
      await accountingService.postStandaloneNote(note.id);
      loadNotes();
    } catch (err) {
      alert(describeApiError(err));
    }
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await accountingService.cancelStandaloneNote(cancelTarget.id, { reason: cancelReason });
      setCancelTarget(null);
      setCancelReason('');
      loadNotes();
    } catch (err) {
      alert(describeApiError(err));
    } finally {
      setCancelling(false);
    }
  };

  // KPI Calculations
  const stats = useMemo(() => {
    const totalCount = notes.length;
    let pendingCount = 0;
    let creditTotal = 0;
    let debitTotal = 0;

    for (const n of notes) {
      if (n.status === 'Draft' || n.status === 'Pending Approval') {
        pendingCount += 1;
      }
      const amt = parseFloat(n.total_amount || n.totalAmount || 0);
      if (n.note_type === 'CREDIT_NOTE' && n.status !== 'Cancelled') {
        creditTotal += amt;
      } else if (n.note_type === 'DEBIT_NOTE' && n.status !== 'Cancelled') {
        debitTotal += amt;
      }
    }

    return { totalCount, pendingCount, creditTotal, debitTotal };
  }, [notes]);

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      if (selectedType !== 'ALL' && n.note_type !== selectedType) return false;
      if (selectedStatus !== 'ALL' && n.status !== selectedStatus) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const num = String(n.note_number || n.noteNumber || '').toLowerCase();
        const party = String(n.party_name || n.party?.name || n.partyName || '').toLowerCase();
        const against = String(n.against_document_number || n.againstDocumentNumber || '').toLowerCase();
        if (!num.includes(q) && !party.includes(q) && !against.includes(q)) return false;
      }
      return true;
    });
  }, [notes, selectedType, selectedStatus, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Debit / Credit Notes"
        subtitle="Manage standalone commercial adjustments against sales invoices, purchase bills, job work orders, or manual adjustments."
        actions={
          <Button icon={Plus} onClick={handleOpenCreate} className="!rounded-lg !bg-blue-600 hover:!bg-blue-700">
            Create Note
          </Button>
        }
      />

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Notes" value={loading ? '…' : stats.totalCount} icon={FileText} />
        <StatCard
          label="Pending Approval / Draft"
          value={loading ? '…' : stats.pendingCount}
          icon={Clock}
          tone="amber"
        />
        <StatCard
          label="Total Credit Notes"
          value={loading ? '…' : formatINR(stats.creditTotal)}
          icon={DollarSign}
          tone="blue"
        />
        <StatCard
          label="Total Debit Notes"
          value={loading ? '…' : formatINR(stats.debitTotal)}
          icon={DollarSign}
          tone="emerald"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#dce5f4] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search note #, party, against doc #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[#dce5f4] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-[#dce5f4] rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
            >
              <option value="ALL">All Types</option>
              <option value="CREDIT_NOTE">Credit Note</option>
              <option value="DEBIT_NOTE">Debit Note</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="border border-[#dce5f4] rounded-lg px-2.5 py-1.5 bg-white text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Posted">Posted</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <span className="text-slate-400 font-mono">
          Showing {filteredNotes.length} of {notes.length} notes
        </span>
      </div>

      {/* Notes Table */}
      <div className="bg-white border border-[#dce5f4] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#dce5f4] text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Note #</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Party</th>
                <th className="py-3 px-4">Against Document</th>
                <th className="py-3 px-4 text-right">Taxable</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dce5f4]">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Loading standalone notes…
                  </td>
                </tr>
              ) : filteredNotes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No debit or credit notes found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note) => {
                  const isCredit = note.note_type === 'CREDIT_NOTE';
                  const noteNumber = note.note_number || note.noteNumber || '—';
                  const partyName = note.party_name || note.party?.name || note.partyName || '—';
                  const docType = DOC_TYPE_LABELS[note.against_document_type] || note.against_document_type || '—';
                  const docNum = note.against_document_number || note.againstDocumentNumber;
                  const total = parseFloat(note.total_amount || note.totalAmount || 0);
                  const taxable = parseFloat(note.taxable_amount || note.taxableAmount || 0);

                  return (
                    <tr key={note.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-600">{noteNumber}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                            isCredit
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isCredit ? 'Credit Note' : 'Debit Note'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(note.note_date || note.noteDate)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{partyName}</td>
                      <td className="py-3 px-4 text-slate-600">
                        <div>
                          <span>{docType}</span>
                          {docNum && <span className="block font-mono text-slate-400 text-[10px]">#{docNum}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">{formatINR(taxable)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{formatINR(total)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                            STATUS_PILLS[note.status] || 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {note.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setViewingNote(note)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition cursor-pointer"
                            title="View Note Details"
                          >
                            Details
                          </button>

                          {note.status === 'Draft' && (
                            <button
                              onClick={() => handleSubmitForApproval(note)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Submit for Approval"
                            >
                              <Send className="w-3 h-3" /> Submit
                            </button>
                          )}

                          {note.status === 'Approved' && (
                            <button
                              onClick={() => handlePostNote(note)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Post to General Ledger"
                            >
                              <BookOpen className="w-3 h-3" /> Post GL
                            </button>
                          )}

                          {note.status !== 'Cancelled' && note.status !== 'Posted' && (
                            <button
                              onClick={() => {
                                setCancelTarget(note);
                                setCancelReason('');
                              }}
                              className="px-2 py-1 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded text-[11px] font-medium transition cursor-pointer"
                              title="Cancel Note"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NOTE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-5 shadow-2xl text-xs flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-[#1F2E4A] flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Create Standalone Debit / Credit Note
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-2.5 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 overflow-y-auto pr-1 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Note Type *</label>
                  <select
                    name="note_type"
                    value={form.note_type}
                    onChange={handleFormChange}
                    className={inputClass}
                    required
                  >
                    <option value="CREDIT_NOTE">Credit Note (Credit to Party)</option>
                    <option value="DEBIT_NOTE">Debit Note (Debit to Party)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Note Date *</label>
                  <input
                    type="date"
                    name="note_date"
                    value={form.note_date}
                    onChange={handleFormChange}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-semibold text-slate-600">Party (Customer / Vendor) *</label>
                  <MasterSourceLink source="parties" />
                </div>
                <select
                  name="party"
                  value={form.party}
                  onChange={handleFormChange}
                  className={inputClass}
                  required
                >
                  <option value="">{partiesLoading ? 'Loading parties…' : 'Select a party…'}</option>
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.party_type ? `(${p.party_type})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Against Document Type</label>
                  <select
                    name="against_document_type"
                    value={form.against_document_type}
                    onChange={handleFormChange}
                    className={inputClass}
                  >
                    <option value="INVOICE">Sales Invoice</option>
                    <option value="BILL">Purchase Bill</option>
                    <option value="JWO">Job Work Order</option>
                    <option value="SALES_RETURN">Sales Return</option>
                    <option value="PURCHASE_RETURN">Purchase Return</option>
                    <option value="MANUAL">Manual / Direct</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Against Document Number</label>
                  <input
                    type="text"
                    name="against_document_number"
                    placeholder="e.g. INV-2026-001"
                    value={form.against_document_number}
                    onChange={handleFormChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                  Amount Breakdown
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className={labelClass}>Taxable Amt *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="taxable_amount"
                      placeholder="0.00"
                      value={form.taxable_amount}
                      onChange={handleFormChange}
                      className={inputClass}
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>CGST</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="cgst"
                      placeholder="0.00"
                      value={form.cgst}
                      onChange={handleFormChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>SGST</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="sgst"
                      placeholder="0.00"
                      value={form.sgst}
                      onChange={handleFormChange}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>IGST</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="igst"
                      placeholder="0.00"
                      value={form.igst}
                      onChange={handleFormChange}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <span className="font-semibold text-slate-600">Total Note Amount:</span>
                  <span className="font-mono font-bold text-sm text-slate-900">{formatINR(calculatedTotal)}</span>
                </div>
              </div>

              <div>
                <label className={labelClass}>Reason Notes</label>
                <textarea
                  name="reason_notes"
                  rows={2}
                  placeholder="Specify commercial justification (e.g. rate difference, quantity shortage, rebate)..."
                  value={form.reason_notes}
                  onChange={handleFormChange}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : 'Create Draft Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW NOTE DETAIL MODAL */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-5 shadow-2xl text-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[#1F2E4A] font-mono">
                  {viewingNote.note_number || viewingNote.noteNumber}
                </h3>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                    STATUS_PILLS[viewingNote.status] || ''
                  }`}
                >
                  {viewingNote.status}
                </span>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Note Type</span>
                  <span className="font-bold text-slate-800">
                    {viewingNote.note_type === 'CREDIT_NOTE' ? 'Credit Note' : 'Debit Note'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Date</span>
                  <span className="font-semibold text-slate-700">
                    {formatDate(viewingNote.note_date || viewingNote.noteDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Party</span>
                  <span className="font-semibold text-slate-800">
                    {viewingNote.party_name || viewingNote.party?.name || viewingNote.partyName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Against Document</span>
                  <span className="font-semibold text-slate-700">
                    {DOC_TYPE_LABELS[viewingNote.against_document_type] || viewingNote.against_document_type || '—'}{' '}
                    {viewingNote.against_document_number ? `(#${viewingNote.against_document_number})` : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Taxable Amount:</span>
                  <span className="font-mono font-semibold">
                    {formatINR(viewingNote.taxable_amount || viewingNote.taxableAmount)}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">CGST:</span>
                  <span className="font-mono">{formatINR(viewingNote.cgst)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">SGST:</span>
                  <span className="font-mono">{formatINR(viewingNote.sgst)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">IGST:</span>
                  <span className="font-mono">{formatINR(viewingNote.igst)}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-slate-200 text-sm font-bold">
                  <span className="text-slate-800">Total Note Amount:</span>
                  <span className="font-mono text-blue-600">
                    {formatINR(viewingNote.total_amount || viewingNote.totalAmount)}
                  </span>
                </div>
              </div>

              {viewingNote.reason_notes && (
                <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                  <span className="text-[10px] uppercase font-bold text-amber-800 block">Reason / Justification</span>
                  <p className="text-slate-700 mt-0.5">{viewingNote.reason_notes}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                onClick={() => setViewingNote(null)}
                className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl text-xs flex flex-col">
            <h3 className="font-bold text-base text-[#1F2E4A] mb-1">
              Cancel Note {cancelTarget.note_number || cancelTarget.noteNumber}?
            </h3>
            <p className="text-slate-600 mb-3">
              This will cancel the note and reverse any pending approval. Please specify a cancellation reason:
            </p>

            <form onSubmit={handleCancelSubmit} className="space-y-4">
              <textarea
                required
                rows={3}
                placeholder="Reason for cancellation..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className={inputClass}
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCancelTarget(null)}
                  className="px-3 py-1.5 border border-slate-300 hover:bg-slate-100 rounded-lg font-medium text-slate-700 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelling}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Confirm Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
