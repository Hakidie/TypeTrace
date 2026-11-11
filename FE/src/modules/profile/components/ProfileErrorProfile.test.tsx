import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { ErrorProfile, ErrorTypeProfile } from '../types/profile.types';
import { ProfileErrorProfile } from './ProfileErrorProfile';

const getErrorProfile = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getErrorProfile: (language?: string) => getErrorProfile(language) },
}));

/** One error type: OK and steady on 400 chances unless the test says otherwise. */
const item = (type: ErrorTypeProfile['type'], extra: Partial<ErrorTypeProfile> = {}): ErrorTypeProfile => ({
  type,
  errors: 0,
  opportunities: 400,
  rate: 0,
  level: 'ok',
  previousRate: 0,
  trend: 'unchanged',
  ...extra,
});

const profileOf = (types: ErrorTypeProfile[], extra: Partial<ErrorProfile> = {}): ErrorProfile => ({
  language: 'vi',
  window: 10,
  minOpportunities: 20,
  weakRate: 15,
  sessionsUsed: 10,
  types,
  weakTypes: types.filter((type) => type.level === 'weak').map((type) => type.type),
  rankedTypes: types.filter((type) => type.level !== 'insufficient_data').map((type) => type.type),
  ...extra,
});

/** Every case at once: steady, too few chances, no trend yet, worse, and weak but improving. */
const profile = profileOf([
  item('BASE_LETTER', { errors: 4, opportunities: 545, rate: 0.7, previousRate: 0.9 }),
  item('D_MISSING', { errors: 1, opportunities: 8, rate: 12.5, level: 'insufficient_data', trend: 'insufficient_data' }),
  item('MARK_WRONG', { errors: 7, opportunities: 276, rate: 2.5, trend: 'insufficient_data' }),
  item('TONE_WRONG', { errors: 30, opportunities: 400, rate: 7.5, previousRate: 2.5, trend: 'worse' }),
  item('HOI_NGA_CONFUSION', { errors: 6, opportunities: 40, rate: 15, level: 'weak', previousRate: 35, trend: 'improved' }),
]);

const region = () => screen.getByRole('region', { name: 'Error profile' });
/** The item of an error type, found by its name. */
const itemOf = (name: string) => within(region()).getByText(name).closest('li') as HTMLElement;

beforeEach(() => {
  getErrorProfile.mockReset();
});

