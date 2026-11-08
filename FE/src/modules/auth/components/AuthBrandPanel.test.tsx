import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthBrandPanel } from './AuthBrandPanel';

describe('AuthBrandPanel', () => {
  it('shows an avatar above the typing demo', () => {
    render(<AuthBrandPanel />);

    const avatar = screen.getByRole('img', { name: 'Avatar typing' });
    const passage = screen.getByText(/dấu vết nhỏ/, { selector: '.sr-only' });
    expect(avatar.compareDocumentPosition(passage) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
