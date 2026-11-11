// English passages for Practice (SCRUM-219, US2.7): a learner who types in English practices these, never the ranked duels'
// own (`passages-en.ts`, `isRanked`), so nobody rehearses a duel's passage. Every text is written for TypeTrace, so it is
// free to reuse, in plain ASCII, with capitals and punctuation for the English error types to have their chances.
// Add passages here and run `npm run import:passages:en-practice`: passages already in the bank (same title) are left untouched.
import type { PassageSeed } from './passages';
import { ENGLISH_PASSAGE_SOURCE } from './passages-en';

const passage = (title: string, content: string): PassageSeed => ({ title, content, source: ENGLISH_PASSAGE_SOURCE, language: 'en' });

export const ENGLISH_PRACTICE_PASSAGE_LIST: readonly PassageSeed[] = [
  passage(
    'Watering the Plants',
    'Every evening Lan fills a small blue can and walks along the balcony. The basil needs a little water, the mint needs a lot, and the cactus needs almost none. She talks to each pot as she goes, because her grandmother once said that plants grow better when someone listens to them. Nobody can prove it, but the balcony is very green.'
  ),
  passage(
    'A Quiet Saturday',
    "On quiet Saturdays the street wakes up slowly. A cat stretches on a warm wall, a shop owner pulls up her metal door, and the smell of coffee drifts from the corner cafe. Children ride past on bicycles, ringing their bells for no reason at all. By noon the street is busy again, but the calm morning stays in everyone's mood."
  ),
  passage(
    'The New Keyboard',
    'When Minh opened the box, the new keyboard smelled of plastic and promise. The keys were quiet, the spacebar was wide, and every letter felt easy to reach. He typed his name, then a whole sentence, then a short poem about rain. His fingers were still slow, but for the first time they did not feel lost.'
  ),
  passage(
    'Fruit at the Market',
    'The fruit seller arranges her table like a painting: yellow mangoes on the left, green pomelos in the middle, and red dragon fruit at the front. She knows which customers like sweet fruit and which ones want something sour. When it rains, she covers everything with a clear sheet and keeps smiling at the people who hurry by.'
  ),
  passage(
    'Learning to Swim',
    'My little brother was afraid of the water until last summer. Our teacher held his hands and counted slowly while he kicked his legs. After a week he could float on his back and look at the sky. Now he jumps into the pool before anyone else, and he tells everyone that he was never afraid.'
  ),
  passage(
    'Paper Boats',
    'After a heavy rain, the children on our street fold paper boats from old notebooks. They write their names on the sails and race them down the water at the edge of the road. Most boats sink after a few meters, but one always sails a little farther, and its owner is proud for the rest of the day.'
  ),
  passage(
    'The Bus Driver',
    'Mr. Tuan has driven the same bus for twelve years. He knows which passengers get off at the hospital, which ones go to the university, and which old lady needs an extra minute at the door. He hums old songs while he drives. Some mornings the whole bus hums along with him, quietly, without noticing.'
  ),
  passage(
    'A Rainy Day Plan',
    'When it rains all day, we stay inside and make a plan. First we clean the kitchen, then we bake simple cookies, and finally we watch a movie with the lights off. The cookies are never perfect. Some are too dark and some are too soft, but we eat every single one before the movie ends.'
  ),
  passage(
    "Our Neighbor's Dog",
    "Our neighbor's dog is called Pepper. She is small, brown, and very serious about her job, which is watching the gate. Every time the mail arrives, she barks three times, then sits down as if she has finished an important report. In the afternoon she sleeps in the sun, still keeping one ear open."
  ),
  passage(
    'Writing a Letter',
    'Nobody writes letters anymore, so my aunt decided to send one to every person in our family. She used thick paper, a black pen, and her neatest handwriting. Each letter told a different memory. Mine was about the day we got lost at the zoo and found our way back by following the sound of the elephants.'
  ),
  passage(
    'Morning Tea',
    "Grandfather makes tea at six o'clock every morning. He warms the small pot first, adds the leaves, and waits exactly two minutes. Then he pours one cup for himself and one for the empty chair beside him, where Grandmother used to sit. He says the tea tastes better that way, and nobody in the house disagrees."
  ),
  passage(
    'The School Garden',
    'Our class planted a garden behind the school in March. We grew tomatoes, beans, and a row of sunflowers that became taller than our teacher. Every Friday two students checked the soil and pulled out weeds. In June we cooked the vegetables together and agreed that food tastes better when you have watched it grow.'
  ),
  passage(
    'Train Window',
    'From the train window, the country moves like a long film. Rice fields shine after the rain, buffaloes stand still in the mud, and small houses appear and disappear between the trees. I always choose a window seat, even on night trains, because I like to see the lights of towns slide past in the dark.'
  ),
  passage(
    'A Broken Umbrella',
    'My umbrella broke on the way to work this morning. The wind turned it inside out, and one of the metal ribs snapped with a sad little sound. A stranger at the bus stop shared his umbrella with me until my bus arrived. I never learned his name, but I will remember his kindness every time it rains.'
  ),
  passage(
    'Saving Coins',
    'When I was eight, I kept my coins in a glass jar on the shelf. Every week I counted them, sorted them by size, and wrote the total on a piece of paper. It took almost a year to save enough for a bicycle. The bicycle is gone now, but I still remember the sound of coins falling into that jar.'
  ),
  passage(
    'The Night Before Exams',
    'The night before exams, our house becomes very quiet. My sister reads her notes aloud in a soft voice, my father turns the television down, and my mother brings us cut fruit without saying a word. I try to sleep early, but I always check my pencils, my ruler, and my student card one more time.'
  ),
  passage(
    'Fixing a Bicycle',
    'Fixing a bicycle teaches patience. First you find the hole in the tire by listening for the air, then you clean the rubber, add glue, and press the patch firmly for a full minute. If you rush, the patch will fail. If you wait, the wheel will carry you home without a single complaint.'
  ),
  passage(
    'Clouds and Shapes',
    'Lying on the grass, we turned the clouds into animals. One looked like a rabbit with very long ears, another like a whale opening its mouth. A slow, gray cloud became a sleeping elephant until the wind pulled it apart. We laughed, gave the pieces new names, and stayed there until the sky turned orange.'
  ),
  passage(
    'Cleaning the Room',
    'Cleaning my room always takes longer than I plan. I start with the desk, but then I find old photos, a lost earphone, and a note from a friend I had forgotten. Each thing tells a small story, so I stop to read it. Two hours later, the room is clean and my head is full of memories.'
  ),
  passage(
    'Speed and Patience',
    'Fast typing is not about rushing. It comes from small, correct movements repeated many times. When you make a mistake, slow down, fix the habit, and then let your speed return on its own. A calm typist with steady hands will always finish before a nervous one who has to delete half of every sentence.'
  )
];
