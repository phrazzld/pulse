# Pulse Component Library

This document provides an overview of the component library implemented for the Pulse application, following the plan outlined in PLAN.md.

## Library Structure

The component library follows Atomic Design principles and is organized as follows:

```
src/components/library/
├── atoms/         # Base components (Button, Tag, etc.)
├── molecules/     # Combinations of atoms (ExpandableSection, etc.)
├── organisms/     # Complex, composite components
├── templates/     # Page-level layouts
├── utilities/     # Non-UI components and hooks
├── dataviz/       # Data visualization components
└── index.ts       # Central export point
```

## Implemented Components

### Atoms

#### Button
A flexible button component that supports various visual styles, sizes, and states.

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost'
- `size`: 'sm' | 'md' | 'lg'
- `isLoading`: boolean - Shows a loading spinner when true
- `children`: React.ReactNode - Button content
- ...plus all standard HTML button attributes

**Examples:**
```tsx
// Primary button (default)
<Button>Submit</Button>

// Secondary button with loading state
<Button variant="secondary" isLoading>Loading</Button>

// Small danger button
<Button variant="danger" size="sm">Delete</Button>

// Ghost button (subtle style)
<Button variant="ghost">Cancel</Button>
```

#### Tag
A badge/tag component for displaying labels, status indicators, or counts.

**Props:**
- `variant`: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info'
- `size`: 'sm' | 'md'
- `count`: number (optional) - To display a count in the tag
- `className`: string (optional) - Additional CSS classes
- `children`: React.ReactNode - Tag content

**Examples:**
```tsx
// Primary tag
<Tag>New</Tag>

// Warning tag with count
<Tag variant="warning" count={3}>Alerts</Tag>

// Small info tag
<Tag variant="info" size="sm">Info</Tag>
```

### Molecules

#### ExpandableSection
A collapsible section with a header that toggles visibility of content.

**Props:**
- `title`: React.ReactNode - Section title displayed in header
- `themeColor`: string - CSS variable name for theme color (default: 'electric-blue')
- `defaultExpanded`: boolean - Whether section is initially expanded
- `indicator`: React.ReactNode - Optional indicator to show in header
- `className`: string - Additional CSS classes
- `onExpandChange`: (expanded: boolean) => void - Callback when expanded state changes
- `children`: React.ReactNode - Content to show when expanded

**Examples:**
```tsx
// Basic usage
<ExpandableSection title="Section Title">
  This content can be collapsed.
</ExpandableSection>

// With default expanded state and custom theme
<ExpandableSection 
  title="Filter Options" 
  themeColor="neon-green"
  defaultExpanded={true}
>
  Filter content here
</ExpandableSection>

// With status indicator
<ExpandableSection 
  title="Filter Options" 
  indicator={<Tag variant="primary">Active</Tag>}
>
  Filter content here
</ExpandableSection>
```

## Usage

Import components from the library:

```tsx
import { Button, Tag, ExpandableSection } from '@components/index';

// Use in your components
function MyComponent() {
  return (
    <ExpandableSection title="My Section">
      <Button>Click Me</Button>
      <Tag variant="success">Success</Tag>
    </ExpandableSection>
  );
}
```

## Design Considerations

1. **Compatibility**: Components support both Tailwind CSS classes and inline styles with CSS variables to maintain compatibility with the existing Pulse UI.

2. **Accessibility**: Components include proper ARIA attributes, keyboard navigation, and focus management.

3. **Customization**: All components support extensibility through props and additional className props.

4. **Testing**: Comprehensive test coverage using Jest and React Testing Library.

## Future Enhancements

1. **Additional Atoms**: Input, Checkbox, RadioButton, Avatar, and more basic building blocks.

2. **More Molecules**: FormGroup, Card, SearchInput, etc.

3. **Organisms**: FilterPanel, GroupResults, etc.

4. **Storybook Integration**: Visual documentation of component variants and usage examples.

5. **Theme Configuration**: Centralized theme configuration for consistent styling.

## Development Guidelines

1. **Component Structure**:
   - Clear prop interfaces with JSDoc comments
   - Sensible defaults for optional props
   - Support for extending with standard HTML attributes

2. **Testing Requirements**:
   - Test all component variants
   - Test interactive behaviors
   - Test accessibility features

3. **Styling Approach**:
   - Use Tailwind classes as primary styling
   - Support inline styles for backward compatibility
   - Maintain consistent spacing and sizing