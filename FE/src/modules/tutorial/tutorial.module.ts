import type { AppModule } from '@/app/module.types';
import { TutorialGuide } from './components/TutorialGuide';

/** No page of its own: Ping guides the learner on the Typing page (the tour after sign-up and the guide of each mode). */
export const tutorialModule: AppModule = {
  routes: [],
  widgets: [TutorialGuide],
};
