import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import { chatConfig } from '../chat.config';
import { ChatWidget } from './ChatWidget';

const send = vi.fn();
const toastError = vi.fn();

vi.mock('../api/chat.api', () => ({
  chatApi: { send: (messages: unknown) => send(messages) },
}));

vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg), success: vi.fn() } }));

/** Renders the floating button and opens the popup. */
const renderPage = () => {
  const view = renderWithProviders(<ChatWidget />);
  fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
  return view;
};

const type = (text: string) => fireEvent.change(screen.getByLabelText('Message'), { target: { value: text } });

beforeEach(() => {
  send.mockReset().mockResolvedValue({ reply: 'Chào bạn!' });
  toastError.mockReset();
});

describe('ChatWidget', () => {
  it('shows only the floating button until it is opened', () => {
    renderWithProviders(<ChatWidget />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(screen.getByRole('dialog', { name: chatConfig.botName })).toBeInTheDocument();
  });

  it('keeps the conversation when the popup is closed and opened again', async () => {
    renderPage();
    type('Xin chào');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Chào bạn!');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open chat' }));
    expect(screen.getByText('Chào bạn!')).toBeInTheDocument();
  });

  it('shows the welcome message and suggestions before the first message', () => {
    renderPage();
    expect(screen.getByText(chatConfig.welcomeMessage)).toBeInTheDocument();
    for (const suggestion of chatConfig.suggestions) {
      expect(screen.getByRole('button', { name: suggestion })).toBeInTheDocument();
    }
  });

  it('sends the message with Enter and shows the reply', async () => {
    renderPage();

    type('Xin chào');
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter' });

    expect(await screen.findByText('Chào bạn!')).toBeInTheDocument();
    expect(screen.getByText('Xin chào')).toBeInTheDocument();
    expect(send).toHaveBeenCalledWith([{ role: 'user', text: 'Xin chào' }]);
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('keeps Shift+Enter for a new line', () => {
    renderPage();
    type('line one');
    fireEvent.keyDown(screen.getByLabelText('Message'), { key: 'Enter', shiftKey: true });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends the whole conversation on follow-up questions', async () => {
    renderPage();
    type('My name is Lan');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Chào bạn!');

    send.mockResolvedValue({ reply: 'Your name is Lan.' });
    type('What is my name?');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Your name is Lan.')).toBeInTheDocument();
    expect(send).toHaveBeenLastCalledWith([
      { role: 'user', text: 'My name is Lan' },
      { role: 'model', text: 'Chào bạn!' },
      { role: 'user', text: 'What is my name?' },
    ]);
  });

  it('sends a suggestion when clicked', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: chatConfig.suggestions[0] }));
    await waitFor(() => expect(send).toHaveBeenCalledWith([{ role: 'user', text: chatConfig.suggestions[0] }]));
  });

  it('shows the backend error inline and retries the same conversation', async () => {
    send.mockRejectedValueOnce({ response: { status: 503, data: { message: 'The AI chat is not configured.' } } });
    renderPage();

    type('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The AI chat is not configured.');
    expect(toastError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Chào bạn!')).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('starts a new chat', async () => {
    renderPage();
    type('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Chào bạn!');

    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

    expect(screen.queryByText('Chào bạn!')).not.toBeInTheDocument();
    expect(screen.getByText(chatConfig.welcomeMessage)).toBeInTheDocument();
  });

  it('is a navigation tab that opens the popup under the header, on the right', () => {
    renderWithProviders(<ChatWidget />, { route: '/notes' });
    const tab = screen.getByRole('button', { name: 'Open chat' });
    expect(tab).toHaveTextContent('AI chat');
    expect(tab).not.toHaveClass('bg-primary/15');

    fireEvent.click(tab);

    expect(screen.getByRole('dialog')).toHaveClass('fixed', 'right-4', 'top-[4.5rem]');
    expect(screen.getByRole('button', { name: 'Close chat', expanded: true })).toHaveClass('bg-primary/15');
  });
});
