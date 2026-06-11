export function generateMaze(cols = 23, rows = 23) {
  // Initialize grid fully filled with walls
  const grid = [];
  for (let r = 0; r < rows; r++) {
    grid.push(new Array(cols).fill(1));
  }

  // Shuffle array in place (Fisher-Yates)
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Recursive backtracking DFS carver
  function carve(x, y) {
    grid[y][x] = 0;

    const directions = shuffle([
      [0, -2],  // up
      [0, +2],  // down
      [-2, 0],  // left
      [+2, 0],  // right
    ]);

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      // Neighbor must be within bounds (never touch outer border)
      if (nx > 0 && nx < cols - 1 && ny > 0 && ny < rows - 1 && grid[ny][nx] === 1) {
        // Carve the wall between current cell and neighbor
        grid[y + dy / 2][x + dx / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  // Pick a random odd starting cell
  const oddCols = [];
  const oddRows = [];
  for (let i = 1; i < cols - 1; i += 2) oddCols.push(i);
  for (let i = 1; i < rows - 1; i += 2) oddRows.push(i);

  const startX = oddCols[Math.floor(Math.random() * oddCols.length)];
  const startY = oddRows[Math.floor(Math.random() * oddRows.length)];

  carve(startX, startY);

  // Force-carve central ghost house (applied AFTER DFS)
  // 5-wide x 3-tall interior block: x in [9..13], y in [10..12]
  for (let gy = 10; gy <= 12; gy++) {
    for (let gx = 9; gx <= 13; gx++) {
      grid[gy][gx] = 0;
    }
  }
  // Carve entrance corridor above the room: (11,9) and (11,8)
  grid[9][11] = 0;
  grid[8][11] = 0;

  // Open the 4 wrap-around portal cells on the borders (midpoints of each edge)
  grid[0][11]  = 0;   // top portal    (x=11, y=0)
  grid[22][11] = 0;   // bottom portal (x=11, y=22)
  grid[11][0]  = 0;   // left portal   (x=0,  y=11)
  grid[11][22] = 0;   // right portal  (x=22, y=11)

  // Rebuild pathCells AFTER carving the ghost house so new open cells are included
  const pathCells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 0) {
        pathCells.push({ x: c, y: r });
      }
    }
  }

  // Player start: random path cell, never inside the ghost house area
  const validPlayerStarts = pathCells.filter(
    c => !(c.x >= 9 && c.x <= 13 && c.y >= 8 && c.y <= 12)
  )
  const playerStart = validPlayerStarts[Math.floor(Math.random() * validPlayerStarts.length)];

  // Ghost starts: fixed slots inside the ghost house
  const ghostStarts = [
    { x: 10, y: 11 },
    { x: 11, y: 11 },
    { x: 12, y: 11 },
    { x: 11, y: 10 },
  ];

  // Ghost house area bounds for exclusion
  function inGhostHouse(x, y) {
    return x >= 9 && x <= 13 && y >= 8 && y <= 12;
  }

  // Power pellets: one per quadrant corner, path cell closest to each corner
  // Exclude cells inside the ghost house area
  const corners = [
    { cx: 1, cy: 1 },                     // top-left
    { cx: cols - 2, cy: 1 },              // top-right
    { cx: 1, cy: rows - 2 },              // bottom-left
    { cx: cols - 2, cy: rows - 2 },       // bottom-right
  ];

  const powerPellets = corners.map(({ cx, cy }) => {
    let best = null;
    let bestDist = Infinity;
    for (const cell of pathCells) {
      if (inGhostHouse(cell.x, cell.y)) continue;
      const d = Math.abs(cell.x - cx) + Math.abs(cell.y - cy);
      if (d < bestDist) {
        bestDist = d;
        best = cell;
      }
    }
    return best;
  }).filter(Boolean);

  // Deduplicate power pellets (in case two corners map to the same cell)
  const seen = new Set();
  const uniquePowerPellets = [];
  for (const p of powerPellets) {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePowerPellets.push(p);
    }
  }

  // Missile pack locations — more in the centre, less on the edges
  function inGhostHouseOrEntrance(x, y) {
    return x >= 9 && x <= 13 && y >= 8 && y <= 12;
  }

  function nearPlayer(x, y, px, py, radius = 3) {
    return Math.abs(x - px) + Math.abs(y - py) <= radius;
  }

  function shuffleArr(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Cells eligible for missile packs (not ghost house, not too close to player)
  const eligibleCells = pathCells.filter(c =>
    !inGhostHouseOrEntrance(c.x, c.y) &&
    !nearPlayer(c.x, c.y, playerStart.x, playerStart.y) &&
    !(c.x === 11 && c.y === 0) &&   // exclude portal cells
    !(c.x === 11 && c.y === 22) &&
    !(c.x === 0  && c.y === 11) &&
    !(c.x === 22 && c.y === 11)
  );

  const centerDist = c => Math.abs(c.x - 11) + Math.abs(c.y - 11);

  // Inner zone: Manhattan dist ≤ 7 from centre (ghost house area excluded above)
  const innerZone = shuffleArr(eligibleCells.filter(c => centerDist(c) <= 7));
  // Outer zone: further from centre
  const outerZone = shuffleArr(eligibleCells.filter(c => centerDist(c) > 7));

  // 6 packs from inner zone (higher risk/reward), 3 from outer zone
  const missilePacks = [
    ...innerZone.slice(0, 6),
    ...outerZone.slice(0, 3),
  ];

  return {
    grid,
    playerStart,
    ghostStarts,
    pathCells,
    powerPellets: uniquePowerPellets,
    ghostHouseCenter: { x: 11, y: 11 },
    missilePacks,
  };
}
