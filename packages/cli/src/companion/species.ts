import type { SpeciesDef } from "./types.js"

export const SPECIES: SpeciesDef[] = [
  // ── COMMON (0 XP) ──────────────────────────────────────────────────────────

  {
    id: "cat", name: "Cat", rarity: "common", xpRequired: 0,
    colors: { idle: "#d77757", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#f9a8d4", sleeping: "#94a3b8" },
    frames: {
      idle: [
        [" \\    /\\", "  )  ( ')", " (  /  )", "  \\(__)|"],
        [" \\    /\\", "  )  ( -)", " (  /  )", "  \\(__)|"],
        [" \\    /\\", "  )  ( ^)", " (  /  )", "  \\(__)~"],
        [" \\    /\\", "  )  ( ')", " (  /  )", "  \\(__)/"],
      ],
      thinking: [" \\    /\\", "  )  ( ?)", " (  /  )", "  \\(__)|"],
      working:  [" \\    /\\", "  )  ( *)", " (  /  )", "  \\(__)/"],
      error:    [" \\    /\\", "  )  ( x)", " (  /  )", "  \\(__)|"],
      happy:    [" \\    /\\", "  )  ( ♥)", " (  /  )", "  \\(__)~"],
      sleeping: [" \\    /\\", "  )  ( -)", " (  z  )", "  \\(__)|"],
    },
  },

  {
    id: "dog", name: "Dog", rarity: "common", xpRequired: 0,
    colors: { idle: "#c8a97e", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fde68a", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  ^ ^  ", " (OwO) ", " (   ) ", "  u_u  "],
        ["  ^ ^  ", " (OwU) ", " (   ) ", "  u_u  "],
        ["  ^ ^  ", " (OwO) ", " (   ) ", "  uUu  "],
      ],
      thinking: ["  ^ ^  ", " (O?O) ", " (   ) ", "  u_u  "],
      working:  ["  ^ ^  ", " (O*O) ", " ( ! ) ", "  uUu  "],
      error:    ["  ^ ^  ", " (O×O) ", " (   ) ", "  u.u  "],
      happy:    ["  ^ ^  ", " (OwO) ", " ( ♥ ) ", "  uUu  "],
      sleeping: ["  ^ ^  ", " (-w-) ", " ( z ) ", "  u_u  "],
    },
  },

  {
    id: "rabbit", name: "Rabbit", rarity: "common", xpRequired: 0,
    colors: { idle: "#f0e6d3", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fda4af", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  (\\ /)", "  (._.) ", "  ( u ) ", "   uUu  "],
        ["  (/\\/) ", "  (._.) ", "  ( u ) ", "   uUu  "],
        ["  (\\ /)", "  (^.^) ", "  ( u ) ", "   uUu  "],
      ],
      thinking: ["  (\\ /)", "  (?.?) ", "  ( u ) ", "   uUu  "],
      working:  ["  (\\ /)", "  (*.*) ", "  ( u ) ", "   uUu  "],
      error:    ["  (\\ /)", "  (x.x) ", "  ( u ) ", "   u.u  "],
      happy:    ["  (\\ /)", "  (♥.♥) ", "  ( u ) ", "   uUu  "],
      sleeping: ["  (\\ /)", "  (-.-) ", "  (zzz) ", "   u_u  "],
    },
  },

  {
    id: "penguin", name: "Penguin", rarity: "common", xpRequired: 0,
    colors: { idle: "#e2e8f0", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#bfdbfe", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["   ___ ", "  (o_o)", " (  :  )", "  /   \\"],
        ["   ___ ", "  (o_o)", " (  :  )", "  /  \\/"],
        ["   ___ ", "  (^_^)", " (  :  )", "  /   \\"],
      ],
      thinking: ["   ___ ", "  (o?o)", " (  :  )", "  /   \\"],
      working:  ["   ___ ", "  (o*o)", " (  :  )", "  \\ | /"],
      error:    ["   ___ ", "  (o×o)", " (  :  )", "  /   \\"],
      happy:    ["   ___ ", "  (♥_♥)", " (  :  )", "  /   \\"],
      sleeping: ["   ___ ", "  (-_-)", " (  z  )", "  /   \\"],
    },
  },

  // ── UNCOMMON (100 XP) ──────────────────────────────────────────────────────

  {
    id: "ghost", name: "Ghost", rarity: "uncommon", xpRequired: 100,
    colors: { idle: "#e2e8f0", thinking: "#a5b4fc", working: "#fde68a", error: "#ff6b6b", happy: "#d8b4fe", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["   ___  ", "  (o o) ", "  (   ) ", " /\\_/\\_/"],
        ["   ___  ", "  (- -) ", "  (   ) ", " /\\_/\\_/"],
        ["   ___  ", "  (O O) ", "  ( ~ ) ", " /\\_/\\_/"],
      ],
      thinking: ["   ___  ", "  (? ?) ", "  (   ) ", " /\\_/\\_/"],
      working:  ["   ___  ", "  (* *) ", "  (   ) ", " /\\_/\\_/"],
      error:    ["   ___  ", "  (x x) ", "  ( ! ) ", " /\\_/\\_/"],
      happy:    ["   ___  ", "  (♥ ♥) ", "  ( ~ ) ", " /\\_/\\_/"],
      sleeping: ["   ___  ", "  (- -) ", "  (zzz) ", " /\\_/\\_/"],
    },
  },

  {
    id: "owl", name: "Owl", rarity: "uncommon", xpRequired: 100,
    colors: { idle: "#a97c50", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fde68a", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  ,___, ", " (O . O)", "  )___(  ", "  -\"-\"- "],
        ["  ,___, ", " (- . -)", "  )___(  ", "  -\"-\"- "],
        ["  ,___, ", " (O . O)", "  )___(  ", "  ~\"~\"~ "],
      ],
      thinking: ["  ,___, ", " (? . ?)", "  )___(  ", "  -\"-\"- "],
      working:  ["  ,___, ", " (* . *)", "  )___(  ", "  -\"-\"- "],
      error:    ["  ,___, ", " (x . x)", "  )___(  ", "  -\"-\"- "],
      happy:    ["  ,___, ", " (♥ . ♥)", "  )___(  ", "  ~\"~\"~ "],
      sleeping: ["  ,___, ", " (- . -)", "  )___(  ", "  zzz    "],
    },
  },

  {
    id: "fox", name: "Fox", rarity: "uncommon", xpRequired: 100,
    colors: { idle: "#e2723a", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fda4af", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  /\\_/\\ ", " ( >.< )", "  \\___/ ", "   | |  "],
        ["  /\\^/\\ ", " ( >w< )", "  \\___/ ", "   | |  "],
        ["  /\\_/\\ ", " ( >w< )", "  \\___/ ", "   |~|  "],
      ],
      thinking: ["  /\\_/\\ ", " ( >?< )", "  \\___/ ", "   | |  "],
      working:  ["  /\\_/\\ ", " ( >*< )", "  \\___/ ", "   |/|  "],
      error:    ["  /\\_/\\ ", " ( >x< )", "  \\___/ ", "   | |  "],
      happy:    ["  /\\_/\\ ", " ( >♥< )", "  \\___/ ", "   |~|  "],
      sleeping: ["  /\\_/\\ ", " ( -.- )", "  \\___/ ", "   | |  "],
    },
  },

  {
    id: "duck", name: "Duck", rarity: "uncommon", xpRequired: 100,
    colors: { idle: "#facc15", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fde68a", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["    _   ", "   (\">  ", "   /|_\\ ", "  (___)  "],
        ["    _   ", "   (\">  ", "   /|_\\ ", "  (_QQ_) "],
        ["    _   ", "   (^>  ", "   /|_\\ ", "  (~~~)  "],
      ],
      thinking: ["    _   ", "   (?>  ", "   /|_\\ ", "  (___)  "],
      working:  ["    _   ", "   (*>  ", "   /|_\\ ", "  (_!_)  "],
      error:    ["    _   ", "   (x>  ", "   /|_\\ ", "  (___)  "],
      happy:    ["    _   ", "   (♥>  ", "   /|_\\ ", "  (~♥~)  "],
      sleeping: ["    _   ", "   (->  ", "   /|_\\ ", "  (zzz)  "],
    },
  },

  {
    id: "bear", name: "Bear", rarity: "uncommon", xpRequired: 100,
    colors: { idle: "#a97c50", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#fda4af", sleeping: "#94a3b8" },
    frames: {
      idle: [
        [" (q . p) ", " (U w U) ", " (     ) ", "  \\___/  "],
        [" (q . q) ", " (U w U) ", " (     ) ", "  \\___/  "],
        [" (q . p) ", " (U ♥ U) ", " (     ) ", "  \\___/  "],
      ],
      thinking: [" (q . p) ", " (U ? U) ", " (     ) ", "  \\___/  "],
      working:  [" (q . p) ", " (U * U) ", " (  !  ) ", "  \\___/  "],
      error:    [" (q . p) ", " (U x U) ", " (     ) ", "  \\___/  "],
      happy:    [" (q . p) ", " (U ♥ U) ", " (     ) ", "  \\___/  "],
      sleeping: [" (q . p) ", " (-  -) ",  " ( zzz ) ", "  \\___/  "],
    },
  },

  {
    id: "snail", name: "Snail", rarity: "uncommon", xpRequired: 150,
    colors: { idle: "#84cc16", thinking: "#7ab4e8", working: "#f0a500", error: "#ff6b6b", happy: "#bef264", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["     @   ", "    (o>  ", "  ~~(__) ", "    /  \\ "],
        ["     @   ", "    (o>  ", "  ~~(__) ", "   / /\\ \\"],
        ["     @   ", "    (^>  ", "  ~~(__) ", "    /  \\ "],
      ],
      thinking: ["     @   ", "    (?>  ", "  ~~(__) ", "    /  \\ "],
      working:  ["     @   ", "    (*>  ", "  ~~(__) ", "    /  \\ "],
      error:    ["     @   ", "    (x>  ", "  ~~(__) ", "    /  \\ "],
      happy:    ["     @   ", "    (♥>  ", "  ~~(__) ", "    /  \\ "],
      sleeping: ["     @   ", "    (->  ", "  ~~(zz) ", "    /  \\ "],
    },
  },

  // ── RARE (300 XP) ──────────────────────────────────────────────────────────

  {
    id: "dragon", name: "Dragon", rarity: "rare", xpRequired: 300,
    colors: { idle: "#22d3ee", thinking: "#a5b4fc", working: "#f0a500", error: "#ff6b6b", happy: "#86efac", sleeping: "#94a3b8" },
    frames: {
      idle: [
        [" <(°v°)> ", "(  ===  )", "  \\_^_/  ", "  /   \\~ "],
        [" <(°v°)> ", "(  ===  )", "  \\_^_/  ", "  /   \\≈ "],
        [" <(^v^)> ", "(  ===  )", "  \\_^_/  ", "  /   \\~ "],
      ],
      thinking: [" <(°?°)> ", "(  ===  )", "  \\_^_/  ", "  /   \\~ "],
      working:  [" <(°*°)> ", "(  ==>  )", "  \\_^_/  ", "  /=> \\~ "],
      error:    [" <(°!°)> ", "(  ===  )", "  \\_^_/  ", "  /   \\~ "],
      happy:    [" <(♥v♥)> ", "(  ===  )", "  \\_^_/  ", "  /   \\~ "],
      sleeping: [" <(-v-)> ", "(  ===  )", "  \\_^_/  ", "  /zzz \\  "],
    },
  },

  {
    id: "cactus", name: "Cactus", rarity: "rare", xpRequired: 300,
    colors: { idle: "#4ade80", thinking: "#7ab4e8", working: "#86efac", error: "#ff6b6b", happy: "#bef264", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["    |    ", "  _\\|/_  ", "  (o_o)  ", "   | |   "],
        ["    *    ", "  _\\|/_  ", "  (o_o)  ", "   | |   "],
        ["   \\|/   ", "  _\\|/_  ", "  (o_o)  ", "   | |   "],
      ],
      thinking: ["    |    ", "  _\\|/_  ", "  (o_?)  ", "   |?|   "],
      working:  ["   \\|/   ", "  _\\|/_  ", "  (*_*)  ", "   | |   "],
      error:    ["    |    ", "  _\\|/_  ", "  (x_x)  ", "   | |   "],
      happy:    ["    *    ", "  _\\|/_  ", "  (♥_♥)  ", "   | |   "],
      sleeping: ["    |    ", "  _\\|/_  ", "  (-_-)  ", "  zzz    "],
    },
  },

  {
    id: "mushroom", name: "Mushroom", rarity: "rare", xpRequired: 300,
    colors: { idle: "#ef4444", thinking: "#a5b4fc", working: "#f0a500", error: "#dc2626", happy: "#fda4af", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  /~~~\\  ", " /o   o\\ ", "(  ___  )", " \\_____/ "],
        ["  /~~~\\  ", " /◉   ◉\\ ", "(  ___  )", " \\_____/ "],
        ["  /*~*\\  ", " /o   o\\ ", "(  ___  )", " \\_____/ "],
      ],
      thinking: ["  /~~~\\  ", " /?   ?\\ ", "(  ___  )", " \\_____/ "],
      working:  ["  /~~~\\  ", " /*   *\\ ", "(  ≡≡≡  )", " \\_____/ "],
      error:    ["  /~~~\\  ", " /x   x\\ ", "(  !!!  )", " \\_____/ "],
      happy:    ["  /~~~\\  ", " /♥   ♥\\ ", "(  ___  )", " \\_____/ "],
      sleeping: ["  /~~~\\  ", " /-   -\\ ", "(  zzz  )", " \\_____/ "],
    },
  },

  {
    id: "blob", name: "Blob", rarity: "rare", xpRequired: 350,
    colors: { idle: "#60a5fa", thinking: "#a5b4fc", working: "#fde68a", error: "#ff6b6b", happy: "#bfdbfe", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["  _____  ", " / o o \\ ", "(   ~   )", " \\_____/ "],
        ["  _____  ", " / ° ° \\ ", "(   ~   )", " \\_____/ "],
        ["  _______", " /  o o  \\", "(    ~   )", " \\_____/ "],
      ],
      thinking: ["  _____  ", " / ? ? \\ ", "(   ~   )", " \\_____/ "],
      working:  ["  _____  ", " / * * \\ ", "(  ~~~  )", " \\_____/ "],
      error:    ["  _____  ", " / x x \\ ", "(   !   )", " \\_____/ "],
      happy:    ["  _____  ", " / ♥ ♥ \\ ", "(   ~   )", " \\_____/ "],
      sleeping: ["  _____  ", " / - - \\ ", "(  zzz  )", " \\_____/ "],
    },
  },

  {
    id: "turtle", name: "Turtle", rarity: "rare", xpRequired: 400,
    colors: { idle: "#22c55e", thinking: "#7ab4e8", working: "#86efac", error: "#ff6b6b", happy: "#bef264", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["    ___  ", "   (o_o) ", "  ( U   )", "   '---' "],
        ["    ___  ", "   (o_o) ", "  ( U U )", "   '---' "],
        ["    ___  ", "   (o-o) ", "  ( U   )", "   '---' "],
      ],
      thinking: ["    ___  ", "   (o?o) ", "  ( U   )", "   '---' "],
      working:  ["    ___  ", "   (o*o) ", "  (=====)", "   '---' "],
      error:    ["    ___  ", "   (o!o) ", "  ( U   )", "   '---' "],
      happy:    ["    ___  ", "   (♥_♥) ", "  ( U   )", "   '---' "],
      sleeping: ["    ___  ", "   (-_-) ", "  ( zzz )", "   '---' "],
    },
  },

  // ── EPIC (700 XP) ──────────────────────────────────────────────────────────

  {
    id: "axolotl", name: "Axolotl", rarity: "epic", xpRequired: 700,
    colors: { idle: "#f9a8d4", thinking: "#c084fc", working: "#f0a500", error: "#ff6b6b", happy: "#fbcfe8", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["q(o . o)p", " (       )", "  \\_____/ ", "  /     \\ "],
        ["q(o . o)p", " (  ~~~  )", "  \\_____/ ", "  /     \\ "],
        ["q(- . o)p", " (       )", "  \\_____/ ", "  /     \\ "],
      ],
      thinking: ["q(? . ?)p", " (       )", "  \\_____/ ", "  /     \\ "],
      working:  ["q(* . *)p", " (  ~~~  )", "  \\_____/ ", "  /     \\ "],
      error:    ["q(x . x)p", " (  !!!  )", "  \\_____/ ", "  /     \\ "],
      happy:    ["q(♥ . ♥)p", " (       )", "  \\_____/ ", "  /     \\ "],
      sleeping: ["q(- . -)p", " (  zzz  )", "  \\_____/ ", "  /     \\ "],
    },
  },

  {
    id: "octopus", name: "Octopus", rarity: "epic", xpRequired: 700,
    colors: { idle: "#a855f7", thinking: "#c084fc", working: "#f0a500", error: "#ff6b6b", happy: "#d8b4fe", sleeping: "#94a3b8" },
    frames: {
      idle: [
        ["   (°v°)  ", "  ( ___ ) ", " (||||||||)", "  ~ ~ ~ ~ "],
        ["   (°v°)  ", "  ( ___ ) ", " (\\||||||/) ", "  ~ ~ ~ ~ "],
        ["   (-v°)  ", "  ( ___ ) ", " (||||||||)", "  ~ ~ ~ ~ "],
      ],
      thinking: ["   (°?°)  ", "  ( ___ ) ", " (||||||||)", "  ~ ~ ~ ~ "],
      working:  ["   (°*°)  ", "  ( ___ ) ", " (/||||||\\) ", "  ~~~~~   "],
      error:    ["   (°!°)  ", "  ( ___ ) ", " (!|!|!|!|)", "  ~ ~ ~ ~ "],
      happy:    ["   (♥v♥)  ", "  ( ___ ) ", " (||||||||)", "  ~ ~ ~ ~ "],
      sleeping: ["   (-v-)  ", "  ( zzz ) ", " (||||||||)", "  ~ ~ ~ ~ "],
    },
  },

  // ── LEGENDARY (1500 XP) ────────────────────────────────────────────────────

  {
    id: "robot", name: "Robot", rarity: "legendary", xpRequired: 1500,
    colors: { idle: "#38bdf8", thinking: "#818cf8", working: "#34d399", error: "#f87171", happy: "#67e8f9", sleeping: "#94a3b8" },
    frames: {
      idle: [
        [" [=====] ", " | ◉ ◉ | ", " |  ─  | ", " [_____] "],
        [" [=====] ", " | ● ● | ", " |  ─  | ", " [_____] "],
        [" [=====] ", " | ◉ ◉ | ", " |  =  | ", " [_____] "],
      ],
      thinking: [" [=====] ", " | ? ? | ", " |  ─  | ", " [_____] "],
      working:  [" [=====] ", " | * * | ", " |  ≡  | ", " [_____] "],
      error:    [" [=====] ", " | ! ! | ", " |  ×  | ", " [_____] "],
      happy:    [" [=====] ", " | ♥ ♥ | ", " |  ─  | ", " [_____] "],
      sleeping: [" [=====] ", " | - - | ", " | zzz | ", " [_____] "],
    },
  },
]

export const SPECIES_MAP = new Map(SPECIES.map(s => [s.id, s]))
