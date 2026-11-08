import { AvatarSprite } from '@/modules/avatar/components/AvatarSprite';
import { DEFAULT_AVATAR } from '@/modules/avatar/types/avatar.types';
import { TypingDemo } from './TypingDemo';

/**
 * Left side of the login/register pages on wide screens: a big avatar typing, centered, above the Typing page's passage
 * typing itself; the column starts at the top, level with the form. Hidden on phones. The avatar is the default one (no API call).
 */
// The avatar's frame has 12 empty rows above the hair (`public/avatar`, 76x76) and the form's title starts about 10px below
// its box, so the avatar is pulled up until its hair is level with the top of the title.
const AVATAR_SCALE = 5;
const AVATAR_TOP_GAP_PX = 12 * AVATAR_SCALE - 10;

export const AuthBrandPanel = () => (
  <section className="hidden min-w-0 flex-col gap-6 lg:flex">
    <AvatarSprite
      look={DEFAULT_AVATAR}
      pose="typing"
      scale={AVATAR_SCALE}
      eager
      label="Avatar typing"
      className="self-center"
      style={{ marginTop: -AVATAR_TOP_GAP_PX }}
    />
    <TypingDemo />
  </section>
);
