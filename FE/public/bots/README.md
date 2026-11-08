# Bot duel sprites

The three bots of the Bot duel minigame (`BotSprite`, `BOT_LEVELS` in `FE/src/modules/tutorial`): one strip of 4
frames (64×88 each) per move, `<bot>-<idle|typing|win|lose>.png`. Like Ping and the avatars they keep their own colors.

| File | Bot | Level |
|---|---|---|
| `bong-*` | Bông, a sleepy boy in a red beanie | Dễ |
| `nhip-*` | Nhịp, a DJ girl with a ponytail and headphones | Vừa |
| `da-*` | Dạ, a demon boy with horns and bat wings | Khó |

Made on 2026-11-08 for SCRUM-247: Bông and Dạ's body were generated with CellCog from script drafts; Nhịp, and Dạ's
hair and horns, were redrawn pixel by pixel by script. Replace a whole strip rather than editing pixels by hand.
