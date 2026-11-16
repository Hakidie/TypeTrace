import { act } from 'react';
import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { i18n } from '@/shared/i18n/i18n';
import { PassageCard } from './components/PassageCard';
import type { LearnerPassage } from './types/passage.types';

const passage: LearnerPassage = {
  _id: 'p1',
  title: 'Buổi sáng',
  source: 'Tự viết',
  wordCount: 42,
  ownerName: 'Lan',
  visibility: 'private',
  status: 'published',
  isOwn: true,
  content: 'Nội dung đoạn văn',
  locked: false,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('the Passages module in Vietnamese (SCRUM-332)', () => {
  beforeEach(async () => {
    await act(() => i18n.changeLanguage('vi'));
  });

  it('says the words, the language and the status of a passage card in Vietnamese', () => {
    render(
      <MemoryRouter>
        <PassageCard passage={passage} own={{ onEdit: () => undefined, onDelete: () => undefined, onRequestPublic: () => undefined }} />
      </MemoryRouter>,
    );

    expect(screen.getByText('42 từ')).toBeInTheDocument();
    expect(screen.getByText('Tiếng Việt')).toBeInTheDocument();
    expect(screen.getByText('Bản nháp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sửa Buổi sáng' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Luyện Buổi sáng' })).toBeInTheDocument();
  });
});
