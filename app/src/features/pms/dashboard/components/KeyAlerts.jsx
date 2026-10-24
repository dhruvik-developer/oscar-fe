import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, PackageOpen, ShieldAlert, IndianRupee } from 'lucide-react';
import { formatMeters, formatMoney } from '../format';

/**
 * KeyAlerts — four exception tiles, each linking to the page that resolves it.
 *
 *  Pending Production  — unproduced balance on draft / in-progress instructions
 *  Grey Inward Pending — produced meters on instructions awaiting verification
 *  QC Hold Quantity    — goods receipts whose QC is On Hold
 *  Overdue Payment     — unpaid invoice balance past its due date
 */

const ALERTS = [
  {
    key: 'pendingProduction', label: 'Pending Production', icon: Factory,
    bg: '#fff1f1', border: '#fbd5d5', fg: '#dc2626', unit: 'Instructions',
    to: '/pms/production-instructions',
  },
  {
    key: 'greyInwardPending', label: 'Grey Inward Pending', icon: PackageOpen,
    bg: '#fff8e8', border: '#fbe3b0', fg: '#d97706', unit: 'Instructions',
    to: '/pms/production-completion',
  },
  {
    key: 'qcHold', label: 'QC Hold Quantity', icon: ShieldAlert,
    bg: '#fff5eb', border: '#fbdcbc', fg: '#ea580c', unit: 'Receipts',
    to: '/purchase/receipts',
  },
  {
    key: 'overduePayment', label: 'Overdue Payment', icon: IndianRupee,
    bg: '#fff1f1', border: '#fbd5d5', fg: '#dc2626', unit: 'Invoices', money: true,
    to: '/sales/invoices',
  },
];

export function KeyAlerts({ alerts = {} }) {
  const navigate = useNavigate();

  return (
    <section className="rounded-xl border border-[#dce5f4] bg-white p-5 shadow-2xs h-full">
      <header className="mb-4">
        <h3 className="text-sm font-bold text-slate-800">Key Alerts</h3>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ALERTS.map(({ key, label, icon: Icon, bg, border, fg, unit, money, to }) => {
          const alert = alerts[key] ?? {};
          const count = alert.count ?? 0;
          return (
            <button
              type="button"
              key={key}
              onClick={() => navigate(to)}
              className="flex items-start gap-3 rounded-lg border p-3 text-left transition hover:shadow-sm"
              style={{ background: bg, borderColor: border }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white"
                style={{ color: fg }}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold" style={{ color: fg }}>{label}</span>
                <span className="block text-[17px] font-bold text-slate-900">
                  {money ? formatMoney(alert.amount) : formatMeters(alert.quantity)}
                </span>
                <span className="block text-[11px] font-medium" style={{ color: fg }}>
                  {count} {unit}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default KeyAlerts;
