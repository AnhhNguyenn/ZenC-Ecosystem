import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * Smoke test – validates Jest + React Testing Library setup.
 */
describe('Smoke Test', () => {
  it('renders a basic element', () => {
    render(<div data-testid="hello">ZenC Web User</div>);
    expect(screen.getByTestId('hello')).toHaveTextContent('ZenC Web User');
  });
});
