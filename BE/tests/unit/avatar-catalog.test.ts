import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR, itemKey, unlockOf } from '../../src/data/avatar-catalog';

describe('avatar catalog', () => {
  it('gives the starter items for free', () => {
    for (const [slot, item] of [
      ['skin', 'umber'],
      ['face', 'cute'],
      ['hair', 'short-brown'],
      ['hair', 'long-pink'],
      ['top', 'mint'],
      ['bottom', 'tights-black'],
      ['shoes', 'sneakers-brown']
    ] as const) {
      expect(unlockOf(slot, item), `${slot} ${item}`).toEqual({ kind: 'free' });
    }
  });

  it('sells the other items at the price of their slot', () => {
    expect(unlockOf('hair', 'buns-pink')).toEqual({ kind: 'shop', price: 100 });
    expect(unlockOf('top', 'dress-sailor-navy')).toEqual({ kind: 'shop', price: 150 });
    expect(unlockOf('top', 'sweater-red')).toEqual({ kind: 'shop', price: 120 });
    expect(unlockOf('bottom', 'plaid-red')).toEqual({ kind: 'shop', price: 80 });
    expect(unlockOf('shoes', 'boots-black')).toEqual({ kind: 'shop', price: 80 });
    expect(unlockOf('back', 'cape-red')).toEqual({ kind: 'shop', price: 250 });
    expect(unlockOf('effect', 'hearts')).toEqual({ kind: 'shop', price: 200 });
  });

  it('keeps the tier rewards out of the shop', () => {
    expect(unlockOf('headwear', 'halo')).toEqual({ kind: 'tier', tier: 'legend' });
    expect(unlockOf('headwear', 'crown')).toEqual({ kind: 'tier', tier: 'diamond' });
    expect(unlockOf('back', 'angel-wings')).toEqual({ kind: 'tier', tier: 'platinum' });
    expect(unlockOf('effect', 'stars')).toEqual({ kind: 'tier', tier: 'gold' });
  });

  it('knows no item of another slot', () => {
    expect(unlockOf('hair', 'crown')).toBeUndefined();
    expect(unlockOf('top', 'nope')).toBeUndefined();
  });

  it('dresses a new avatar in free items only, and names owned items by slot', () => {
    for (const [slot, item] of Object.entries(DEFAULT_AVATAR)) expect(unlockOf(slot as never, item as string), slot).toEqual({ kind: 'free' });
    expect(itemKey('hair', 'buns-pink')).toBe('hair:buns-pink');
  });
});
