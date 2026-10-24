import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertCircle, Check, RefreshCw, Building2, FileText, ShieldCheck, Clock, Ban,
  Link2Off, CalendarClock, Package,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ProofViewer } from '../components/ProofViewer';
import { usePmsStore, validateApprovalDecision } from '../../../stores/pmsStore';
import { useProofShareStore, shareBlockReason } from '../../../stores/proofShareStore';
import { fetchPublicShare, decidePublicShare } from '../../../services/pmsSync';
import { isBackendEnabled } from '../../../services/resourceSync';
import { formatCurrency } from '../../../utils/currencyUtils';

/**
 * ClientProofApprovalPage — what the generated link opens.
 *
 * Renders outside the app shell: no sidebar, no topbar, nothing that assumes the
 * viewer is a staff member. It carries the drawing, the order and product
 * details, and the two decisions the client can make. The decision is written
 * through pmsStore.decideDocument, so the stage status, the approval thread and
 * the audit trail all update exactly as the internal portal would leave them.
 *
 * With no backend the token resolves against this browser's localStorage, so a
 * link opens on the machine that issued it.
 */

const fieldClass =
  'w-full text-xs rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1.5';

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Shell that every state of this page sits in, so the framing never shifts. */
function PortalShell({ children }) {
  return (
    <div className="min-h-screen bg-[#f4f7fc]">
      <header className="bg-white border-b border-[#dce5f4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={16} className="text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 tracking-tight leading-none">
              Design Approval Portal
            </p>
            <p className="text-[10.5px] text-slate-500 mt-0.5">Evenmore — Project Management</p>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-4">{children}</main>
      <footer className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 pt-2">
        <p className="text-[10.5px] text-slate-400 text-center">
          This link was issued for a single design approval. Contact your project manager if you
          need it re-sent.
        </p>
      </footer>
    </div>
  );
}

/** Terminal states — link dead, spent, or never existed. */
function PortalNotice({ icon: Icon, tone, title, body, detail }) {
  return (
    <PortalShell>
      <section className="rounded-xl border border-[#dce5f4] bg-white p-6 sm:p-8 shadow-2xs text-center">
        <span
          className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3"
          style={{ background: tone.bg }}
        >
          <Icon size={22} style={{ color: tone.fg }} />
        </span>
        <h1 className="text-base font-black text-slate-800">{title}</h1>
        <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto">{body}</p>
        {detail && (
          <div className="mt-4 inline-block rounded-lg border border-[#dce5f4] bg-[#f6f9ff] px-4 py-2.5 text-left">
            {detail}
          </div>
        )}
      </section>
    </PortalShell>
  );
}

/** Map a public-API failure to the terminal state it means. */
function blockFromError(err) {
  const msg = `${err?.message || ''}`.toLowerCase();
  if (err?.status === 409) {
    if (msg.includes('revok')) return 'revoked';
    if (msg.includes('expir')) return 'expired';
  }
  return 'invalid';
}

/** Shape the public payload into the { share, project, stage, doc } the page renders. */
function remoteFromPayload(token, P) {
  const D = P.document ?? {};
  return {
    share: {
      token,
      recipientName: P.recipientName ?? '',
      message: '',
      createdBy: '',
      expiresAt: P.expiresAt ?? null,
      openedAt: null,
      status: 'Active',
      decision: P.decision ?? null,
      decidedAt: P.decidedAt ?? null,
      decidedBy: '',
      revisionReason: '',
    },
    project: {
      id: P.project?.id ?? `remote-${token}`,
      code: P.project?.code ?? '',
      customerName: P.project?.customerName ?? '',
      productDetails: { productName: P.project?.productName ?? '' },
      crmOrderId: null,
      expectedCompletionDate: null,
    },
    stage: P.stage
      ? { id: P.stage.id, sequence: P.stage.sequence, name: P.stage.name }
      : { id: `stage-${token}`, sequence: '', name: 'Design proof' },
    doc: {
      id: D.id,
      fileName: D.fileName,
      fileSize: D.fileSize,
      version: D.version,
      previewUrl: D.previewUrl,
      uploadedAt: D.uploadedAt,
      comments: D.comments,
      approvalStatus: 'Pending',
    },
  };
}

