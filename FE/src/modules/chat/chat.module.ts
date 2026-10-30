import { MessageCircle } from 'lucide-react';
import type { AppModule } from '@/app/module.types';
import { ChatWidget } from './components/ChatWidget';
import { chatPopupStore } from './store/chat-popup.store';

/** No page of its own: "AI chat" in the account menu opens a popup under the header (drawn by the widget). */
export const chatModule: AppModule = {
  routes: [],
  menuItems: [{ label: 'AI chat', icon: MessageCircle, onSelect: chatPopupStore.toggle }],
  widgets: [ChatWidget],
};
