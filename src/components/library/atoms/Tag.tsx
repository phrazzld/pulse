import React from 'react';

export type TagVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type TagSize = 'sm' | 'md';

export interface TagProps {
  /**
   * The visual style of the tag
   * @default 'primary'
   */
  variant?: TagVariant;
  
  /**
   * The size of the tag
   * @default 'md'
   */
  size?: TagSize;
  
  /**
   * Optional count or number to display
   */
  count?: number;
  
  /**
   * Additional CSS class names
   */
  className?: string;
  
  /**
   * Tag content
   */
  children: React.ReactNode;
}

/**
 * Tag/Badge component for displaying labels, statuses, or counts
 */
export const Tag: React.FC<TagProps> = ({
  variant = 'primary',
  size = 'md',
  count,
  className = '',
  children,
}) => {
  // Base styles for all tags
  const baseStyles = 'font-mono rounded inline-flex items-center';
  
  // Size variants
  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  // Tailwind color variants
  const tailwindVariants = {
    primary: 'bg-neon-green bg-opacity-10 text-neon-green border border-neon-green',
    secondary: 'bg-electric-blue bg-opacity-10 text-electric-blue border border-electric-blue',
    success: 'bg-green-500 bg-opacity-10 text-green-500 border border-green-500',
    warning: 'bg-yellow-500 bg-opacity-10 text-yellow-500 border border-yellow-500',
    danger: 'bg-crimson bg-opacity-10 text-crimson border border-crimson',
    info: 'bg-foreground bg-opacity-10 text-foreground border border-foreground',
  };
  
  // Legacy styles using CSS variables for compatibility with current app
  const legacyStyles = {
    primary: `
      background-color: rgba(0, 255, 135, 0.1);
      color: var(--neon-green);
      border: 1px solid var(--neon-green);
    `,
    secondary: `
      background-color: rgba(59, 142, 234, 0.1);
      color: var(--electric-blue);
      border: 1px solid var(--electric-blue);
    `,
    success: `
      background-color: rgba(50, 205, 50, 0.1);
      color: var(--neon-green);
      border: 1px solid var(--neon-green);
    `,
    warning: `
      background-color: rgba(255, 200, 87, 0.1);
      color: var(--luminous-yellow);
      border: 1px solid var(--luminous-yellow);
    `,
    danger: `
      background-color: rgba(255, 59, 48, 0.1);
      color: var(--crimson-red);
      border: 1px solid var(--crimson-red);
    `,
    info: `
      background-color: rgba(0, 0, 0, 0.3);
      color: var(--foreground);
      border: 1px solid var(--foreground);
    `,
  };

  return (
    <span
      className={`${baseStyles} ${sizeStyles[size]} ${tailwindVariants[variant]} ${className}`}
      style={{ ...legacyStyles[variant] }}
    >
      {children}
      {count !== undefined && (
        <span className="ml-1 px-1 rounded" style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}>
          {count}
        </span>
      )}
    </span>
  );
};

export default Tag;