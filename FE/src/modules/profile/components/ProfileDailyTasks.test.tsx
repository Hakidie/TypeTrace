import userEvent from '@testing-library/user-event';
import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render-with-providers';
import type { DailyTaskProgress } from '../types/profile.types';
import { ProfileDailyTasks } from './ProfileDailyTasks';

const getDailyTasks = vi.fn();

vi.mock('@/modules/profile/api/profile.api', () => ({
  profileApi: { getDailyTasks: () => getDailyTasks() },
}));

const task = (id: string, title: string, extra: Partial<DailyTaskProgress> = {}): DailyTaskProgress => ({
  id,
  title,
  description: '',
  type: 'sessions',
  target: 3,
  progress: 0,
  completed: false,
  ...extra,
});

const today = (...tasks: DailyTaskProgress[]) => ({ date: '2026-03-10', tasks });

const tasksRegion = () => screen.getByRole('region', { name: 'Daily tasks' });
/** The bar of a task (named after its title) and the item it is in. */
const barOf = (title: string) => screen.getByRole('progressbar', { name: title });
const itemOf = (title: string) => barOf(title).closest('li') as HTMLElement;

beforeEach(() => {
  getDailyTasks.mockReset();
});

describe('ProfileDailyTasks (SCRUM-112)', () => {
  it('shows each task with its description, a bar and the numbers in the unit of its type', async () => {
    getDailyTasks.mockResolvedValue(
      today(
        task('t1', 'Warm-up', { progress: 2, description: 'Finish three sessions.' }),
        task('t2', 'Long practice', { type: 'minutes', target: 15, progress: 12.5, description: 'Take your time.' }),
        task('t3', 'Speed run', { type: 'wpm', target: 40, progress: 38.5, description: 'Go fast once.' }),
        task('t4', 'Clean hands', { type: 'accuracy', target: 90, progress: 85.5, description: 'Keep it clean.' }),
      ),
    );
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findAllByRole('progressbar')).toHaveLength(4);
    expect(tasksRegion()).toHaveAttribute('aria-busy', 'false');

    const expected = [
      { title: 'Warm-up', description: 'Finish three sessions.', numbers: '2 / 3 sessions', now: '2', max: '3', filled: 2 / 3 },
      { title: 'Long practice', description: 'Take your time.', numbers: '12.5 / 15 min', now: '12.5', max: '15', filled: 12.5 / 15 },
      { title: 'Speed run', description: 'Go fast once.', numbers: '38.5 / 40 WPM', now: '38.5', max: '40', filled: 38.5 / 40 },
      { title: 'Clean hands', description: 'Keep it clean.', numbers: '85.5% / 90%', now: '85.5', max: '90', filled: 85.5 / 90 },
    ];
    for (const { title, description, numbers, now, max, filled } of expected) {
      const item = itemOf(title);
      expect(within(item).getByText(title)).toBeInTheDocument();
      expect(within(item).getByText(description)).toBeInTheDocument();
      expect(within(item).getByText(numbers)).toBeInTheDocument();
      expect(within(item).queryByText('Done')).not.toBeInTheDocument();
      expect(barOf(title)).toHaveAttribute('aria-valuemin', '0');
      expect(barOf(title)).toHaveAttribute('aria-valuemax', max);
      expect(barOf(title)).toHaveAttribute('aria-valuenow', now);
      expect(barOf(title)).toHaveAttribute('aria-valuetext', numbers);
      expect(barOf(title).firstElementChild).toHaveStyle({ width: `${filled * 100}%` });
    }
    // From the oldest template to the newest (here already in that order), and the description only where there is one.
    expect(within(tasksRegion()).getAllByRole('listitem').map((item) => within(item).getByRole('progressbar').getAttribute('aria-label'))).toEqual([
      'Warm-up',
      'Long practice',
      'Speed run',
      'Clean hands',
    ]);
    expect(screen.getAllByText('Take your time.')).toHaveLength(1);
    expect(within(itemOf('Long practice')).getByText('Take your time.')).toBeInTheDocument();
  });

  it('fills the bar of a done task and marks it Done, with the numbers reached', async () => {
    getDailyTasks.mockResolvedValue(
      today(
        task('t1', 'Warm-up', { progress: 4, completed: true }),
        task('t2', 'Speed run', { type: 'wpm', target: 40, progress: 41.2, completed: true }),
        task('t3', 'One more', { target: 1, progress: 0 }),
      ),
    );
    renderWithProviders(<ProfileDailyTasks />);

    const warmUp = await screen.findByRole('progressbar', { name: 'Warm-up' });
    // The bar stops at the target; the numbers say what was done.
    expect(warmUp).toHaveAttribute('aria-valuenow', '3');
    expect(warmUp.firstElementChild).toHaveStyle({ width: '100%' });
    expect(within(itemOf('Warm-up')).getByText('4 / 3 sessions')).toBeInTheDocument();
    expect(within(itemOf('Warm-up')).getByText('Done')).toHaveClass('text-primary');

    expect(barOf('Speed run')).toHaveAttribute('aria-valuenow', '40');
    expect(barOf('Speed run').firstElementChild).toHaveStyle({ width: '100%' });
    expect(within(itemOf('Speed run')).getByText('41.2 / 40 WPM')).toBeInTheDocument();
    expect(within(itemOf('Speed run')).getByText('Done')).toBeInTheDocument();

    expect(barOf('One more').firstElementChild).toHaveStyle({ width: '0%' });
    expect(within(itemOf('One more')).getByText('0 / 1 session')).toBeInTheDocument();
    expect(within(itemOf('One more')).queryByText('Done')).not.toBeInTheDocument();
  });

  it('shows the description of a focused accuracy task in place of the goal sentence', async () => {
    getDailyTasks.mockResolvedValue(
      today(task('t1', 'Phân biệt hỏi/ngã', { type: 'accuracy', target: 90, errorType: 'HOI_NGA_CONFUSION', description: 'Practise hỏi and ngã.' })),
    );
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findAllByRole('progressbar')).toHaveLength(1);
    const item = itemOf('Phân biệt hỏi/ngã');
    expect(within(item).getByText('Practise hỏi and ngã.')).toBeInTheDocument();
    expect(within(item).queryByText(/Reach 90% accuracy/)).not.toBeInTheDocument();
    expect(within(item).getByText('0% / 90%')).toBeInTheDocument();
  });

  it('cuts a long title on its line, keeps it whole in its tooltip, and keeps the one column of phones on the screen', async () => {
    const long = 'Type the whole passage about the Mekong Delta without looking down at the keyboard even once';
    getDailyTasks.mockResolvedValue(today(task('t1', long)));
    renderWithProviders(<ProfileDailyTasks />);

    const title = within(await screen.findByRole('listitem')).getByTitle(long);
    expect(title).toHaveTextContent(long);
    expect(title).toHaveClass('truncate');
    // `grid-cols-1` is a column no wider than the list: without it, the column grows to the title and runs off the screen.
    expect(within(tasksRegion()).getByRole('list')).toHaveClass('grid-cols-1');
  });

  it('keeps its place while the tasks load', () => {
    getDailyTasks.mockReturnValue(new Promise(() => undefined));
    renderWithProviders(<ProfileDailyTasks />);

    expect(tasksRegion()).toHaveAttribute('aria-busy', 'true');
    // Three blank tasks (skeletons) where the tasks will be.
    expect(tasksRegion().querySelectorAll('.animate-pulse')).toHaveLength(3);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('No daily tasks today.')).not.toBeInTheDocument();
  });

  it('says in one muted line that there is no task today', async () => {
    getDailyTasks.mockResolvedValue(today());
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findByText('No daily tasks today.')).toHaveClass('text-muted-foreground');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(tasksRegion()).toHaveAttribute('aria-busy', 'false');
  });

  it('says why the tasks could not load, with a retry that brings them', async () => {
    getDailyTasks
      .mockRejectedValueOnce({ response: { status: 500, data: { message: 'Tasks offline' } } })
      .mockResolvedValue(today(task('t1', 'Warm-up', { progress: 1 })));
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Daily tasks could not load. Tasks offline · Try again');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('progressbar', { name: 'Warm-up' })).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getDailyTasks).toHaveBeenCalledTimes(2);
  });

  it('lists the tasks from the oldest template to the newest, whatever order the backend picked them in', async () => {
    getDailyTasks.mockResolvedValue(
      today(
        task('65f000000000000000000003', 'Newest', { progress: 1 }),
        task('65f000000000000000000001', 'Oldest', { progress: 1 }),
        task('65f000000000000000000002', 'Middle', { progress: 1 }),
      ),
    );
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findAllByRole('progressbar')).toHaveLength(3);
    expect(within(tasksRegion()).getAllByRole('listitem').map((item) => within(item).getByRole('progressbar').getAttribute('aria-label'))).toEqual([
      'Oldest',
      'Middle',
      'Newest',
    ]);
  });

  it('shows how many tasks are done on the right of the title', async () => {
    getDailyTasks.mockResolvedValue(
      today(
        task('t1', 'One', { progress: 3, completed: true }),
        task('t2', 'Two', { progress: 1 }),
        task('t3', 'Three', { progress: 3, completed: true }),
      ),
    );
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findAllByRole('progressbar')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Daily tasks' })).toBeInTheDocument();
    expect(tasksRegion()).toHaveTextContent('2 / 3 done');
  });

  it('shows no count without tasks', async () => {
    getDailyTasks.mockResolvedValue(today());
    renderWithProviders(<ProfileDailyTasks />);

    expect(await screen.findByText('No daily tasks today.')).toBeInTheDocument();
    expect(tasksRegion()).not.toHaveTextContent('/');
  });

  it('shows "Daily mission done" under the tasks only when all of them are done', async () => {
    getDailyTasks.mockResolvedValue(today(task('t1', 'One', { progress: 3, completed: true }), task('t2', 'Two', { progress: 1 })));
    const { unmount } = renderWithProviders(<ProfileDailyTasks />);
    expect(await screen.findAllByRole('progressbar')).toHaveLength(2);
    expect(screen.queryByText('Daily mission done')).not.toBeInTheDocument();
    unmount();

    getDailyTasks.mockResolvedValue(today(task('t1', 'One', { progress: 3, completed: true }), task('t2', 'Two', { progress: 3, completed: true })));
    renderWithProviders(<ProfileDailyTasks />);
    expect(await screen.findByText('Daily mission done')).toBeInTheDocument();
    expect(tasksRegion()).toHaveTextContent('2 / 2 done');
  });
});
