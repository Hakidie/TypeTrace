import { useCallback, useEffect, useReducer, useState } from 'react';
import { initialRainState, rainReducer } from '../lib/rain-game';

/** How often the round clock moves (spawns and the time left); the words themselves fall with CSS. */
const TICK_MS = 100;

const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * One round of word rain: the rules of `rainReducer` with a clock. The clock stops while the round is paused by hand or
 * the tab is hidden, and the stage freezes its falling words with the same `paused`, so the two stay together.
 */
export const useRainGame = () => {
  const [state, dispatch] = useReducer(rainReducer, initialRainState);
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(isHidden);

  useEffect(() => {
    const onChange = () => setHidden(isHidden());
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const playing = state.phase === 'playing';
  const paused = playing && (held || hidden);

  useEffect(() => {
    if (!playing || paused) return;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      dispatch({ type: 'tick', dt: now - last, rand: Math.random() });
      last = now;
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [playing, paused]);

  const start = useCallback((words: string[], lanes: number) => {
    setHeld(false);
    dispatch({ type: 'start', words, lanes });
  }, []);
  const input = useCallback((text: string) => dispatch({ type: 'input', text }), []);
  const land = useCallback((id: string) => dispatch({ type: 'land', id }), []);
  const togglePause = useCallback(() => setHeld((value) => !value), []);

  return { state, paused, start, input, land, togglePause };
};
