import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PenTool, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import DigitalSignatureModal from './DigitalSignatureModal';

/**
 * Loads and saves the e-signatures of one printable document through the
 * generic `/signatures/` store. Pass the result to every <SignatureSlot> on
 * that document. With no documentId the slots render as plain blank lines.
 */
export function useDocumentSignatures(documentType, documentId, documentTitle = '') {
  const [signatures, setSignatures] = useState({});
  const [saving, setSaving] = useState(false);
  const enabled = Boolean(documentType && documentId);

  useEffect(() => {
    if (!enabled) { setSignatures({}); return undefined; }
    let live = true;
    api.get(`/signatures/?documentType=${encodeURIComponent(documentType)}&documentId=${encodeURIComponent(documentId)}`)
      .then((res) => live && setSignatures(res?.signatures || {}))
      .catch(() => live && setSignatures({}));
    return () => { live = false; };
  }, [enabled, documentType, documentId]);

  const save = useCallback(async (signatoryType, signature) => {
    setSaving(true);
    try {
      const res = await api.post('/signatures/', { documentType, documentId, signatoryType, signature });
      setSignatures(res?.signatures || {});
    } finally {
      setSaving(false);
    }
  }, [documentType, documentId]);

  return { enabled, signatures, save, saving, documentTitle };
}

/** A saved e-signature as it appears on a printed document. */
export function SignatureMark({ sig, className = 'h-12' }) {
  return (
    <div className={`${className} flex flex-col items-center justify-end`}>
      {sig.type === 'digital_stamp' ? (
        <div className="border border-emerald-600 text-emerald-800 rounded px-2 py-0.5 text-[9px] leading-tight text-center">
          <div className="flex items-center justify-center gap-1 font-bold"><ShieldCheck size={10} /> E-SIGNED</div>
          <div className="font-bold text-[10px]">{sig.name}</div>
        </div>
      ) : (
        <img src={sig.signatureData} alt={`Signature of ${sig.name}`} className="max-h-full max-w-[160px] object-contain" />
      )}
    </div>
  );
}

/**
 * One signature line. Unsigned: a "Sign digitally" button on screen and blank
 * space on paper. Signed: the stamp / drawn image plus signer, designation
 * and timestamp, with a screen-only "remove" link.
 *
 * `doc` is the useDocumentSignatures() result; `signatory` is the slot key.
 * `modalType` is 'authorized' (our side) or 'receiver' (the other party).
 */
export function SignatureSlot({
  doc,
  signatory,
  label = 'Signature',
  modalType = 'authorized',
  defaultName = '',
  defaultDesignation = '',
  className = 'h-12',
  placeholder = null,
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const sig = doc?.signatures?.[signatory];

  const remove = async () => {
    if (!window.confirm('Remove this signature?')) return;
    setError('');
    try {
      await doc.save(signatory, null);
    } catch (err) {
      setError(err?.message || 'Could not remove the signature.');
    }
  };

  if (!doc?.enabled) {
    return <div className={`${className} flex items-end justify-center`}>{placeholder}</div>;
  }

  return (
    <div className="w-full">
      {sig ? (
        <>
          <SignatureMark sig={sig} className={className} />
          <div className="text-[9px] text-slate-500 leading-tight text-center">
            {sig.name}{sig.designation ? `, ${sig.designation}` : ''}
            {sig.signedAt && <> · {new Date(sig.signedAt).toLocaleString('en-IN')}</>}
            <button type="button" onClick={remove} className="ml-1 text-rose-600 hover:underline no-print">remove</button>
          </div>
        </>
      ) : (
        <>
          <div className={`${className} flex items-end justify-center pb-1 no-print`}>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="px-2.5 py-1 rounded border border-dashed border-blue-400 text-blue-700 bg-white hover:bg-blue-50 text-[10px] font-bold inline-flex items-center gap-1"
            >
              <PenTool size={11} /> Sign digitally
            </button>
          </div>
          <div className={`${className} hidden print:flex items-end justify-center`}>{placeholder}</div>
        </>
      )}
      {error && <div className="text-[10px] text-rose-600 text-center no-print">{error}</div>}
      {open && createPortal(
        <DigitalSignatureModal
          isOpen
          onClose={() => setOpen(false)}
          signatoryType={modalType}
          documentTitle={[doc.documentTitle, label].filter(Boolean).join(' — ')}
          defaultName={defaultName}
          defaultDesignation={defaultDesignation}
          onSave={(s) => doc.save(signatory, s)}
          isSaving={doc.saving}
        />,
        document.body,
      )}
    </div>
  );
}

export default SignatureSlot;
