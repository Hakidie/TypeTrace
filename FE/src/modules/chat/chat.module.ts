import type { AppModule } from '@/app/module.types';
import { ChatWidget } from './components/ChatWidget';

/** No page of its own: the chat is a button in the top navigation that opens a popup under the header. */
export const chatModule: AppModule = {
  routes: [],
  navItems: [{ Component: ChatWidget }],
};
