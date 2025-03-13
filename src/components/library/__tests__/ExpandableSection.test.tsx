import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExpandableSection } from '../molecules/ExpandableSection';

describe('ExpandableSection component', () => {
  test('renders with title', () => {
    render(<ExpandableSection title="Section Title">Content</ExpandableSection>);
    expect(screen.getByText('Section Title')).toBeInTheDocument();
  });

  test('content is hidden by default', () => {
    render(<ExpandableSection title="Section Title">Hidden Content</ExpandableSection>);
    expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();
  });

  test('content is visible when defaultExpanded is true', () => {
    render(
      <ExpandableSection title="Section Title" defaultExpanded>
        Visible Content
      </ExpandableSection>
    );
    expect(screen.getByText('Visible Content')).toBeInTheDocument();
  });

  test('toggles content visibility when header is clicked', () => {
    render(<ExpandableSection title="Toggle Me">Toggle Content</ExpandableSection>);
    
    // Content should be hidden initially
    expect(screen.queryByText('Toggle Content')).not.toBeInTheDocument();
    
    // Click to expand
    fireEvent.click(screen.getByText('Toggle Me'));
    expect(screen.getByText('Toggle Content')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(screen.getByText('Toggle Me'));
    expect(screen.queryByText('Toggle Content')).not.toBeInTheDocument();
  });

  test('supports keyboard navigation', () => {
    render(<ExpandableSection title="Keyboard Section">Keyboard Content</ExpandableSection>);
    
    const headerElement = screen.getByText('Keyboard Section').parentElement?.parentElement;
    expect(headerElement).toHaveAttribute('role', 'button');
    expect(headerElement).toHaveAttribute('tabIndex', '0');
    
    // Press Enter to expand
    fireEvent.keyPress(headerElement as HTMLElement, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(screen.getByText('Keyboard Content')).toBeInTheDocument();
    
    // Press Enter to collapse
    fireEvent.keyPress(headerElement as HTMLElement, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(screen.queryByText('Keyboard Content')).not.toBeInTheDocument();
  });

  test('calls onExpandChange callback when toggled', () => {
    const handleExpandChange = jest.fn();
    render(
      <ExpandableSection 
        title="Callback Section" 
        onExpandChange={handleExpandChange}
      >
        Callback Content
      </ExpandableSection>
    );
    
    // Click to expand
    fireEvent.click(screen.getByText('Callback Section'));
    expect(handleExpandChange).toHaveBeenCalledWith(true);
    
    // Click to collapse
    fireEvent.click(screen.getByText('Callback Section'));
    expect(handleExpandChange).toHaveBeenCalledWith(false);
  });

  test('renders with custom theme color', () => {
    render(
      <ExpandableSection 
        title="Custom Theme" 
        themeColor="neon-green"
      >
        Theme Content
      </ExpandableSection>
    );
    
    const headerTitle = screen.getByText('Custom Theme');
    expect(headerTitle).toHaveStyle('color: var(--neon-green)');
  });

  test('renders with indicator', () => {
    render(
      <ExpandableSection 
        title="With Indicator" 
        indicator={<span data-testid="indicator">ACTIVE</span>}
      >
        Indicator Content
      </ExpandableSection>
    );
    
    expect(screen.getByTestId('indicator')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  test('applies custom className', () => {
    render(
      <ExpandableSection 
        title="Custom Class" 
        className="test-class"
      >
        Class Content
      </ExpandableSection>
    );
    
    const sectionElement = screen.getByText('Custom Class').closest('.test-class');
    expect(sectionElement).toBeInTheDocument();
  });
});