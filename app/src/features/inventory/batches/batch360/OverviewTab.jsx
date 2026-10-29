import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ClipboardCheck, Droplets, History, RefreshCcw, ShoppingCart, Undo2 } from 'lucide-react';
import { useERP } from '../../../../context/ERPContext';
import { inventoryService } from '../../../../services/domainServices';
import { describeApiError } from '../../../accounts/accountingShared';
import { batchUrl } from '../printBatchTag';
import { DeliverToOwnerForm } from '../CustomerMaterialPanels';
import RegisterTakasForm from '../RegisterTakasForm';
import { Card, Stat, btnGhost, btnPrimary, useBatchAction } from './shared';
import PurchaseTraceCard from './PurchaseTraceCard';

const QTY_TILES = [
  ['received', 'Received / produced'],
  ['available', 'Available'],
  ['reserved', 'Reserved'],
  ['qcHold', 'QC Hold'],
  ['rework', 'Rework'],
  ['secondQuality', 'Second Quality'],
  ['rejected', 'Rejected'],
  ['withJobWorker', 'At Job Worker'],
  ['sold', 'Sold (net)'],
  ['unregistered', 'Not yet in takas'],
];

/** The batch QR: it carries only the batch code -- opening it needs a login. */
function BatchQr({ code }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(batchUrl(code), { margin: 1, width: 160 })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [code]);
  return src
    ? <img src={src} alt={`QR code for batch ${code}`} className="w-32 h-32 rounded-lg border border-slate-200" />
    : <div className="w-32 h-32 rounded-lg border border-dashed border-slate-200" />;
}

