import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, RefreshCw, Building2, FileText } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { usePmsStore, validateApprovalDecision } from '../../../stores/pmsStore';

/**
 * ClientApprovalModal — the client approval simulator.
 *
 * Stands in for an external client portal so both outcomes can be exercised
 * without a backend. "Need Improvement" demands a revision reason; the store
 * enforces that too, so the rule holds even if this dialog is bypassed.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

export function ClientApprovalModal({ isOpen, onClose, project, stage, document: doc, onDecided }) {
  const decideDocument = usePmsStore((s) => s.decideDocument);
  const showToast = usePmsStore((s) => s.showToast);

  const [decision, setDecision] = useState('Approved');
  const [approverName, setApproverName] = useState('');
  const [comments, setComments] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isOpen) return;
    setDecision('Approved');
    setApproverName(project?.customerName ?? '');
    setComments('');
    setRevisionReason('');
    setErrors({});
  }, [isOpen, project]);

  function handleSubmit(e) {
    e.preventDefault();
    const found = validateApprovalDecision(decision, { revisionReason, approverName });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    try {
      decideDocument(
        project.id,
        stage.id,
        doc.id,
        decision,
        {
          comments: comments.trim(),
          revisionReason: revisionReason.trim(),
          approverName: approverName.trim(),
          approverType: 'Client',
        },
        project.projectManager
      );
      showToast(
        isRevision ? `Revision requested on v${doc.version}.0.` : `v${doc.version}.0 approved by ${approverName.trim()}.`,
        isRevision ? 'info' : 'success'
      );
      onDecided?.(decision);
      onClose?.();
    } catch (err) {
      setErrors({ submit: err.message });
    }
  }

  if (!project || !stage || !doc) return null;

  const isRevision = decision === 'Need Improvement';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Client Approval Portal"
      subtitle="Simulated client-facing review"
      size="lg"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="pms-client-approval"
            icon={isRevision ? RefreshCw : Check}
            variant={isRevision ? 'danger' : 'primary'}
          >
            {isRevision ? 'Request Revision' : 'Approve Design'}
          </Button>
        </>
      }
    >
      <form id="pms-client-approval" onSubmit={handleSubmit} className="space-y-4">
        {/* What the client is looking at */}
        <section className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
              <Building2 size={15} className="text-slate-400" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">{project.customerName}</p>
              <p className="text-[11px] text-slate-600 truncate">
                {project.productDetails?.productName}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <FileText size={10} className="text-slate-400" />
                {doc.fileName}
                <span className="font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                  v{doc.version}.0
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Decision */}
        <fieldset>
          <legend className={labelClass}>Decision</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { value: 'Approved', label: 'Approve Design', hint: 'Unlocks handoff to the next stage.', icon: Check, tone: '#065f46', bg: '#d1fae5' },
              { value: 'Need Improvement', label: 'Need Improvement', hint: 'Returns the proof for a new version.', icon: RefreshCw, tone: '#9a3412', bg: '#ffedd5' },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = decision === opt.value;
              return (
                <label
                  key={opt.value}
                  className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors"
                  style={
                    active
                      ? { borderColor: opt.tone, background: opt.bg }
                      : { borderColor: '#dce5f4', background: '#fff' }
                  }
                >
                  <input
                    type="radio"
                    name="decision"
                    value={opt.value}
                    checked={active}
                    onChange={() => setDecision(opt.value)}
                    className="mt-0.5 accent-blue-600"
                  />
                  <span className="min-w-0">
                    <span
                      className="flex items-center gap-1.5 text-[11px] font-bold"
                      style={{ color: active ? opt.tone : '#334155' }}
                    >
                      <Icon size={12} /> {opt.label}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">{opt.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className={labelClass} htmlFor="approval-signer">
            Signed by <span className="text-rose-500">*</span>
          </label>
          <input
            id="approval-signer"
            type="text"
            className={fieldClass}
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            placeholder="Name of the person signing off"
          />
          {errors.approverName && (
            <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
              <AlertCircle size={11} /> {errors.approverName}
            </p>
          )}
        </div>

        {isRevision && (
          <div>
            <label className={labelClass} htmlFor="approval-reason">
              Revision reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="approval-reason"
              rows={3}
              className={fieldClass}
              value={revisionReason}
              onChange={(e) => setRevisionReason(e.target.value)}
              placeholder="e.g. Hole tolerance must be ±0.1 mm on the left bracket."
            />
            {errors.revisionReason && (
              <p className="flex items-center gap-1 text-[11px] text-rose-600 mt-1.5">
                <AlertCircle size={11} /> {errors.revisionReason}
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-1.5">
              The stage returns to “Need Improvement” and the designer is prompted for a new version.
            </p>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="approval-comments">
            {isRevision ? 'Additional notes' : 'Approval comments'}
          </label>
          <textarea
            id="approval-comments"
            rows={2}
            className={fieldClass}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Optional."
          />
        </div>

        {errors.submit && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
            {errors.submit}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default ClientApprovalModal;
