import React from 'react';
import { render } from '@testing-library/react';
import { Button, Tag, ExpandableSection } from '../index';

describe('Component Library Exports', () => {
  test('Button component is exported correctly', () => {
    // This test will fail if Button is not exported properly
    const { getByRole } = render(<Button>Test Button</Button>);
    expect(getByRole('button')).toBeInTheDocument();
  });

  test('Tag component is exported correctly', () => {
    // This test will fail if Tag is not exported properly
    const { getByText } = render(<Tag>Test Tag</Tag>);
    expect(getByText('Test Tag')).toBeInTheDocument();
  });

  test('ExpandableSection component is exported correctly', () => {
    // This test will fail if ExpandableSection is not exported properly
    const { getByText } = render(
      <ExpandableSection title="Test Section">
        Test Content
      </ExpandableSection>
    );
    expect(getByText('Test Section')).toBeInTheDocument();
  });

  test('Components can be composed together', () => {
    // This test ensures components work well together
    const { getByText, getByRole } = render(
      <ExpandableSection 
        title="Test Section"
        defaultExpanded={true}
        indicator={<Tag variant="primary">Active</Tag>}
      >
        <Button variant="secondary">Click Me</Button>
      </ExpandableSection>
    );
    
    expect(getByText('Test Section')).toBeInTheDocument();
    expect(getByText('Active')).toBeInTheDocument();
    expect(getByRole('button', { name: 'Click Me' })).toBeInTheDocument();
  });
});