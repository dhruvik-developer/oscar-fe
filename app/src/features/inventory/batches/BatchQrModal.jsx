import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, Printer } from 'lucide-react';
import Drawer from '../../../components/ui/Drawer';
import { batchHistoryUrl, printBatchTags } from './printBatchTag';

/** A batch's QR code; scanning it opens the batch's A to Z page. */
export function BatchQrCard({ batch }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const url = batchHistoryUrl(batch.batchCode);

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: 280, errorCorrectionLevel: 'M' })
      .then((data) => { if (live) setSrc(data); })
      .catch(() => { if (live) setError('The QR code could not be made.'); });
    return () => { live = false; };
  }, [url]);

  const print = async () => {
    try {
      await printBatchTags([batch]);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      {src ? <img src={src} alt={`QR code for batch ${batch.batchCode}`} className="w-64 h-64" /> : <div className="w-64 h-64 rounded-lg border border-dashed border-slate-200" />}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <a href={url} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5">
          <ExternalLink size={13} /> Open
        </a>
        <button type="button" onClick={print} className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer">
          <Printer size={13} /> Print Tag
        </button>
      </div>
    </div>
  );
}

export default function BatchQrModal({ batch, onClose }) {
  return (
    <Drawer isOpen onClose={onClose} width={400} title={batch.batchCode} subtitle="Scan to see this batch from PO to sale. Sign-in is required.">
      <BatchQrCard batch={batch} />
    </Drawer>
  );
}