export default function OverviewTab({ batch, onBatch, goTo }) {
  const { parties = [] } = useERP() || {};
  const q = batch.quantities || {};
  const uom = q.uom || 'm';
  const perms = batch.permissions || {};
  const [owner, setOwner] = useState(null);
  const [ownerError, setOwnerError] = useState('');
  const [typeForm, setTypeForm] = useState(null);
  const { busy, error, run } = useBatchAction(batch, onBatch);

  const saveOwner = async () => {
    setOwnerError('');
    try {
      onBatch(await inventoryService.setBatchOwnership(batch.batchCode, owner));
      setOwner(null);
    } catch (err) {
      setOwnerError(describeApiError(err) || 'Ownership could not be saved.');
    }
  };

  const own = batch.ownership === 'OSCAR';
  const hasRejected = Number(q.rejected) > 0;
  const actions = [
    { key: 'qc', icon: ClipboardCheck, label: 'Perform QC', hint: batch.qc?.state, show: true },
    { key: 'sales', icon: ShoppingCart, label: 'Sell fabric', hint: own ? `${q.available} ${uom} available` : 'Customer material — deliver to owner', show: own },
    { key: 'dyeing', icon: Droplets, label: 'Send for dyeing', hint: Number(q.withJobWorker) > 0 ? `${q.withJobWorker} ${uom} at job worker` : 'Job work / processing', show: true },
    { key: 'qc', icon: RefreshCcw, label: 'Send for reprocessing', hint: Number(q.rework) > 0 ? `${q.rework} ${uom} in rework` : 'From QC rework stock', show: true },
    { key: 'qc', icon: Undo2, label: 'Return to vendor', hint: hasRejected ? `${q.rejected} ${uom} rejected` : 'Needs rejected stock', show: batch.origin === 'PURCHASE' || hasRejected },
    { key: 'history', icon: History, label: 'View history', hint: `${(batch.timeline || []).length} events`, show: true },
  ].filter((a) => a.show);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <Card title="Batch details">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              ['Fabric type', `${batch.fabricTypeLabel}${batch.processed && batch.fabricType === 'GREY' ? ' → processed (dyed rolls in batch)' : ''}`],
              ['Fabric', batch.item],
              ['HSN (from item master)', batch.hsnCode],
              ['Quality / Design / Shade', [batch.fabricQuality, batch.design, batch.shade].filter(Boolean).join(' · ')],
              ['Width / GSM', [batch.width && `${batch.width}"`, batch.gsm && `${batch.gsm} GSM`].filter(Boolean).join(' · ')],
              ['Origin', batch.origin],
              ['Source', [batch.sourceDocumentType, batch.sourceDocumentNumber].filter(Boolean).join(' ')],
              ['Supplier', batch.supplierName],
              ['Created on', batch.createdOn],
              ['Lots', (batch.lots || []).join(', ')],
              ['Merged from', (batch.parentBatches || []).join(', ')],
              ['Notes', batch.notes],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
                <div className="font-semibold text-slate-800 break-words">{value || '—'}</div>
              </div>
            ))}
          </div>
          {perms.adjustStock && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              {typeForm ? (
                <>
                  <select value={typeForm.fabricType} onChange={(e) => setTypeForm({ ...typeForm, fabricType: e.target.value })} className="h-8 px-2 rounded-lg border border-slate-200" aria-label="Fabric type">
                    <option value="GREY">Grey fabric</option>
                    <option value="DYED">Dyed fabric</option>
                  </select>
                  <input value={typeForm.reason} onChange={(e) => setTypeForm({ ...typeForm, reason: e.target.value })} placeholder="Reason" className="h-8 px-2 rounded-lg border border-slate-200" />
                  <button type="button" disabled={busy} onClick={async () => { if (await run('fabric-type', typeForm)) setTypeForm(null); }} className="h-8 px-3 rounded-lg bg-blue-600 text-white font-semibold cursor-pointer">Save</button>
                  <button type="button" onClick={() => setTypeForm(null)} className="h-8 px-3 rounded-lg border border-slate-200 font-semibold cursor-pointer">Cancel</button>
                  {error && <span role="alert" className="text-rose-700">{error}</span>}
                </>
              ) : (
                <button type="button" onClick={() => setTypeForm({ fabricType: batch.fabricType, reason: '' })} className="h-7 px-2 rounded-md border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Correct fabric type</button>
              )}
            </div>
          )}
        </Card>
        <Card title="QR code" className="flex flex-col items-center">
          <BatchQr code={batch.batchCode} />
          <p className="mt-2 font-mono font-bold text-slate-800">{batch.batchCode}</p>
          <p className="text-[10px] text-slate-400 text-center max-w-40">Scanning shows the batch; cost and customer details need a login with access.</p>
        </Card>
      </div>

      <PurchaseTraceCard trace={batch.purchaseTrace} />

      <Card title="What do you want to do?" subtitle="Every step is optional — pick the one this batch needs. QC is not compulsory.">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {actions.map(({ key, icon: Icon, label, hint }) => (
            <button key={label} type="button" onClick={() => goTo(key)} className="text-left p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer">
              <Icon size={16} className="text-blue-600" />
              <div className="mt-1 font-semibold text-slate-800">{label}</div>
              {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
            </button>
          ))}
        </div>
      </Card>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {QTY_TILES.filter(([k]) => k !== 'unregistered' || Number(q.unregistered) > 0).map(([key, label]) => (
          <Stat key={key} label={label} value={q[key]} uom={uom} tone={key === 'available' ? 'text-emerald-700' : 'text-slate-900'} />
        ))}
      </section>

      <Card title="Material owner">
        {owner ? (
          <div className="flex flex-wrap items-center gap-2">
            <select value={owner.ownership} onChange={(e) => setOwner({ ...owner, ownership: e.target.value })} className="h-8 px-2 rounded-lg border border-slate-200" aria-label="Ownership">
              <option value="OSCAR">OSCAR (own stock)</option>
              <option value="CUSTOMER">Customer</option>
              <option value="THIRD_PARTY">Third party</option>
            </select>
            {owner.ownership !== 'OSCAR' && (
              <select value={owner.ownerPartyId || ''} onChange={(e) => setOwner({ ...owner, ownerPartyId: e.target.value })} className="h-8 px-2 rounded-lg border border-slate-200 max-w-56" aria-label="Owner">
                <option value="">Select party</option>
                {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <button type="button" onClick={saveOwner} className={btnPrimary}>Save</button>
            <button type="button" onClick={() => { setOwner(null); setOwnerError(''); }} className={btnGhost}>Cancel</button>
            {ownerError && <span role="alert" className="text-rose-700">{ownerError}</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-800">{own ? 'OSCAR (own stock — sellable)' : `${batch.ownerPartyName} (${batch.ownership === 'CUSTOMER' ? 'customer' : 'third-party'} material — not sellable, delivered to owner only)`}</span>
            {perms.adjustStock && <button type="button" onClick={() => setOwner({ ownership: batch.ownership, ownerPartyId: '' })} className="h-7 px-2 rounded-md border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Change</button>}
          </div>
        )}
      </Card>

      {Number(q.unregistered) > 0 && perms.adjustStock && (
        <Card title="Register takas" subtitle={`${q.unregistered} ${uom} were received as a total; cut them into takas to sell or send them roll by roll.`}>
          <RegisterTakasForm batch={batch} onDone={onBatch} />
        </Card>
      )}

      {!own && perms.adjustStock && (
        <Card title={`Deliver to owner (${batch.ownerPartyName})`}>
          <DeliverToOwnerForm batch={batch} onDone={onBatch} />
        </Card>
      )}
    </div>
  );
}
