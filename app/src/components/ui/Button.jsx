import React from 'react';

export const Button = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  ...props
}) => {
  const baseStyles =
    'btn-std inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs select-none leading-none';

  // Single canonical size across the frontend: sm/md/lg all resolve
  // to the same Tailwind utility (btn-std) so every button is identical.
  const sizeStyles = {
    sm: 'btn-std',
    md: 'btn-std',
    lg: 'btn-std',
  };

  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-dark text-white shadow-xs shadow-primary/25 border border-transparent',
    secondary: 'bg-soft hover:bg-card-hover text-text border border-border',
    outline: 'bg-card hover:bg-card-hover text-text border border-border',
    danger: 'bg-danger hover:opacity-90 text-white shadow-xs border border-transparent',
    ghost: 'bg-transparent hover:bg-soft text-text shadow-none',
  };

  return (
    <button className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`} {...props}>
      {Icon && <Icon size={16} className="shrink-0" />}
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap leading-none">{children}</span>
    </button>
  );
};

export default Button;