export default function ClientProofApprovalPage() {
  const { token } = useParams();

  const projects = usePmsStore((s) => s.projects);
  const decideDocument = usePmsStore((s) => s.decideDocument);
  const shares = useProofShareStore((s) => s.shares);
  const markOpened = useProofShareStore((s) => s.markOpened);
  const recordDecision = useProofShareStore((s) => s.recordDecision);

  const localShare = useMemo(() => shares.find((s) => s.token === token) ?? null, [shares, token]);

  // Public mode: the link opened where the issuing browser's memory is
  // unavailable (new tab, client device). Resolve it via the public API —
  // the local store alone can never see it there.
  const [remote, setRemote] = useState(null);
  const [remoteState, setRemoteState] = useState('idle'); // idle|loading|ready|invalid|expired|revoked

  useEffect(() => {
    if (localShare || !token || !isBackendEnabled()) return;
    if (remote || remoteState !== 'idle') return;
    let cancelled = false;
    setRemoteState('loading');
    fetchPublicShare(token)
      .then((data) => {
        if (cancelled) return;
        setRemote(remoteFromPayload(token, data || {}));
        setRemoteState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setRemoteState(blockFromError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [localShare, token, remote, remoteState]);

  const share = localShare ?? remote?.share ?? null;
  const block = shareBlockReason(share);

  const project = useMemo(
    () => (localShare
      ? projects.find((p) => p.id === localShare.projectId) ?? null
      : remote?.project ?? null),
    [localShare, projects, remote]
  );
  const stage = useMemo(
    () => (localShare
      ? project?.stages?.find((s) => s.id === localShare.stageId) ?? null
      : remote?.stage ?? null),
    [localShare, project, remote]
  );
  const doc = useMemo(
    () => (localShare
      ? stage?.documents?.find((d) => d.id === localShare.documentId) ?? null
      : remote?.doc ?? null),
    [localShare, stage, remote]
  );

  const [decision, setDecision] = useState('Approved');
  const [approverName, setApproverName] = useState('');
  const [comments, setComments] = useState('');
  const [revisionReason, setRevisionReason] = useState('');
  const [errors, setErrors] = useState({});
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (share?.recipientName) setApproverName(share.recipientName);
  }, [share?.recipientName]);

  // Stamp the open so the project manager can see the client has looked at it.
  // Local mode only — the server stamps public opens on first fetch itself.
  useEffect(() => {
    if (localShare && !block) markOpened(localShare.token);
  }, [localShare, block, markOpened]);

  const isRevision = decision === 'Need Improvement';

  /**
   * Both buttons land here. Picking Reject without a reason yet does not submit —
   * it selects the option so the reason field appears, and flags what is missing.
   */
  function submitDecision(value) {
    setDecision(value);
    const found = validateApprovalDecision(value, { revisionReason, approverName });
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const by = approverName.trim();

    // Public mode: the client has no account, so the decision travels with
    // the link token instead of the staff write path.
    if (!localShare && remote) {
      decidePublicShare(share.token, {
        decision: value,
        decidedBy: by,
        comments: comments.trim(),
        revisionReason: revisionReason.trim(),
      })
        .then((res) => {
          setRemote((prev) => (prev ? {
            ...prev,
            share: {
              ...prev.share,
              decision: value,
              decidedAt: res?.decidedAt ?? new Date().toISOString(),
              decidedBy: by,
              revisionReason: revisionReason.trim(),
            },
          } : prev));
          setReceipt({ decision: value, at: new Date().toISOString(), by });
        })
        .catch((err) => {
          if (err?.status === 404 || err?.status === 409) {
            setRemoteState(blockFromError(err));
          } else {
            setErrors({ submit: err.message });
          }
        });
      return;
    }

    try {
      decideDocument(
        project.id,
        stage.id,
        doc.id,
        value,
        {
          comments: comments.trim(),
          revisionReason: revisionReason.trim(),
          approverName: by,
          approverType: 'Client',
        },
        { id: 'client-portal', name: by }
      );
      recordDecision(share.token, {
        decision: value,
        decidedBy: by,
        comments: comments.trim(),
        revisionReason: revisionReason.trim(),
      });
      setReceipt({ decision: value, at: new Date().toISOString(), by });
    } catch (err) {
      setErrors({ submit: err.message });
    }
  }

  // ── Terminal states ──

  if (remoteState === 'loading') {
    return (
      <PortalNotice
        icon={Clock}
        tone={{ bg: '#f6f9ff', fg: '#1f6bff' }}
        title="Checking this link…"
        body="Fetching the drawing and approval details."
      />
    );
  }

  if (remoteState === 'expired' || remoteState === 'revoked') {
    const withdrawn = remoteState === 'revoked';
    return (
      <PortalNotice
        icon={withdrawn ? Ban : CalendarClock}
        tone={withdrawn ? { bg: '#ffe4e6', fg: '#9f1239' } : { bg: '#fef3c7', fg: '#92400e' }}
        title={withdrawn ? 'This link has been withdrawn' : 'This link has expired'}
        body={
          withdrawn
            ? 'The project manager revoked this approval link. A newer version of the drawing may be on its way.'
            : 'The approval window for this link has closed. Ask your project manager to re-issue it.'
        }
      />
    );
  }

  if (!share) {
    return (
      <PortalNotice
        icon={Link2Off}
        tone={{ bg: '#f1f5f9', fg: '#64748b' }}
        title="This approval link is not valid"
        body="The link may have been mistyped, or it was issued from a different device. Ask your project manager to send a fresh one."
      />
    );
  }

  if (block === 'revoked') {
    return (
      <PortalNotice
        icon={Ban}
        tone={{ bg: '#ffe4e6', fg: '#9f1239' }}
        title="This link has been withdrawn"
        body={share.revokedReason || 'The project manager revoked this approval link. A newer version of the drawing may be on its way.'}
      />
    );
  }

  if (block === 'expired') {
    return (
      <PortalNotice
        icon={CalendarClock}
        tone={{ bg: '#fef3c7', fg: '#92400e' }}
        title="This link has expired"
        body={`The approval window closed on ${stamp(share.expiresAt)}. Ask your project manager to re-issue it.`}
      />
    );
  }

  if (!project || !stage || !doc) {
    return (
      <PortalNotice
        icon={AlertCircle}
        tone={{ bg: '#f1f5f9', fg: '#64748b' }}
        title="This drawing is no longer available"
        body="The project or the document this link pointed at has been removed."
      />
    );
  }

  const settled = receipt ?? (share.decision
    ? { decision: share.decision, at: share.decidedAt, by: share.decidedBy }
    : null);

  if (settled) {
    const approved = settled.decision === 'Approved';
    return (
      <PortalNotice
        icon={approved ? Check : RefreshCw}
        tone={approved ? { bg: '#d1fae5', fg: '#065f46' } : { bg: '#ffedd5', fg: '#9a3412' }}
        title={approved ? 'Design approved — thank you' : 'Revision requested'}
        body={
          approved
            ? 'Your approval has been recorded and the project team has been notified. Production can now proceed on this stage.'
            : 'Your feedback has been sent to the design team. They will issue a revised version for your review.'
        }
        detail={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              ['Drawing', `${doc.fileName} (v${doc.version}.0)`],
              ['Project', project.id],
              ['Decision by', settled.by || '—'],
              ['Recorded at', stamp(settled.at)],
              ...(share.revisionReason ? [['Reason given', share.revisionReason]] : []),
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[10px] text-slate-400">{k}</dt>
                <dd className="text-[11px] font-semibold text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        }
      />
    );
  }

  // ── The live approval view ──

  const productDetails = project.productDetails ?? {};

  return (
    <PortalShell>
      {/* Order & product details */}
      <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <span className="w-11 h-11 rounded-xl bg-[#f6f9ff] border border-[#dce5f4] flex items-center justify-center shrink-0">
            <Building2 size={19} className="text-blue-500" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl font-black text-slate-800 tracking-tight">{project.code || project.id}</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Awaiting your decision
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-700">{productDetails.productName}</p>

            <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
              {[
                ['Customer', project.customerName],
                ['Order reference', project.crmOrderId ?? '—'],
                ['Order value', formatCurrency(productDetails.orderValue ?? 0)],
                ['Quantity', productDetails.quantity ?? '—'],
                ['Stage', `${stage.sequence}. ${stage.name}`],
                ['Target delivery', stamp(project.expectedCompletionDate).split(',')[0]],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] text-slate-400 font-medium">{k}</dt>
                  <dd
                    className="text-[11px] font-semibold text-slate-700 truncate max-w-[220px]"
                    title={String(v)}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {productDetails.specifications && (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-600 bg-[#f6f9ff] border border-[#dce5f4] rounded-lg px-3 py-2 mt-4">
            <Package size={12} className="shrink-0 mt-0.5 text-blue-500" />
            <span><strong>Specification:</strong> {productDetails.specifications}</span>
          </p>
        )}

        {share.message && (
          <p className="flex items-start gap-1.5 text-[11px] text-slate-700 bg-white border border-[#dce5f4] rounded-lg px-3 py-2 mt-2">
            <FileText size={12} className="shrink-0 mt-0.5 text-slate-400" />
            <span>
              <strong>{share.createdBy || 'Your project manager'} wrote:</strong> {share.message}
            </span>
          </p>
        )}

        <p className="flex items-center gap-1.5 text-[10.5px] text-slate-400 mt-3">
          <Clock size={11} /> This link expires on {stamp(share.expiresAt)}.
        </p>
      </section>

      {/* The drawing itself */}
      <ProofViewer
        document={doc}
        projectName={productDetails.productName}
        readOnly
      />

      {/* Decision */}
      <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs">
        <h2 className="text-sm font-bold text-slate-800 mb-1">Your decision</h2>
        <p className="text-[11px] text-slate-500 mb-4">
          Reviewing <strong>{doc.fileName}</strong> (v{doc.version}.0). This can be submitted once.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); submitDecision(decision); }}
          className="space-y-4"
        >
          <fieldset>
            <legend className="sr-only">Decision</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                {
                  value: 'Approved',
                  label: 'Approve Design',
                  hint: 'Confirms the drawing and releases the next stage.',
                  icon: Check,
                  tone: '#065f46',
                  bg: '#d1fae5',
                },
                {
                  value: 'Need Improvement',
                  label: 'Reject — request changes',
                  hint: 'Sends it back for a revised version.',
                  icon: RefreshCw,
                  tone: '#9a3412',
                  bg: '#ffedd5',
                },
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
            <label className={labelClass} htmlFor="portal-signer">
              Your name <span className="text-rose-500">*</span>
            </label>
            <input
              id="portal-signer"
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
              <label className={labelClass} htmlFor="portal-reason">
                What needs to change <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="portal-reason"
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
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="portal-comments">
              {isRevision ? 'Additional notes' : 'Comments'}
            </label>
            <textarea
              id="portal-comments"
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 border-t border-[#dce5f4] pt-4">
            <Button
              type="button"
              size="lg"
              variant="danger"
              icon={RefreshCw}
              onClick={() => submitDecision('Need Improvement')}
            >
              Reject
            </Button>
            <Button
              type="button"
              size="lg"
              icon={Check}
              onClick={() => submitDecision('Approved')}
            >
              Approve
            </Button>
          </div>
        </form>
      </section>
    </PortalShell>
  );
}
