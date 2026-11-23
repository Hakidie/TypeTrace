/**
 * `GET /admin/ai/settings` (and its `PUT`): how many passages the AI may write for one learner (Weak spots) a day, which 0
 * turns off, and a minute.
 */
export interface AiSettings {
  lessonsPerDay: number;
  lessonsPerMinute: number;
}
