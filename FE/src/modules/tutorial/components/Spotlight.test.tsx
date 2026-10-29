import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Spotlight } from './Spotlight';

describe('Spotlight', () => {
  it('draws nothing without its target', () => {
    const { container } = render(<Spotlight target="nowhere" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('frames its target', () => {
    const target = document.createElement('div');
    target.dataset.tutorial = 'passage';
    document.body.append(target);

    const { getByTestId } = render(<Spotlight target="passage" />);

    expect(getByTestId('tutorial-spotlight')).toBeInTheDocument();
    target.remove();
  });
});
