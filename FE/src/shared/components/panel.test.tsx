import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Panel } from './panel';

describe('Panel', () => {
  it('shows the title, description, actions and content', () => {
    render(
      <Panel title="Add passage" description="Write a new passage." actions={<button type="button">New</button>}>
        content here
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Add passage' })).toBeInTheDocument();
    expect(screen.getByText('Write a new passage.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByText('content here')).toBeInTheDocument();
  });

  it('has no header row without a title', () => {
    render(<Panel>only content</Panel>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByText('only content')).toBeInTheDocument();
  });

  it('can be transparent', () => {
    const { container } = render(<Panel transparent>content</Panel>);
    expect(container.firstChild).toHaveClass('bg-transparent');
    expect(container.firstChild).toHaveClass('border');
  });

  it('can be bare: no border and no padding', () => {
    const { container } = render(<Panel bare>content</Panel>);
    expect(container.firstChild).toHaveClass('border-0');
    expect(screen.getByText('content')).toHaveClass('p-0');
  });

  it('can center its title and description', () => {
    render(
      <Panel title="Join" description="With a code" centerTitle>
        content
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Join' }).parentElement?.parentElement).toHaveClass('text-center', 'sm:justify-center');
  });

  it('shows a tooltip on the title', async () => {
    render(
      <Panel title="Join" titleTip="Use the code of a friend">
        content
      </Panel>,
    );
    await userEvent.setup().hover(screen.getByText('Join'));
    expect((await screen.findAllByRole('tooltip'))[0]).toHaveTextContent('Use the code of a friend');
  });
});
