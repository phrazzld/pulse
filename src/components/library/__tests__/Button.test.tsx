import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../atoms/Button';

describe('Button component', () => {
  test('renders correctly with default props', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });

  test('renders with primary variant by default', () => {
    render(<Button>Primary Button</Button>);
    const button = screen.getByRole('button', { name: /primary button/i });
    // Check styling - this will verify that primary styling is applied
    expect(button).toHaveStyle(`color: var(--neon-green)`);
    expect(button).toHaveStyle(`border: 1px solid var(--neon-green)`);
  });

  test('renders with secondary variant when specified', () => {
    render(<Button variant="secondary">Secondary Button</Button>);
    const button = screen.getByRole('button', { name: /secondary button/i });
    expect(button).toHaveStyle(`color: var(--electric-blue)`);
    expect(button).toHaveStyle(`border: 1px solid var(--electric-blue)`);
  });

  test('renders with danger variant when specified', () => {
    render(<Button variant="danger">Danger Button</Button>);
    const button = screen.getByRole('button', { name: /danger button/i });
    expect(button).toHaveStyle(`color: var(--crimson-red)`);
    expect(button).toHaveStyle(`border: 1px solid var(--crimson-red)`);
  });

  test('renders as disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>);
    const button = screen.getByRole('button', { name: /disabled button/i });
    expect(button).toBeDisabled();
  });

  test('renders with loading spinner when isLoading is true', () => {
    render(<Button isLoading>Loading Button</Button>);
    const button = screen.getByRole('button', { name: /loading button/i });
    const spinner = button.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('button is disabled when loading', () => {
    render(<Button isLoading>Loading Button</Button>);
    const button = screen.getByRole('button', { name: /loading button/i });
    expect(button).toBeDisabled();
  });

  test('calls onClick handler when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable Button</Button>);
    const button = screen.getByRole('button', { name: /clickable button/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick} disabled>Disabled Button</Button>);
    const button = screen.getByRole('button', { name: /disabled button/i });
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('renders with small size when size="sm"', () => {
    render(<Button size="sm">Small Button</Button>);
    const button = screen.getByRole('button', { name: /small button/i });
    expect(button.classList.toString()).toContain('px-2 py-1 text-xs');
  });

  test('renders with large size when size="lg"', () => {
    render(<Button size="lg">Large Button</Button>);
    const button = screen.getByRole('button', { name: /large button/i });
    expect(button.classList.toString()).toContain('px-4 py-3 text-base');
  });
});