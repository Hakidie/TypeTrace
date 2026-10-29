import { describe, expect, it } from 'vitest';
import { rainPose } from './rain-pose';

describe('rainPose', () => {
  it('is idle before the game starts', () => {
    expect(rainPose('ready', null)).toBe('idle');
  });

  it('types while playing, also right after a hit', () => {
    expect(rainPose('playing', null)).toBe('typing');
    expect(rainPose('playing', { kind: 'hop', key: 1 })).toBe('typing');
  });

  it('loses for a moment when a word lands', () => {
    expect(rainPose('playing', { kind: 'shake', key: 1 })).toBe('lose');
  });

  it('lets the end of the game win over a reaction', () => {
    expect(rainPose('won', { kind: 'shake', key: 2 })).toBe('win');
    expect(rainPose('lost', null)).toBe('lose');
  });
});
