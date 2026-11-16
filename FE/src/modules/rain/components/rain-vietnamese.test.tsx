import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { RainMode } from './RainMode';

describe('word rain in Vietnamese (SCRUM-332)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('shows the start screen and the round in Vietnamese, with the falling words unchanged', async () => {
    renderWithProviders(<RainMode guest={{ words: ['nhà', 'cửa'], roundMs: 20_000 }} />);

    expect(screen.getByRole('heading', { name: 'Mưa chữ' })).toBeInTheDocument();
    expect(screen.getByText(/Gõ một từ đang rơi rồi nhấn space/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(await screen.findByLabelText('Gõ một từ đang rơi')).toBeInTheDocument();
    expect(screen.getByLabelText('Còn 3 mạng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tạm dừng' })).toBeInTheDocument();
  });
});
