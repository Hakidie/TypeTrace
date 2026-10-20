// Reference module: copy this folder when creating a new feature (or run `npm run gen:module <name>`).
import type { AppModule } from '@/app/module.types';
import { NotesListPage } from './pages/NotesListPage';

export const notesModule: AppModule = {
  routes: [{ path: '/notes', Component: NotesListPage }],
};
