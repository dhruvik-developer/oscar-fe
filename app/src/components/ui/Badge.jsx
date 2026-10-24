/**
 * Badge — CRM-styled generic badge pill.
 */
export function Badge({ children, variant = 'gray', className = '', ...props }) {
  const variantClasses = {
    gray: 'badge-gray',
    blue: 'badge-blue',
    green: 'badge-green',
    red: 'badge-red',
    yellow: 'badge-yellow',
    purple: 'badge-purple',
    cyan: 'badge-cyan',
    orange: 'badge-orange',
  };

  const cls = variantClasses[variant] || 'badge-gray';

  return (
    <span className={`badge ${cls} ${className}`} {...props}>
      {children}
    </span>
  );
}

export default Badge;
