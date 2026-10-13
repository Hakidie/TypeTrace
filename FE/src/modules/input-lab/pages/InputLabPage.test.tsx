import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { InputLabPage } from './InputLabPage';

const renderPage = () => renderWithProviders(<InputLabPage />, { route: '/lab/input' });

/** Changes the value like the browser does, then fires the native input event. */
const typeInto = (element: HTMLInputElement, value: string, inputType: string, data: string | null, isComposing = false) =>
  act(() => {
    element.value = value;
    element.dispatchEvent(new InputEvent('input', { inputType, data, isComposing, bubbles: true }));
  });

describe('InputLabPage', () => {
  it('starts with an empty log', () => {
    renderPage();

    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download/ })).toBeDisabled();
  });

  it('records composition and input events and detects the finished word', async () => {
    renderPage();
    const area = screen.getByRole('textbox', { name: 'Typing area' }) as HTMLInputElement;

    fireEvent.compositionStart(area, { data: '' });
    typeInto(area, 'đẹp', 'insertCompositionText', 'đẹp', true);
    act(() => {
      area.dispatchEvent(new CompositionEvent('compositionend', { data: 'đẹp', bubbles: true }));
    });
    typeInto(area, 'đẹp ', 'insertText', ' ');

    expect(await screen.findByText('compositionstart')).toBeInTheDocument();
    expect(screen.getByText('insertCompositionText')).toBeInTheDocument();
    expect(screen.getByText('Finished words (1)')).toBeInTheDocument();
    expect(screen.getByText('1. đẹp')).toBeInTheDocument();
  });

  it('updates the log once per animation frame, not once per event', async () => {
    renderPage();
    const area = screen.getByRole('textbox', { name: 'Typing area' }) as HTMLInputElement;

    typeInto(area, 'a', 'insertText', 'a');
    typeInto(area, 'ab', 'insertText', 'b');

    // Nothing rendered yet: both events wait for the next frame.
    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(await screen.findByText('"ab"')).toBeInTheDocument();
    expect(screen.getAllByText('"a"')).toHaveLength(2); // data and value of the first event
  });

  it('clears the log', async () => {
    renderPage();
    const area = screen.getByRole('textbox', { name: 'Typing area' }) as HTMLInputElement;
    typeInto(area, 'a', 'insertText', 'a');
    expect(await screen.findByText('insertText')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Clear/ }));

    expect(screen.getByText('No events yet')).toBeInTheDocument();
  });

  it('switches to the long sample text', () => {
    renderPage();
    expect(screen.getByText('13 words, end with a space')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Long' }));

    expect(screen.getByRole('button', { name: 'Long' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Buổi sáng mùa thu ở Hà Nội/)).toBeInTheDocument();
  });

  it('switches the typing target to a textarea', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'textarea' }));

    expect(screen.getByRole('textbox', { name: 'Typing area' }).tagName).toBe('TEXTAREA');
  });
});
