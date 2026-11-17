import React, { useState, useMemo } from 'react';
import Modal from '../../../components/ui/Modal';
import { Phone, PhoneCall, Calendar, Clock, CheckCircle2, User, FileText } from 'lucide-react';
import { useCrmStore } from '../../../stores/crmStore';
import { useAppStore } from '../../../stores/appStore';
import { useLeadDetailStore } from '../../../stores/leadDetailStore';
import { getCurrentISODate, addDaysISO } from '../../../utils/dateUtils';

const CALL_TYPES = [
  'Outgoing Call',
  'Incoming Call',
  'Follow-up Call',
  'Fabric Sample Discussion',
  'Rate Discussion',
  'Client Visit',
];

const CALL_OUTCOMES = [
  'Interested - Positive',
  'Quotation Requested',
  'Sample Swatch Requested',
  'Follow-up Needed',
  'Order Confirmed',
  'Call Rescheduled / Busy',
  'Not Interested',
];

export default function LogCallModal({ isOpen, onClose }) {
  const leads = useCrmStore((s) => s.leads);
  const createTask = useCrmStore((s) => s.createTask);
  const currentUser = useAppStore((s) => s.currentUser);
  const showToast = useAppStore((s) => s.showToast);

  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [callType, setCallType] = useState('Outgoing Call');
  const [outcome, setOutcome] = useState('Interested - Positive');
  const [notes, setNotes] = useState('');
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState(() => addDaysISO(getCurrentISODate(), 2));
  const [followUpTitle, setFollowUpTitle] = useState('Follow-up call with client');
  const [submitting, setSubmitting] = useState(false);

  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads.slice(0, 30);
    const q = leadSearch.toLowerCase().trim();
    return leads.filter((l) => (
      String(l.name || '').toLowerCase().includes(q) ||
      String(l.company || '').toLowerCase().includes(q) ||
      String(l.phone || '').includes(q)
    )).slice(0, 30);
  }, [leads, leadSearch]);

  const selectedLead = useMemo(() => {
    return leads.find((l) => String(l.id) === String(selectedLeadId)) || null;
  }, [leads, selectedLeadId]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!selectedLeadId) {
      showToast?.('Please select a lead/prospect.', { type: 'error' });
      return;
    }
    if (!notes.trim()) {
      showToast?.('Please enter discussion notes or call summary.', { type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      const fullNoteText = `[${callType} • ${outcome} • ${nowStr}]\n${notes.trim()}`;

      // 1. Add note to lead sub-collection
      await useLeadDetailStore.getState().add(selectedLeadId, 'notes', {
        text: fullNoteText,
        body: fullNoteText,
        author: currentUser?.name || 'admin',
      });

      // 2. Optionally create follow-up task
      if (scheduleFollowUp && followUpDate) {
        await createTask({
          title: followUpTitle.trim() || `Follow-up: ${selectedLead?.name || 'Lead'}`,
          leadId: selectedLeadId,
          leadName: selectedLead?.name || '',
          company: selectedLead?.company || '',
          dueDate: followUpDate,
          priority: 'Medium',
          status: 'Open',
          owner: currentUser?.name || 'Unassigned',
          source: 'Manual',
        });
      }

      showToast?.(`Call note logged for ${selectedLead?.name || 'lead'}.`, { type: 'success' });

      // Reset and close
      setNotes('');
      setSelectedLeadId('');
      setLeadSearch('');
      setScheduleFollowUp(false);
      onClose();
    } catch (err) {
      console.error('[LogCallModal] Error logging call note:', err);
      showToast?.('Failed to save call note. Please try again.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 grid place-items-center">
            <PhoneCall size={18} />
          </span>
          <div>
            <div className="text-base font-bold text-slate-900">Log Call / Discussion Note</div>
            <div className="text-xs font-normal text-slate-500">Record call outcome and client discussion in 1 minute</div>
          </div>
        </div>
      }
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition flex items-center gap-1.5"
          >
            {submitting ? 'Saving...' : 'Save Call Note'}
          </button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        {/* Lead Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Select Lead / Client <span className="text-red-500">*</span>
          </label>
          <div className="space-y-1.5">
            <input
              type="text"
              placeholder="Type to search lead by name, company, or phone..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
            />
            <select
              value={selectedLeadId}
              onChange={(e) => {
                setSelectedLeadId(e.target.value);
                const leadObj = leads.find((l) => String(l.id) === e.target.value);
                if (leadObj) {
                  setFollowUpTitle(`Follow-up call with ${leadObj.name}`);
                }
              }}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              <option value="">-- Choose a lead ({filteredLeads.length} available) --</option>
              {filteredLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.company ? `(${l.company})` : ''} {l.phone ? `• ${l.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
          {selectedLead && (
            <div className="mt-1.5 text-[11px] text-slate-600 flex items-center gap-2 bg-blue-50/60 p-2 rounded-lg border border-blue-100">
              <User size={13} className="text-blue-600" />
              <span>
                <strong>{selectedLead.name}</strong>
                {selectedLead.company ? ` • ${selectedLead.company}` : ''}
                {selectedLead.status ? ` • Stage: ${selectedLead.status}` : ''}
              </span>
            </div>
          )}
        </div>

        {/* Call Type & Outcome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Call / Activity Type
            </label>
            <select
              value={callType}
              onChange={(e) => setCallType(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {CALL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Call Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            >
              {CALL_OUTCOMES.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Discussion Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Discussion Summary / Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What was discussed? (e.g. Inquired about 60s cotton navy grey fabric 5,000m, target rate ₹58/m, asked for sample delivery tomorrow)"
            className="w-full text-xs p-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Schedule Follow-up Checkbox */}
        <div className="pt-2 border-t border-slate-200">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
            <input
              type="checkbox"
              checked={scheduleFollowUp}
              onChange={(e) => setScheduleFollowUp(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Schedule Next Follow-up Task?</span>
          </label>

          {scheduleFollowUp && (
            <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                    Task Title
                  </label>
                  <input
                    type="text"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                    placeholder="Task title"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
