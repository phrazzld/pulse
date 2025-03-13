import React, { useState } from 'react';

export interface ExpandableSectionProps {
  /**
   * The title displayed in the header
   */
  title: React.ReactNode;
  
  /**
   * Primary color theme (for styling the header line and icon)
   * @default 'electric-blue'
   */
  themeColor?: string;
  
  /**
   * The content to show when expanded
   */
  children: React.ReactNode;
  
  /**
   * Whether the section is initially expanded
   * @default false
   */
  defaultExpanded?: boolean;
  
  /**
   * Optional indicator to show in the header (e.g., "FILTERS ACTIVE")
   */
  indicator?: React.ReactNode;
  
  /**
   * Additional CSS class names
   */
  className?: string;
  
  /**
   * Callback fired when expanded state changes
   */
  onExpandChange?: (expanded: boolean) => void;
}

/**
 * ExpandableSection component that provides a collapsible section with a header
 */
export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  themeColor = 'electric-blue',
  children,
  defaultExpanded = false,
  indicator,
  className = '',
  onExpandChange,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  const handleToggle = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    if (onExpandChange) {
      onExpandChange(newExpanded);
    }
  };
  
  return (
    <div className={`${className}`}>
      {/* Header with toggle */}
      <div 
        className="flex items-center justify-between cursor-pointer" 
        onClick={handleToggle}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleToggle();
          }
        }}
      >
        <div className="flex items-center">
          <div 
            className="w-2 h-2 rounded-full mr-2" 
            style={{ backgroundColor: `var(--${themeColor})` }}
          />
          <h3 
            className="text-sm uppercase" 
            style={{ color: `var(--${themeColor})` }}
          >
            {title}
          </h3>
        </div>
        <div className="flex items-center">
          {/* Optional indicator */}
          {indicator && (
            <div className="mr-2">{indicator}</div>
          )}
          
          <svg 
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor"
            style={{ color: `var(--${themeColor})` }}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expandable content */}
      {expanded && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  );
};

export default ExpandableSection;