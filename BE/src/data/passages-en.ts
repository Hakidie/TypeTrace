// English starter passages for ranked duels (ranked duel design, phase 1). Every text is written for TypeTrace, so it is
// free to reuse. Each one has 30 to 80 words (the range a ranked match picks from) and plain ASCII only.
// Add passages here and run `npm run import:passages:en`: passages already in the bank (same title) are left untouched.
import type { PassageSeed } from './passages';

export const ENGLISH_PASSAGE_SOURCE = 'Written for TypeTrace';

const passage = (title: string, content: string): PassageSeed => ({ title, content, source: ENGLISH_PASSAGE_SOURCE, language: 'en' });

export const ENGLISH_PASSAGE_LIST: readonly PassageSeed[] = [
  passage(
    'The Morning Bus',
    'Every morning the bus stops at the corner near the bakery. The driver waves, the doors open, and the smell of warm bread follows the passengers inside. Some read the news, some look out of the window, and a few simply close their eyes for ten more minutes of rest.'
  ),
  passage(
    'A Small Garden',
    'Behind the house there is a small garden with tomatoes, mint, and two tired sunflowers. It is not much, but on summer evenings it feels like a park. We water the plants after dinner, count the new flowers, and argue about who forgot to close the gate.'
  ),
  passage(
    'Rainy Afternoon',
    'The rain started just after lunch and did not stop until the street lights came on. Inside, the kettle whistled, a cat slept on the sofa, and the only sound was the steady tapping on the roof. It was the perfect day to finish a long book.'
  ),
  passage(
    'Learning to Ride',
    'My first bicycle was red, heavy, and a little too big for me. I fell more times than I can remember. Then one cool morning my father let go of the seat without telling me, and I rode all the way to the end of the street alone.'
  ),
  passage(
    'The Night Market',
    'When the sun goes down, the empty parking lot turns into a night market. Small tents glow with yellow lamps, cooks shout their prices, and the air smells of grilled corn and sweet sauce. People walk slowly, taste everything, and stay much later than they planned.'
  ),
  passage(
    'Packing for a Trip',
    'Packing always takes longer than expected. First the clothes, then the charger, then the snacks for the road. Halfway through, someone remembers the umbrella, and someone else cannot find their passport. In the end the bag is too full, but somehow everything important is inside.'
  ),
  passage(
    'The Library Corner',
    'There is a quiet corner on the second floor of the library where the light is soft and the chairs are old but comfortable. Students come here to study, read, or simply rest between classes. Nobody talks, yet it never feels lonely.'
  ),
  passage(
    'Cooking Together',
    'On Sundays the whole family cooks lunch together. One person washes the vegetables, another cuts the onions, and the youngest is in charge of tasting. The kitchen gets loud and messy, but when the food is finally on the table, everyone agrees it was worth it.'
  ),
  passage(
    'A Walk by the River',
    'The path along the river is busy in the morning and calm at night. Runners pass by in bright shoes, old friends sit on benches, and small boats move slowly under the bridge. Walking there for half an hour makes even a hard day feel lighter.'
  ),
  passage(
    'The Lost Key',
    'I searched every pocket, every bag, and every drawer in the house. I checked under the bed and behind the sofa. After an hour I gave up and made a cup of tea. When I opened the fridge for the milk, there was the key, sitting next to the butter.'
  ),
  passage(
    'First Day at Work',
    'On my first day at work I arrived twenty minutes early and waited outside the door. Everyone was kind, but I forgot most of their names before lunch. By the end of the week I knew where the coffee was, which printer worked, and who told the best jokes.'
  ),
  passage(
    'Stars Over the Hills',
    'Far from the city, the night sky looks completely different. Without the bright lights, thousands of stars appear, and the long white band of the galaxy stretches from one hill to another. We lay on the grass in silence and tried to count them, but we never got very far.'
  ),
  passage(
    'The Old Radio',
    'My grandmother keeps an old radio on the kitchen shelf. It has one broken button and a long silver antenna. Every evening she turns it on for the music program, and the whole house fills with songs that she still knows by heart.'
  ),
  passage(
    'Building a Sandcastle',
    'Building a sandcastle is serious work. You need wet sand, a good bucket, and a friend who is not afraid of getting dirty. The towers rise, the walls get thicker, and then a single wave arrives and takes half of it away. So you start again.'
  ),
  passage(
    'A Letter from a Friend',
    'Today a real letter arrived in the mail, written by hand on blue paper. My friend wrote about her new city, her noisy neighbors, and the strange food at her favorite cafe. I read it twice, smiled at the drawings in the corners, and started my reply at once.'
  ),
  passage(
    'The School Concert',
    'The school concert was supposed to start at seven, but the piano was late and the lights did not work. The children waited backstage in their best clothes, nervous and excited. When the first song finally began, the parents forgot all about the delay and clapped louder than ever.'
  ),
  passage(
    'Fixing the Fence',
    'Last weekend we finally fixed the old wooden fence. We pulled out the broken boards, painted the new ones white, and hit our fingers with the hammer more than once. By evening the fence looked almost new, and the neighbor came over to say it was the best on the street.'
  ),
  passage(
    'Morning Exercise',
    'Five minutes of exercise in the morning can change the whole day. Stretch your arms, roll your shoulders, and take a few deep breaths by the open window. It does not have to be hard or long. The important thing is to do it every day, even when you would rather stay in bed.'
  ),
  passage(
    'The Mountain Village',
    'The village sits high in the mountains, where the clouds often pass below the houses. The roads are narrow and steep, and the mornings are cold even in summer. People there grow tea, keep goats, and always seem to have time to stop and talk with a visitor.'
  ),
  passage(
    'Typing Practice',
    'Fast typing is not about moving your fingers as quickly as possible. It is about keeping a steady rhythm, looking at the screen instead of the keys, and fixing mistakes calmly. Practice a little every day, and one morning you will notice that the words simply flow.'
  )
];
