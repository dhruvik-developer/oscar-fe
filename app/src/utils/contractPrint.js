import { formatContractDate, formatContractMoney } from './contractFormatting';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function printContract(contract, deal) {
  const rows = [
    ['Contract Number', contract.contractNumber],
    ['Contract Type', contract.contractType],
    ['Customer', contract.customer || deal?.client],
    ...(deal ? [['Deal', `${deal?.dealNumber || deal?.id || '—'} — ${deal?.name || ''}`]] : []),
    ['Template', contract.template],
    ['Start Date', formatContractDate(contract.startDate)],
    ['End Date', formatContractDate(contract.endDate)],
    ['Contract Value', formatContractMoney(contract.amount)],
    ['Status', contract.status || 'Draft'],
    ['Created On', formatContractDate(contract.createdAt)],
    ['Description', contract.description],
  ];
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) { window.alert('Please allow pop-ups to view or save the contract PDF.'); return; }
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(contract.contractNumber)} - Contract</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:40px}h1{margin:0 0 4px;font-size:24px}p.sub{color:#64748b;margin:0 0 24px}table{border-collapse:collapse;width:100%;max-width:720px}th,td{border:1px solid #dbe2ea;padding:10px;text-align:left;font-size:13px;vertical-align:top}th{background:#f1f5f9;width:32%}h2{font-size:15px;margin:28px 0 8px}p.terms{font-size:13px;line-height:1.8;white-space:pre-wrap}</style></head><body><h1>Contract ${escapeHtml(contract.contractNumber)}</h1><p class="sub">${escapeHtml(contract.contractType || '')} — ${escapeHtml(contract.customer || '')}</p><table>${rows.map(([label, value]) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || '—')}</td></tr>`).join('')}</table><h2>Terms & Conditions</h2><p class="terms">${escapeHtml(contract.terms || 'No terms recorded.')}</p></body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

