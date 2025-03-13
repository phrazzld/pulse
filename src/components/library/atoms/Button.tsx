import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The visual style of the button
   * @default 'primary'
   */
  variant?: ButtonVariant;
  
  /**
   * The size of the button
   * @default 'md'
   */
  size?: ButtonSize;
  
  /**
   * Whether to show a loading spinner
   * @default false
   */
  isLoading?: boolean;
  
  /**
   * Children elements
   */
  children: React.ReactNode;
}

/**
 * Button component that follows the Pulse design system
 */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className = '',
  children,
  disabled,
  ...restProps
}) => {
  // Base styles shared by all buttons
  const baseStyles = 'font-mono rounded-md transition-all duration-200 inline-flex items-center justify-center';
  
  // Size-specific styles
  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };
  
  // Variant-specific styles
  const variantStyles = {
    primary: 'bg-neon-green text-background border border-neon-green hover:bg-background hover:text-neon-green focus:ring-2 focus:ring-neon-green focus:ring-opacity-50',
    secondary: 'bg-electric-blue text-background border border-electric-blue hover:bg-background hover:text-electric-blue focus:ring-2 focus:ring-electric-blue focus:ring-opacity-50',
    danger: 'bg-crimson text-background border border-crimson hover:bg-background hover:text-crimson focus:ring-2 focus:ring-crimson focus:ring-opacity-50',
    ghost: 'bg-transparent text-foreground border border-transparent hover:bg-background hover:border-electric-blue focus:ring-1 focus:ring-electric-blue focus:ring-opacity-30',
  };
  
  // Disabled state styles
  const disabledStyles = 'opacity-50 cursor-not-allowed';
  
  // Legacy styles compatible with the current design system (using CSS custom properties)
  const legacyStyles = {
    primary: `
      background-color: var(--dark-slate);
      color: var(--neon-green);
      border: 1px solid var(--neon-green);
    `,
    secondary: `
      background-color: var(--dark-slate);
      color: var(--electric-blue);
      border: 1px solid var(--electric-blue);
    `,
    danger: `
      background-color: rgba(255, 59, 48, 0.1);
      color: var(--crimson-red);
      border: 1px solid var(--crimson-red);
    `,
    ghost: `
      background-color: transparent;
      color: var(--foreground);
      border: 1px solid transparent;
    `,
  };

  // Loading spinner
  const renderSpinner = () => (
    <span className="inline-block w-4 h-4 border-2 border-t-transparent rounded-full animate-spin mr-2" 
      style={{ 
        borderColor: variant === 'primary' ? 'var(--neon-green)' : 
                     variant === 'secondary' ? 'var(--electric-blue)' : 
                     variant === 'danger' ? 'var(--crimson-red)' : 'var(--foreground)',
        borderTopColor: 'transparent' 
      }}>
    </span>
  );

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${disabled ? disabledStyles : ''} ${className}`}
      disabled={disabled || isLoading}
      style={{ ...legacyStyles[variant] }}
      {...restProps}
    >
      {isLoading && renderSpinner()}
      {children}
    </button>
  );
};

export default Button;