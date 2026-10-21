import { useThemeMode } from '../hooks/use-theme-mode';
import { ModeSwitch } from './ModeSwitch';

/** Two tabs to switch the mode, Light or Dark. The themes shown on the settings page are the ones of the mode in use. */
export const ThemeTabs = () => {
  const { mode, setMode } = useThemeMode();

  return <ModeSwitch value={mode} onChange={setMode} />;
};
