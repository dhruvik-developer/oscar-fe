import React, { useEffect, useState } from 'react';
import { AlertCircle, Link2, Copy, Check, ExternalLink, Ban, RefreshCw, Factory } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import {
  fetchProductionLink,
  issueProductionLink,
  revokeProductionLink,
  productionLinkUrl,
} from '../../../../services/pmsSync';

/**
 * ProductionLinkModal — the project's shareable daily production entry link.
 *
 * Whoever opens the link gets the Daily Production Entry form for this
 * project's production instructions only, without signing in. The link stays
 * the same until it is regenerated or revoked, so it can be pinned on the
 * shop floor or sent to the production team once.
 */

function stamp(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function ProductionLinkModal({ isOpen, onClose, project }) {
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const projectId = project?.id;

  useEffect(() => {
    if (!isOpen || !projectId) return;
    let cancelled = false;
    setError(null);
    setCopied(false);
    setLoading(true);
    fetchProductionLink(projectId)
      .then((row) => { if (!cancelled) setLink(row); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load the production link.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, projectId]);

  const url = link?.token ? productionLinkUrl(link.token) : '';

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      setLink(await action());
      setCopied(false);
    } catch (err) {
      setError(err?.message || 'The request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Clipboard access was blocked — select the link and copy it manually.');
    }
  }

  function handleRegenerate() {
    if (!window.confirm('Generate a new link? The current link will stop working immediately.')) return;
    run(() => issueProductionLink(projectId, { regenerate: true }));
  }

  function handleRevoke() {
    if (!window.confirm('Revoke this link? Anyone using it will no longer be able to record production.')) return;
    run(() => revokeProductionLink(projectId));
  }

  if (!project) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daily Production Entry Link"
      subtitle={`${project.id}${project.customerName ? ` — ${project.customerName}` : ''}`}
      size="lg"
      footer={
        link ? (
          <>
            <Button variant="secondary" type="button" icon={Ban} onClick={handleRevoke} disabled={busy}>
              Revoke Link
            </Button>
            <Button variant="secondary" type="button" icon={RefreshCw} onClick={handleRegenerate} disabled={busy}>
              Regenerate
            </Button>
            <Button type="button" onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              icon={Link2}
              onClick={() => run(() => issueProductionLink(projectId))}
              disabled={busy || loading}
            >
              Generate Link
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <section className="rounded-lg border border-[#dce5f4] bg-[#f6f9ff] p-3 flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <Factory size={15} className="text-teal-600" />
          </span>
          <div className="text-[11px] text-slate-600 leading-relaxed">
            Employees who open this link see the <b>Daily Production Entry</b> form for this project's
            production instructions and can record produced, rejected and reprocess meters — no sign-in needed.
            Each project has its own link. Entries appear in PMS › Production › Daily Production.
          </div>
        </section>

        {loading ? (
          <p className="text-xs text-slate-500">Loading link…</p>
        ) : link ? (
          <section className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-600">Shareable link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 text-xs font-mono rounded-lg border border-[#dce5f4] bg-white px-3 py-2 text-slate-700"
              />
              <Button type="button" size="sm" icon={copied ? Check : Copy} onClick={copyLink}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 rounded-lg border border-[#dce5f4] text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink size={13} /> Open
              </a>
            </div>
            <p className="text-[10.5px] text-slate-500">
              Created {stamp(link.createdAt)} · Last entry via link {stamp(link.lastUsedAt)}
            </p>
          </section>
        ) : (
          <p className="text-xs text-slate-500">No link has been generated for this project yet.</p>
        )}

        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-1.5">
            <AlertCircle size={14} className="shrink-0" /> {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