describe('ProfileErrorProfile (SCRUM-27)', () => {
  it('shows each error type with its error rate, its level and its trend', async () => {
    getErrorProfile.mockResolvedValue(profile);
    renderWithProviders(<ProfileErrorProfile />);

    expect(await within(region()).findAllByRole('listitem')).toHaveLength(5);
    expect(region()).toHaveAttribute('aria-busy', 'false');
    expect(within(region()).getByRole('heading', { name: 'Error profile' })).toBeInTheDocument();
    expect(within(region()).getByRole('button', { name: /Error profile language: Vietnamese/ })).toBeInTheDocument();

    const hoiNga = itemOf('Hỏi / ngã confusion');
    expect(within(hoiNga).getByText('15%')).toBeInTheDocument();
    expect(within(hoiNga).getByText('Weak')).toBeInTheDocument();
    expect(within(hoiNga).getByText('Improving')).toBeInTheDocument();

    const tone = itemOf('Wrong tone');
    expect(within(tone).getByText('7.5%')).toBeInTheDocument();
    expect(within(tone).getByText('OK')).toBeInTheDocument();
    expect(within(tone).getByText('Getting worse')).toBeInTheDocument();

    const letter = itemOf('Wrong letter');
    expect(within(letter).getByText('0.7%')).toBeInTheDocument();
    expect(within(letter).getByText('Steady')).toBeInTheDocument();

    // Enough vowel marks in these sessions, not in the ones before: a level, no trend yet.
    const mark = itemOf('Wrong vowel mark (â ê ô ă ơ ư)');
    expect(within(mark).getByText('OK')).toBeInTheDocument();
    expect(within(mark).getByText('No trend yet')).toBeInTheDocument();

    // Too few words with đ: no rate, no level and no trend, but what it needs.
    const stroke = itemOf('Missing stroke on đ');
    expect(within(stroke).getByText('—')).toBeInTheDocument();
    expect(within(stroke).getByText('Needs 12 more words with đ')).toBeInTheDocument();
    expect(within(stroke).queryByText('12.5%')).not.toBeInTheDocument();
    expect(within(stroke).queryByText(/^(OK|Weak|Steady|Improving|Getting worse|No trend yet)$/)).not.toBeInTheDocument();
  });

  it('keeps the error types in the order of the backend', async () => {
    getErrorProfile.mockResolvedValue(profile);
    renderWithProviders(<ProfileErrorProfile />);

    const items = await within(region()).findAllByRole('listitem');
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual([
      'Wrong letter',
      'Missing stroke on đ',
      'Wrong vowel mark (â ê ô ă ơ ư)',
      'Wrong tone',
      'Hỏi / ngã confusion',
    ]);
  });

  it('says how many words a type still needs, in the words that give a chance of it', async () => {
    getErrorProfile.mockResolvedValue(
      profileOf([
        item('BASE_LETTER', { opportunities: 15, level: 'insufficient_data', trend: 'insufficient_data' }),
        item('D_MISSING', { opportunities: 19, level: 'insufficient_data', trend: 'insufficient_data' }),
      ]),
    );
    renderWithProviders(<ProfileErrorProfile />);

    expect(await within(region()).findByText('Needs 5 more words')).toBeInTheDocument();
    expect(within(region()).getByText('Needs 1 more word with đ')).toBeInTheDocument();
  });

  it('tells the rates of a trend, the weak line and what a trend needs in tooltips', async () => {
    const user = userEvent.setup();
    getErrorProfile.mockResolvedValue(profile);
    renderWithProviders(<ProfileErrorProfile />);

    const improving = await screen.findByText('Improving');
    await user.hover(improving);
    expect((await screen.findAllByText('35% → 15% against the 10 sessions before'))[0]).toBeInTheDocument();
    await user.unhover(improving);

    const weak = screen.getByText('Weak');
    await user.hover(weak);
    expect((await screen.findAllByText('Wrong in 15% or more of the words with hỏi or ngã'))[0]).toBeInTheDocument();
    await user.unhover(weak);

    await user.hover(screen.getByText('No trend yet'));
    expect((await screen.findAllByText('A trend needs 20 words with vowel marks in the 10 sessions before too'))[0]).toBeInTheDocument();
  });

  it('explains the profile in the tooltip of its title', async () => {
    const user = userEvent.setup();
    getErrorProfile.mockResolvedValue(profile);
    renderWithProviders(<ProfileErrorProfile />);
    // The hint comes with the thresholds of the answer.
    await within(region()).findAllByRole('listitem');

    await user.hover(within(region()).getByText('Error profile'));

    expect(
      (
        await screen.findAllByText(
          'Your last 10 counted Vietnamese sessions: a type is weak from 15% wrong, and its trend compares them with the 10 sessions before. Use the language button to see the other language.',
        )
      )[0],
    ).toBeInTheDocument();
  });

  it('switches the profile between Vietnamese and English with the button on the right of the title, without saving the language', async () => {
    const user = userEvent.setup();
    getErrorProfile.mockImplementation((language?: string) =>
      Promise.resolve(language === 'en' ? profileOf([item('LETTER_WRONG')], { language: 'en', sessionsUsed: 4 }) : profile),
    );
    renderWithProviders(<ProfileErrorProfile />);
    await within(region()).findAllByRole('listitem');
    expect(getErrorProfile).toHaveBeenLastCalledWith(undefined);

    await user.click(within(region()).getByRole('button', { name: /Switch to English/ }));

    expect(await within(region()).findByRole('button', { name: /Error profile language: English. Switch to Vietnamese/ })).toBeInTheDocument();
    expect(getErrorProfile).toHaveBeenLastCalledWith('en');
    expect(await within(region()).findAllByRole('listitem')).toHaveLength(1);
  });

  it('says so before the first counted session', async () => {
    getErrorProfile.mockResolvedValue(
      profileOf(
        profile.types.map((type) => ({ ...type, errors: 0, opportunities: 0, rate: 0, level: 'insufficient_data', trend: 'insufficient_data' })),
        { sessionsUsed: 0 },
      ),
    );
    renderWithProviders(<ProfileErrorProfile />);

    expect(await screen.findByText('No counted Vietnamese sessions yet: your error profile starts with your first one.')).toBeInTheDocument();
    expect(within(region()).queryByRole('list')).not.toBeInTheDocument();
  });

  it('shows the English error types and names the language of a learner who types English (SCRUM-219)', async () => {
    const user = userEvent.setup();
    getErrorProfile.mockResolvedValue(
      profileOf(
        [
          item('LETTER_WRONG', { errors: 12, opportunities: 400, rate: 3 }),
          item('LETTER_MISSING'),
          item('LETTER_EXTRA'),
          item('LETTERS_SWAPPED', { errors: 9, opportunities: 50, rate: 18, level: 'weak', previousRate: 18 }),
          item('CASE_WRONG'),
          item('PUNCTUATION_WRONG', { opportunities: 14, level: 'insufficient_data', trend: 'insufficient_data' }),
        ],
        { language: 'en', sessionsUsed: 4 },
      ),
    );
    renderWithProviders(<ProfileErrorProfile />);

    const items = await within(region()).findAllByRole('listitem');
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual([
      'Wrong letter',
      'Missing letter',
      'Extra letter',
      'Swapped letters',
      'Wrong case',
      'Wrong punctuation',
    ]);
    expect(within(region()).getByRole('button', { name: /Error profile language: English/ })).toBeInTheDocument();
    // What a type needs is said in the words that give a chance of it in English.
    expect(within(itemOf('Wrong punctuation')).getByText('Needs 6 more words with punctuation')).toBeInTheDocument();

    await user.hover(within(itemOf('Swapped letters')).getByText('Weak'));
    expect((await screen.findAllByText('Wrong in 15% or more of the words of two letters or more'))[0]).toBeInTheDocument();
  });

  it('holds its place while it loads, then shows why it failed with a retry', async () => {
    const user = userEvent.setup();
    let fail: (error: Error) => void = () => undefined;
    getErrorProfile.mockReturnValueOnce(new Promise((_, reject) => (fail = reject))).mockResolvedValue(profile);
    renderWithProviders(<ProfileErrorProfile />);

    expect(region()).toHaveAttribute('aria-busy', 'true');
    expect(within(region()).queryByRole('list')).not.toBeInTheDocument();

    fail(new Error('Network down'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error profile could not load.');

    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await within(region()).findAllByRole('listitem')).toHaveLength(5);
    expect(getErrorProfile).toHaveBeenCalledTimes(2);
  });
});
