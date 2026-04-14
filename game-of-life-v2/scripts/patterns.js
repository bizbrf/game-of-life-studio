// Built-in pattern library. Pure data + a parser.

function parsePattern(text) {
  const cells = [];
  const lines = text.trim().split("\n");
  lines.forEach((line, row) => {
    [...line].forEach((char, col) => {
      if (char === "O") cells.push([row, col]);
    });
  });
  return cells;
}

export const PATTERNS = [
  { name: "Freehand", category: "Drawing", cells: null, description: "Paint individual cells." },
  { name: "Glider", category: "Spaceships", cells: parsePattern(".O.\n..O\nOOO"), description: "Classic 5-cell spaceship." },
  { name: "LWSS", category: "Spaceships", cells: parsePattern(".O..O\nO....\nO...O\nOOOO."), description: "Lightweight spaceship." },
  { name: "Pulsar", category: "Oscillators", cells: parsePattern("..OOO...OOO..\n.............\nO....O.O....O\nO....O.O....O\nO....O.O....O\n..OOO...OOO..\n.............\n..OOO...OOO..\nO....O.O....O\nO....O.O....O\nO....O.O....O\n.............\n..OOO...OOO.."), description: "Period-3 oscillator." },
  { name: "R-Pentomino", category: "Methuselahs", cells: parsePattern(".OO\nOO.\n.O."), description: "Tiny pattern with long evolution." },
  { name: "Gosper Gun", category: "Guns", cells: [[0,24],[1,22],[1,24],[2,12],[2,13],[2,20],[2,21],[2,34],[2,35],[3,11],[3,15],[3,20],[3,21],[3,34],[3,35],[4,0],[4,1],[4,10],[4,16],[4,20],[4,21],[5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],[6,10],[6,16],[6,24],[7,11],[7,15],[8,12],[8,13]], description: "The original glider gun." },
  { name: "Acorn", category: "Methuselahs", cells: parsePattern(".O.....\n...O...\nOO..OOO"), description: "Explodes from seven cells." },
  { name: "Diehard", category: "Methuselahs", cells: parsePattern("......O.\nOO......\n.O...OOO"), description: "Dies after 130 generations." },
  { name: "Blinker", category: "Oscillators", cells: parsePattern("OOO"), description: "Smallest period-2 oscillator." },
  { name: "Toad", category: "Oscillators", cells: parsePattern(".OOO\nOOO."), description: "Period-2 oscillator." },
  { name: "Beacon", category: "Oscillators", cells: parsePattern("OO..\nO...\n...O\n..OO"), description: "Blinking still-life pair." },
  { name: "Block", category: "Still Lifes", cells: parsePattern("OO\nOO"), description: "Stable 2x2 block." },
  { name: "Beehive", category: "Still Lifes", cells: parsePattern(".OO.\nO..O\n.OO."), description: "Stable six-cell still life." },
];

export const CATEGORY_OPTIONS = ["All", ...new Set(PATTERNS.map((pattern) => pattern.category))];
