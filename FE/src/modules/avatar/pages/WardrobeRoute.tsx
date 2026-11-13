import { useWardrobeVersion } from '../hooks/use-wardrobe-version';
import { WardrobePage } from './WardrobePage';
import { WardrobeV2Page } from './WardrobeV2Page';

/** `/wardrobe`: the version the user chose (Settings, or the switch beside the title); the classic one until then. */
export const WardrobeRoute = () => (useWardrobeVersion().version === 'modern' ? <WardrobeV2Page /> : <WardrobePage />);
