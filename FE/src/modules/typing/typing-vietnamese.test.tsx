import { screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/test/render-with-providers';
import { ResultActions } from './components/ResultActions';
import { ResultsPanel } from './components/ResultsPanel';
import { SessionInfoPanel } from './components/SessionInfoPanel';
import { errorChartLabels, errorLabels, languageNames, modeLabels, unitLabels } from './typing.config';
import { placementBoardNote } from './utils/typing-session';

describe('the Typing module in Vietnamese (SCRUM-330)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('names the label maps in the language of the interface at the moment they are read', async () => {
    expect(errorLabels.TONE_WRONG).toBe('Sai thanh điệu');
    expect(modeLabels.targeted).toBe('Luyện lỗi');
    expect(languageNames.en).toBe('Tiếng Anh');
    expect(unitLabels.min).toBe('Phút');
    expect(errorChartLabels.D_MISSING).toBe('Thiếu nét đ');

    await act(() => i18n.changeLanguage('en'));

    expect(errorLabels.TONE_WRONG).toBe('Wrong tone');
    expect(modeLabels.targeted).toBe('Train');
    expect(languageNames.en).toBe('English');
    expect(Object.values(errorLabels)).toHaveLength(11);
  });

  it('has an English name for every error type, like the Vietnamese ones', () => {
    for (const key of Object.keys(errorLabels) as (keyof typeof errorLabels)[]) {
      expect(errorLabels[key]).not.toMatch(/^typing:/);
      expect(errorChartLabels[key]).not.toMatch(/^typing:/);
    }
  });

  it('says in Vietnamese what a placement session means for the leaderboard', () => {
    const note = placementBoardNote({ mode: 'placement', isOnPlacementBoard: false, chosenLimitSeconds: 60, isCounted: true, accuracy: 99 }, 90);
    expect(note?.text).toBe('Lượt gõ này không nằm trên bảng xếp hạng kiểm tra: chỉ các bài kiểm tra 3 phút mới được xếp hạng.');
    expect(placementBoardNote({ mode: 'practice', isCounted: true }, 90)).toBeNull();
  });

  it('translates the result panels', () => {
    renderWithProviders(
      <>
        <SessionInfoPanel passageTitle="Bài" mode="targeted" language="vi" timeLimitSeconds={60} />
        <ResultsPanel results={[]} stats={[]} />
        <ResultActions mode="practice" detailOpen={false} onToggleDetail={() => undefined} replayOpen={false} onToggleReplay={() => undefined} />
      </>,
    );

    expect(screen.getByText('Luyện lỗi')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Chưa có lỗi nào')).toBeInTheDocument();
    expect(screen.getByText('Gõ xong một từ để xem các tỉ lệ.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chi tiết lỗi/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Gõ lại' })).toBeInTheDocument();
  });
});
