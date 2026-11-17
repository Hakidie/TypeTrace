// English placement passages (SCRUM-305, US2.9): the placement test in English picks one of them at random, as the Vietnamese
// test picks one of the placement passages of `passages.ts`. About 140 to 150 words each, like the Vietnamese ones, so the two
// tests ask the same effort, and at least 20 chances of every English error type each (checked in a test): plenty of
// commas, full stops and apostrophes for the punctuation, spread over the whole text, since a slow learner only types the
// beginning in 3 minutes. Never ranked: the ranked duels keep their own passages (`passages-en.ts`), and a passage is never
// both. Written for TypeTrace, in plain ASCII.
// Add passages here and run `npm run import:passages:en-placement`: passages already in the bank (same title) are left untouched.
import type { PassageSeed } from './passages';
import { ENGLISH_PASSAGE_SOURCE } from './passages-en';

const passage = (title: string, content: string): PassageSeed => ({
  title,
  content,
  source: ENGLISH_PASSAGE_SOURCE,
  language: 'en',
  isPlacement: true
});

export const ENGLISH_PLACEMENT_PASSAGE_LIST: readonly PassageSeed[] = [
  passage(
    'Placement test: A Morning at the Harbor',
    "Every Saturday, my uncle wakes up before sunrise and walks to the harbor. The air smells of salt, rope, and fresh bread from the corner bakery. Fishermen check their nets, laugh loudly, and wave at anyone who passes by. My uncle doesn't fish anymore, but he still knows every boat by name. He tells me which ones are fast, which ones leak, and which captain sings while he works. Last week, a small blue boat came back with a huge catch, and the whole dock cheered. We bought two fish, a bag of shrimp, and a jar of honey from an old woman's stall. On the way home, the sun climbed over the hills, and the water turned gold. I asked my uncle if he missed the sea. He smiled, shook his head, and said it never really leaves you."
  ),
  passage(
    'Placement test: The New Library',
    "Our town finally opened a new library next to the park, and it's bigger than anyone expected. On the first day, families lined up early, holding umbrellas, coffee cups, and lists of books they wanted to find. Inside, the shelves reach almost to the ceiling, and the reading room has wide windows that face the trees. Children sit on soft cushions while a librarian reads them stories about dragons, pirates, and brave little mice. Students study quietly upstairs, where the desks have lamps and outlets for laptops. I signed up for a card, borrowed three novels, and found a cookbook for my sister. Before leaving, I noticed a board full of notes from visitors. One said thank you for this place. Another asked for more science books. I'll come back next week, because there's still a whole floor I haven't seen."
  ),
  passage(
    "Placement test: Grandpa's Garden",
    "Grandpa's garden is small, but it feeds our whole family all summer. He plants tomatoes, beans, peppers, and lettuce in neat rows, and he never forgets to water them in the evening. Each morning, he walks between the beds with a cup of tea, checking every leaf for bugs. When I visit, he hands me a basket and lets me pick whatever is ripe. Last July, a storm knocked down the fence, flattened the corn, and scattered the flower pots. I thought he'd be upset, but he simply laughed, rolled up his sleeves, and started again. We fixed the fence together, tied the plants to stakes, and moved the pots near the wall. By August, the garden looked better than before. Grandpa says plants are patient teachers. They don't rush, they don't complain, and they always grow toward the light."
  ),
  passage(
    'Placement test: The School Trip',
    "On Friday, our class took a bus to the science museum in the city. The ride was long, so we played word games, shared snacks, and watched the fields roll past the windows. When we arrived, our teacher split us into small groups and gave each group a map. My group started with the space room, where a model of the moon hung from the ceiling. Next, we tried a machine that measures how fast you react, and I wasn't as quick as I'd hoped. After lunch, a guide showed us how bridges carry heavy loads without breaking. We built tiny bridges from sticks, tape, and string, then tested them with coins. Ours held twelve coins before it fell! On the way home, everyone was tired but happy. I still keep the museum map on my desk, next to my notebook."
  ),
];
