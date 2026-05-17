// Simplified tile-grid map of the continental US + AK + HI.
// Each state is rendered as a square tile positioned in its approximate
// geographic location. Highlighted states (from Atlas context matches)
// are filled in a distinct colour so the map reads clearly in print.

interface USStateMapSnapshotProps {
  highlightedStates: string[];
  tribalNation: string | null;
  era: string;
  caption?: string;
}

// Standard tile-grid layout: [col, row] within an 11×8 grid.
// Origin (0,0) is top-left. Columns run west→east, rows north→south.
const STATE_TILES: Record<string, [number, number]> = {
  WA: [1, 0], MT: [3, 0], ND: [4, 0], MN: [5, 0], WI: [7, 1], MI: [8, 1],
  OR: [1, 1], ID: [2, 1], SD: [4, 1], WY: [3, 1], IA: [5, 1], IL: [6, 1], IN: [7, 2], OH: [8, 2],
  CA: [1, 2], NV: [2, 2], UT: [3, 2], CO: [4, 2], NE: [5, 2], MO: [6, 2], KY: [7, 3], WV: [8, 3],
  AZ: [2, 3], NM: [3, 3], KS: [5, 3], OK: [5, 4], AR: [6, 4], TN: [7, 4], VA: [8, 4], NC: [9, 4],
  TX: [4, 5], LA: [6, 5], MS: [7, 5], AL: [8, 5], GA: [9, 5], SC: [10, 5],
  FL: [9, 6],
  ME: [11, 0], NH: [11, 1], VT: [10, 1], MA: [11, 2], RI: [11, 3], CT: [10, 2],
  NY: [9, 2], PA: [9, 3], NJ: [10, 3], DE: [10, 4], MD: [9, 4],
  AK: [0, 6], HI: [2, 6],
};

const TILE = 32;
const GAP = 2;
const COLS = 12;
const ROWS = 7;
const W = COLS * (TILE + GAP);
const H = ROWS * (TILE + GAP) + 20;

export function USStateMapSnapshot({ highlightedStates, tribalNation, era, caption }: USStateMapSnapshotProps) {
  const highlighted = new Set(highlightedStates.map(s => s.toUpperCase()));

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        {/* SVG tile map */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="border border-zinc-200 rounded bg-white"
          style={{ fontFamily: "'Courier New', monospace" }}
          role="img"
          aria-label={`US states map highlighting regions relevant to ${tribalNation ?? "this ancestor"} during the ${era}`}
        >
          {Object.entries(STATE_TILES).map(([abbr, [col, row]]) => {
            const x = col * (TILE + GAP);
            const y = row * (TILE + GAP);
            const isHighlighted = highlighted.has(abbr);
            return (
              <g key={abbr}>
                <rect
                  x={x}
                  y={y}
                  width={TILE}
                  height={TILE}
                  rx={3}
                  fill={isHighlighted ? "#7c3a13" : "#e8e2d9"}
                  stroke={isHighlighted ? "#5a2a0e" : "#c5bdb0"}
                  strokeWidth={isHighlighted ? 1.5 : 0.75}
                />
                <text
                  x={x + TILE / 2}
                  y={y + TILE / 2 + 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill={isHighlighted ? "#fff" : "#6b5f50"}
                  fontWeight={isHighlighted ? "bold" : "normal"}
                >
                  {abbr}
                </text>
              </g>
            );
          })}
          {/* Legend */}
          <rect x={0} y={ROWS * (TILE + GAP) + 4} width={12} height={12} rx={2} fill="#7c3a13" stroke="#5a2a0e" strokeWidth={1} />
          <text x={16} y={ROWS * (TILE + GAP) + 14} fontSize={9} fill="#444">States with documented event overlap</text>
          <rect x={120} y={ROWS * (TILE + GAP) + 4} width={12} height={12} rx={2} fill="#e8e2d9" stroke="#c5bdb0" strokeWidth={0.75} />
          <text x={136} y={ROWS * (TILE + GAP) + 14} fontSize={9} fill="#888">No events in Atlas dataset</text>
        </svg>

        {/* Side annotation */}
        <div className="text-[9px] text-zinc-500 space-y-2 leading-relaxed max-w-[180px]">
          <div>
            <span className="font-mono uppercase tracking-wider text-[8px] text-zinc-400 block mb-0.5">Era filter</span>
            <span className="text-zinc-700 font-medium">{era}</span>
          </div>
          {tribalNation && (
            <div>
              <span className="font-mono uppercase tracking-wider text-[8px] text-zinc-400 block mb-0.5">Tribal nation</span>
              <span className="text-zinc-700">{tribalNation}</span>
            </div>
          )}
          <div>
            <span className="font-mono uppercase tracking-wider text-[8px] text-zinc-400 block mb-0.5">Highlighted states</span>
            <span className="text-zinc-700">
              {highlightedStates.length > 0 ? highlightedStates.join(", ") : "None identified"}
            </span>
          </div>
          <p className="text-[8px] text-zinc-400 leading-relaxed italic">
            States are highlighted if any Atlas event affecting that state temporally overlaps with this ancestor's recorded lifespan. State-level overlap is a research signal only — it does not confirm the ancestor's presence in those states.
          </p>
        </div>
      </div>

      {caption && (
        <p className="text-[9px] text-zinc-400 italic leading-relaxed">{caption}</p>
      )}
    </div>
  );
}
