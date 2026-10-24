import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import MasterSourceLink from '../../../components/common/MasterSourceLink';

/* Shared bits for the lead ⋮ quick actions. Every modal is controlled by
   LeadsPage: it passes the lead, option lists, and an onSave that writes
   server-first with a local fallback. */

function Field({ label, required, children, wide, source }) {
  return (
    <label
      className="grid gap-1.5 text-xs font-semibold text-slate-600"
      style={wide ? { gridColumn: '1 / -1' } : undefined}
    >
      <span className="flex items-center justify-between">
        <span>
          {label}
          {required && <span className="text-rose-500"> *</span>}
        </span>
        {source && <MasterSourceLink source={source} />}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400';

function ModalFooter({ onClose, onSave, saveLabel, disabled }) {
  return (
    <>
      <button type="button" className="btn-outline" onClick={onClose}>
        Cancel
      </button>
      <button type="button" className="btn-primary" onClick={onSave} disabled={disabled}>
        {saveLabel}
      </button>
    </>
  );
}

function useResetOnOpen(isOpen, reset) {
  useEffect(() => {
    if (isOpen) reset?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}

/** Downscale an image file to a small data URL for inline storage. */
export function fileToSmallDataUrl(file, max = 512) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    img.src = url;
  });
}

// ── 1. Create Task ─────────────────────────────────────────────
// Sample visit follow-up with due date + salesperson. The backend requires
// every task to have a lead or deal parent (ck_crm_task_parent) — the lead
// here is always set by the caller.
export function CreateLeadTaskModal({ isOpen, lead, members = [], onClose, onSave }) {
  const [title, setTitle] = useState('Sample visit follow-up');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [assigneeId, setAssigneeId] = useState('');
  const [priority, setPriority] = useState('Medium');
  useResetOnOpen(isOpen, () => {
    setTitle('Sample visit follow-up');
    setDueDate(new Date().toISOString().slice(0, 10));
    setAssigneeId('');
    setPriority('Medium');
  });
  if (!isOpen) return null;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Create Task"
      subtitle={`${lead?.name || 'Lead'} — linked automatically as the parent`}
      footer={
        <ModalFooter
          onClose={onClose}
          saveLabel="Create Task"
          disabled={!title.trim()}
          onSave={() => onSave({ title: title.trim(), dueDate, assigneeId, priority })}
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Task Title" required wide>
          <input
            className={inputCls}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sample visit follow-up"
          />
        </Field>
        <Field label="Due Date" required>
          <input
            type="date"
            className={inputCls}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
        <Field label="Priority">
          <select className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)}>
            {['Low', 'Medium', 'High', 'Urgent'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Salesperson" wide source="users">
          <select
            className={inputCls}
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {(members || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

// ── 2. Issue Sample ────────────────────────────────────────────
// Which taka + how many meters the broker took. Writes a LeadProduct row
// plus an optional photo file row.
export function IssueSampleModal({ isOpen, lead, onClose, onSave }) {
  const [design, setDesign] = useState('');
  const [takaNo, setTakaNo] = useState('');
  const [meters, setMeters] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const fileRef = useRef(null);
  useResetOnOpen(isOpen, () => {
    setDesign('');
    setTakaNo('');
    setMeters('');
    setNotes('');
    setPhoto('');
    setPhotoError('');
  });
  if (!isOpen) return null;

  async function handlePhoto(file) {
    if (!file) return;
    setPhotoError('');
    try {
      setPhoto(await fileToSmallDataUrl(file));
    } catch {
      setPhotoError('Could not read that image.');
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Issue Sample"
      subtitle={`${lead?.name || 'Lead'} — records the taka and meters cut`}
      footer={
        <ModalFooter
          onClose={onClose}
          saveLabel="Issue Sample"
          disabled={!design.trim()}
          onSave={() =>
            onSave({
              design: design.trim(),
              takaNo: takaNo.trim(),
              meters: Number(meters) || 0,
              notes: notes.trim(),
              photo,
            })
          }
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Design / Product" required wide>
          <input
            className={inputCls}
            value={design}
            autoFocus
            onChange={(e) => setDesign(e.target.value)}
            placeholder="e.g. Floral Georgette — Red"
          />
        </Field>
        <Field label="Taka No.">
          <input
            className={inputCls}
            value={takaNo}
            onChange={(e) => setTakaNo(e.target.value)}
            placeholder="e.g. Taka 14"
          />
        </Field>
        <Field label="Meters Cut">
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={meters}
            onChange={(e) => setMeters(e.target.value)}
            placeholder="e.g. 5"
          />
        </Field>
        <Field label="Notes" wide>
          <textarea
            rows={2}
            className={`${inputCls} h-auto py-2 resize-y`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Broker name, condition, return date…"
          />
        </Field>
        <Field label="Sample Photo" wide>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
          <div className="flex items-center gap-3">
            <button type="button" className="btn-outline" onClick={() => fileRef.current?.click()}>
              {photo ? 'Change Photo' : 'Upload Photo'}
            </button>
            {photo && (
              <img
                src={photo}
                alt="Sample preview"
                className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
              />
            )}
          </div>
          {photoError && <small className="text-xs font-normal text-rose-600">{photoError}</small>}
        </Field>
      </div>
    </Modal>
  );
}

// ── 3. Convert to Deal ─────────────────────────────────────────
// Rate offer for a design + colour. Links Deal.lead; a quotation can be
// attached to the deal later (Deal.quotation).
export function ConvertDealModal({ isOpen, lead, onClose, onSave }) {
  const defaultTitle = `${lead?.company || lead?.name || 'Lead'} — Rate offer`;
  const [title, setTitle] = useState(defaultTitle);
  const [rate, setRate] = useState('');
  const [expectedCloseDate, setExpectedCloseDate] = useState('');
  const [designColour, setDesignColour] = useState('');
  useResetOnOpen(isOpen, () => {
    setTitle(`${lead?.company || lead?.name || 'Lead'} — Rate offer`);
    setRate('');
    setExpectedCloseDate('');
    setDesignColour('');
  });
  if (!isOpen) return null;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Convert to Deal"
      subtitle={`${lead?.name || 'Lead'} — opens at Draft stage, linked to this lead`}
      footer={
        <ModalFooter
          onClose={onClose}
          saveLabel="Create Deal"
          disabled={!title.trim()}
          onSave={() =>
            onSave({
              title: title.trim(),
              rate: Number(rate) || 0,
              expectedCloseDate,
              designColour: designColour.trim(),
            })
          }
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Deal Title" required wide>
          <input
            className={inputCls}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Customer — Rate offer"
          />
        </Field>
        <Field label="Rate Offered (₹)">
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="e.g. 25000"
          />
        </Field>
        <Field label="Expected Close Date">
          <input
            type="date"
            className={inputCls}
            value={expectedCloseDate}
            onChange={(e) => setExpectedCloseDate(e.target.value)}
          />
        </Field>
        <Field label="Design + Colour" wide>
          <input
            className={inputCls}
            value={designColour}
            onChange={(e) => setDesignColour(e.target.value)}
            placeholder="e.g. Floral Georgette — Red"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ── 4. Convert to Party ────────────────────────────────────────
// When the buyer becomes regular. Creates a Customer party (feeds Sales
// Orders) and links it on Lead.party.
export function ConvertPartyModal({ isOpen, lead, onClose, onSave }) {
  const defaultName = lead?.company || lead?.name || '';
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(lead?.phone || '');
  const [email, setEmail] = useState(lead?.email || '');
  useResetOnOpen(isOpen, () => {
    setName(lead?.company || lead?.name || '');
    setPhone(lead?.phone || '');
    setEmail(lead?.email || '');
  });
  if (!isOpen) return null;
  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Convert to Party"
      subtitle="Creates a Customer party for Sales Orders and links it to this lead"
      footer={
        <ModalFooter
          onClose={onClose}
          saveLabel="Create Party"
          disabled={!name.trim()}
          onSave={() => onSave({ name: name.trim(), phone: phone.trim(), email: email.trim() })}
        />
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Party Name" required wide>
          <input
            className={inputCls}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Customer / company name"
          />
        </Field>
        <Field label="Phone">
          <input
            className={inputCls}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className={inputCls}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
          />
        </Field>
      </div>
    </Modal>
  );
}
