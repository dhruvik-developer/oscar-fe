import { Inbox } from 'lucide-react';

/**
 * EmptyState — CRM-styled empty placeholder with icon, title, description, and action.
 */
export function EmptyState({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items matching your criteria or currently available.',
  action,
  className = '',
}) {
  return (
    <div
      className={`empty-state ${className}`}
      style={{
        padding: '48px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 12,
          background: '#f1f5f9',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
        }}
      >
        <Icon size={26} strokeWidth={1.75} />
      </div>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h3>
      {description && (
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', maxWidth: 380 }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
