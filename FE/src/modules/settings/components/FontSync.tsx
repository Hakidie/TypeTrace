import { useEffect } from 'react';
import { applyFont, storeFont } from '../lib/fonts';
import { useSettings } from '../hooks/use-settings';

/**
 * Draws nothing: keeps the font of the whole interface (SCRUM-158) the one the signed-in learner chose. It loads the font's files,
 * sets `--app-font` on `<html>` and remembers the font in this browser, which `main.tsx` reads before the first paint.
 */
export const FontSync = () => {
  const { fontFamily } = useSettings();
  useEffect(() => {
    void applyFont(fontFamily);
    storeFont(fontFamily);
  }, [fontFamily]);
  return null;
};
