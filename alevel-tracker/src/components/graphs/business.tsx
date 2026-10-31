import { Arrow, Canvas, Curve, Dot, Drop, Graph, INK, Note, PanelTitle, Panels, PxArrow, Rect, Region, Tick, Txt, line, type Pt } from "./kit";

export function BreakEven() {
  const fc = 30;
  const tc = line([0, fc], [100, fc + 50]);
  const tr = line([0, 0], [100, 110]);
  const bep: Pt = [50, tr(50)];
  return (
    <Graph label="Break-even chart" x="Output (units)" y="Costs and revenue (£)">
      <Region pts={[[0, fc], bep, [0, 0]]} tone="loss" label="Loss" at={[14, 18]} />
      <Region pts={[bep, [90, tr(90)], [90, tc(90)]]} tone="profit" label="Profit" at={[80, 80]} />
      <Drop at={bep} xTick="BEQ" />
      <Drop at={[75, tr(75)]} xTick="Actual" toY={false} />
      <Curve pts={[[0, fc], [95, fc]]} label="FC" at="end" dx={4} dy={4} ink="muted" />
      <Curve f={tc} from={0} to={95} label="TC" />
      <Curve f={tr} from={0} to={90} label="TR" ink="accent" />
      <Dot at={bep} label="Break-even point" dx={-112} dy={-6} />
      <Arrow from={[50, 8]} to={[75, 8]} ink="green" both />
      <Note at={[62.5, 12]} anchor="middle" ink="green">Margin of safety</Note>
    </Graph>
  );
}

export function StockControl() {
  const cycle = 29.25;
  const saw: Pt[] = [[0, 80]];
  for (let k = 1; k <= 3; k++) saw.push([k * cycle, 15], [k * cycle, 80]);
  const reorderAt = cycle + ((80 - 40) / 65) * cycle;
  return (
    <Graph label="Stock control chart" x="Time (weeks)" y="Stock (units)">
      {[80, 40, 15].map((y) => (
        <Curve key={y} pts={[[0, y], [96, y]]} ink="muted" dashed width={1} />
      ))}
      <Tick y={80} label="Max" />
      <Tick y={40} label="Reorder" />
      <Tick y={15} label="Buffer" />
      <Curve pts={saw} ink="accent" />
      <Dot at={[reorderAt, 40]} />
      <Curve pts={[[reorderAt, 40], [reorderAt, 92]]} ink="muted" dashed width={1} />
      <Curve pts={[[2 * cycle, 80], [2 * cycle, 92]]} ink="muted" dashed width={1} />
      <Arrow from={[reorderAt, 92]} to={[2 * cycle, 92]} ink="red" both />
      <Note at={[(reorderAt + 2 * cycle) / 2, 96]} anchor="middle" ink="red">Lead time: order placed → delivered</Note>
      <Note at={[60, 30]}>{"Reorder\nquantity"}</Note>
      <Note at={[4, 6]}>Stock never planned below the buffer</Note>
    </Graph>
  );
}

export function ExperienceCurve() {
  const f = (x: number) => 85 * (x / 5) ** -0.32;
  return (
    <Graph label="Experience curve" x="Cumulative output" y="Cost per unit">
      <Drop at={[20, f(20)]} xTick="Q" yTick="C1" />
      <Drop at={[40, f(40)]} xTick="2Q" yTick="C2" />
      <Curve f={f} from={5} to={95} label="Unit cost" at="end" dx={-40} dy={-10} ink="accent" />
      <Note at={[38, 80]}>{"Each doubling of output cuts\nunit cost by a similar %, as\nstaff get faster and waste less"}</Note>
    </Graph>
  );
}

function Grid2x2({
  label,
  top,
  side,
  cols,
  rows,
  cells,
  notes,
  tint,
}: {
  label: string;
  top: string;
  side: string;
  cols: [string, string];
  rows: [string, string];
  cells: [string, string, string, string];
  notes?: [string, string, string, string];
  tint?: [string, string, string, string];
}) {
  const x0 = 96;
  const y0 = 48;
  const w = 126;
  const h = 104;
  return (
    <Canvas label={label}>
      <Txt x={x0 + w} y={16} weight={600} keep>
        {top}
      </Txt>
      <Txt x={x0 + w / 2} y={38} size={10.5} keep>
        {cols[0]}
      </Txt>
      <Txt x={x0 + w * 1.5} y={38} size={10.5} keep>
        {cols[1]}
      </Txt>
      <text x={16} y={y0 + h} fontSize={11} fontWeight={600} fill={INK.base} textAnchor="middle" transform={`rotate(-90 16 ${y0 + h})`}>
        {side}
      </text>
      <Txt x={58} y={y0 + h / 2} size={10.5} keep>
        {rows[0]}
      </Txt>
      <Txt x={58} y={y0 + h * 1.5} size={10.5} keep>
        {rows[1]}
      </Txt>
      {cells.map((c, i) => {
        const cx = x0 + (i % 2) * w;
        const cy = y0 + Math.floor(i / 2) * h;
        return (
          <g key={c}>
            <Rect x={cx} y={cy} w={w} h={h} fill={tint?.[i] ?? "#f8fafc"} />
            <Txt x={cx + w / 2} y={cy + h / 2 - (notes ? 8 : -4)} weight={700} size={12}>
              {c}
            </Txt>
            {notes ? (
              <Txt x={cx + w / 2} y={cy + h / 2 + 22} size={9.5} ink="muted">
                {notes[i]}
              </Txt>
            ) : null}
          </g>
        );
      })}
    </Canvas>
  );
}

export function Ansoff() {
  return (
    <Grid2x2
      label="Ansoff's matrix"
      top="Products"
      side="Markets"
      cols={["Existing", "New"]}
      rows={["Existing", "New"]}
      cells={["Market\npenetration", "Product\ndevelopment", "Market\ndevelopment", "Diversification"]}
      notes={["lowest risk", "medium risk", "medium risk", "highest risk"]}
      tint={["#dcfce7", "#fef9c3", "#fef9c3", "#fee2e2"]}
    />
  );
}

export function PorterGeneric() {
  return (
    <Grid2x2
      label="Porter's generic strategies"
      top="Source of competitive advantage"
      side="Competitive scope"
      cols={["Lower cost", "Differentiation"]}
      rows={["Broad\ntarget", "Narrow\ntarget"]}
      cells={["Cost\nleadership", "Differentiation", "Cost\nfocus", "Differentiation\nfocus"]}
    />
  );
}

export function SwotGrid() {
  return (
    <Grid2x2
      label="SWOT analysis"
      top="Effect on the business"
      side="Where it comes from"
      cols={["Helpful", "Harmful"]}
      rows={["Internal", "External"]}
      cells={["Strengths", "Weaknesses", "Opportunities", "Threats"]}
      notes={["brand, skills, patents", "high costs, weak cash", "new markets, trends", "rivals, recession, laws"]}
      tint={["#dcfce7", "#fee2e2", "#e0f2fe", "#fef3c7"]}
    />
  );
}

export function StakeholderMap() {
  return (
    <Grid2x2
      label="Stakeholder mapping (power and interest)"
      top="Interest"
      side="Power"
      cols={["Low", "High"]}
      rows={["High", "Low"]}
      cells={["Keep\nsatisfied", "Manage\nclosely", "Monitor", "Keep\ninformed"]}
      notes={["e.g. regulators", "e.g. major shareholders", "e.g. the general public", "e.g. local residents"]}
      tint={["#fef9c3", "#fee2e2", "#f1f5f9", "#e0f2fe"]}
    />
  );
}

export function BowmanClock() {
  const cx = 180;
  const cy = 146;
  const r = 72;
  const spots: { n: number; deg: number; text: string; fail?: boolean }[] = [
    { n: 1, deg: 225, text: "Low price,\nlow value" },
    { n: 2, deg: 180, text: "Low price" },
    { n: 3, deg: 135, text: "Hybrid" },
    { n: 4, deg: 90, text: "Differentiation" },
    { n: 5, deg: 45, text: "Focused\ndifferentiation" },
    { n: 6, deg: 0, text: "Higher price,\nsame value", fail: true },
    { n: 7, deg: -45, text: "Higher price,\nlow value", fail: true },
    { n: 8, deg: -90, text: "Low value,\nsame price", fail: true },
  ];
  return (
    <Canvas label="Bowman's strategic clock">
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={INK.muted} strokeWidth={1} strokeDasharray="3 3" />
      <line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={INK.muted} strokeWidth={1} strokeDasharray="3 3" />
      <Txt x={6} y={16} size={10} anchor="start" ink="muted" keep>
        {"Left → right: price, low to high\nBottom → top: perceived value"}
      </Txt>
      {spots.map(({ n, deg, text, fail }) => {
        const a = (deg * Math.PI) / 180;
        const x = cx + r * Math.cos(a);
        const y = cy - r * Math.sin(a);
        const lx = cx + (r + 18) * Math.cos(a);
        const ly = cy - (r + 18) * Math.sin(a);
        const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
        const ink = fail ? "red" : "base";
        return (
          <g key={n}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={INK[ink]} strokeWidth={1.4} />
            <circle cx={x} cy={y} r={9} fill="#fff" stroke={INK[ink]} strokeWidth={1.5} />
            <Txt x={x} y={y + 4} size={10} weight={700} ink={ink} keep>
              {n}
            </Txt>
            <Txt x={lx} y={ly + (Math.sin(a) > 0.5 ? -8 : Math.sin(a) < -0.5 ? 12 : 0)} size={10} anchor={anchor} ink={ink}>
              {text}
            </Txt>
          </g>
        );
      })}
      <Txt x={352} y={272} size={10} anchor="end" ink="red">
        6–8 usually fail
      </Txt>
    </Canvas>
  );
}

export function FiveForces() {
  const box = (x: number, y: number, w: number, h: number, text: string, strong = false) => (
    <g>
      <Rect x={x} y={y} w={w} h={h} fill={strong ? "#e0f2fe" : "#f8fafc"} />
      <Txt x={x + w / 2} y={y + h / 2 - 2} weight={700} size={11}>
        {text}
      </Txt>
    </g>
  );
  return (
    <Canvas label="Porter's five forces">
      {box(118, 108, 124, 62, "Competitive\nrivalry", true)}
      {box(118, 12, 124, 50, "Threat of\nnew entrants")}
      {box(118, 216, 124, 50, "Threat of\nsubstitutes")}
      {box(6, 108, 92, 62, "Supplier\npower")}
      {box(262, 108, 92, 62, "Buyer\npower")}
      <PxArrow x1={180} y1={62} x2={180} y2={106} />
      <PxArrow x1={180} y1={216} x2={180} y2={172} />
      <PxArrow x1={98} y1={139} x2={116} y2={139} />
      <PxArrow x1={262} y1={139} x2={244} y2={139} />
    </Canvas>
  );
}

export function DecisionTree() {
  const sq = { x: 26, y: 140 };
  const a = { x: 150, y: 78 };
  const b = { x: 150, y: 206 };
  const end = (x: number, y: number, text: string, prob: string, from: { x: number; y: number }) => (
    <g>
      <line x1={from.x + 11} y1={from.y} x2={x} y2={y} stroke={INK.base} strokeWidth={1.5} />
      <Txt x={x - 6} y={y < from.y ? y - 9 : y + 16} size={10} anchor="end" ink="accent">
        {prob}
      </Txt>
      <Txt x={x + 4} y={y + 4} size={10.5} anchor="start" weight={600}>
        {text}
      </Txt>
    </g>
  );
  return (
    <Canvas label="Decision tree">
      <line x1={sq.x + 9} y1={sq.y} x2={a.x - 11} y2={a.y} stroke={INK.base} strokeWidth={1.5} />
      <line x1={sq.x + 9} y1={sq.y} x2={b.x - 11} y2={b.y} stroke={INK.base} strokeWidth={1.5} />
      <line x1={86} y1={166} x2={94} y2={180} stroke={INK.red} strokeWidth={2} />
      <line x1={92} y1={163} x2={100} y2={177} stroke={INK.red} strokeWidth={2} />
      <rect x={sq.x - 9} y={sq.y - 9} width={18} height={18} fill="#fff" stroke={INK.base} strokeWidth={2} />
      <circle cx={a.x} cy={a.y} r={11} fill="#fff" stroke={INK.base} strokeWidth={2} />
      <circle cx={b.x} cy={b.y} r={11} fill="#fff" stroke={INK.base} strokeWidth={2} />
      <Txt x={60} y={92} size={10} anchor="middle">
        {"Launch new\nproduct (−£50k)"}
      </Txt>
      <Txt x={64} y={200} size={10} anchor="middle">
        {"Upgrade current\n(−£20k)"}
      </Txt>
      {end(250, 40, "£200k", "Success 0.6", a)}
      {end(250, 116, "£40k", "Fail 0.4", a)}
      {end(250, 168, "£90k", "High 0.5", b)}
      {end(250, 244, "£50k", "Low 0.5", b)}
      <Txt x={a.x} y={a.y + 26} size={9.5} ink="green" weight={600}>
        {"EV £136k\nnet £86k"}
      </Txt>
      <Txt x={b.x} y={b.y - 32} size={9.5} ink="red" weight={600}>
        {"EV £70k\nnet £50k"}
      </Txt>
      <Txt x={4} y={272} size={9.5} anchor="start" ink="muted" keep>
        □ decision · ○ chance · probabilities at a ○ add to 1
      </Txt>
    </Canvas>
  );
}

export function CriticalPath() {
  const r = 22;
  const nodes = [
    { n: 1, x: 38, y: 140, est: 0, lft: 0 },
    { n: 2, x: 146, y: 70, est: 3, lft: 7 },
    { n: 3, x: 146, y: 210, est: 4, lft: 4 },
    { n: 4, x: 238, y: 140, est: 9, lft: 9 },
    { n: 5, x: 330, y: 140, est: 11, lft: 11 },
  ];
  const acts = [
    { from: 0, to: 1, name: "A 3", critical: false },
    { from: 0, to: 2, name: "B 4", critical: true },
    { from: 1, to: 3, name: "C 2", critical: false },
    { from: 2, to: 3, name: "D 5", critical: true },
    { from: 3, to: 4, name: "E 2", critical: true },
  ];
  return (
    <Canvas label="Critical path network">
      {acts.map(({ from, to, name, critical }) => {
        const p = nodes[from];
        const q = nodes[to];
        const len = Math.hypot(q.x - p.x, q.y - p.y);
        const ux = (q.x - p.x) / len;
        const uy = (q.y - p.y) / len;
        const ink = critical ? "red" : "base";
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        return (
          <g key={name}>
            <PxArrow x1={p.x + ux * r} y1={p.y + uy * r} x2={q.x - ux * (r + 1)} y2={q.y - uy * (r + 1)} ink={ink} width={critical ? 2.6 : 1.6} />
            <Txt x={mx - uy * 14} y={my + ux * 14 + 4} size={10.5} weight={700} ink={ink}>
              {name}
            </Txt>
          </g>
        );
      })}
      {nodes.map(({ n, x, y, est, lft }) => (
        <g key={n}>
          <circle cx={x} cy={y} r={r} fill="#fff" stroke={INK.base} strokeWidth={1.6} />
          <line x1={x} y1={y - r} x2={x} y2={y + r} stroke={INK.base} strokeWidth={1.2} />
          <line x1={x} y1={y} x2={x + r} y2={y} stroke={INK.base} strokeWidth={1.2} />
          <Txt x={x - 10} y={y + 4} size={11} weight={700} keep>
            {n}
          </Txt>
          <Txt x={x + 10} y={y - 5} size={10} ink="accent">
            {est}
          </Txt>
          <Txt x={x + 10} y={y + 15} size={10} ink="red">
            {lft}
          </Txt>
        </g>
      ))}
      <Txt x={4} y={20} size={10} anchor="start" ink="muted" keep>
        Node: number | EST (top) / LFT (bottom). Activity: letter and days.
      </Txt>
      <Txt x={4} y={266} size={10} anchor="start" ink="red" weight={600}>
        {"Critical path B → D → E = 11 days\nA and C each have 4 days' float"}
      </Txt>
    </Canvas>
  );
}

export function MovingAverage() {
  const season = [8, -4, -10, 6];
  const trend = (t: number) => 30 + 3 * t;
  const actual: Pt[] = Array.from({ length: 12 }, (_, i) => [7 * (i + 1), trend(i + 1) + season[i % 4]]);
  return (
    <Graph label="Time series with a moving average trend" x="Quarter" y="Sales">
      <Curve pts={actual} ink="muted" />
      <Curve pts={[[21, trend(3)], [70, trend(10)]]} ink="accent" width={2.5} />
      <Curve pts={[[70, trend(10)], [98, trend(14)]]} ink="accent" dashed width={2.5} />
      <Curve pts={[[4, 96], [12, 96]]} ink="muted" />
      <Note at={[14, 94.5]}>Actual sales</Note>
      <Curve pts={[[4, 89], [12, 89]]} ink="accent" width={2.5} />
      <Note at={[14, 87.5]}>Moving average (trend)</Note>
      <Curve pts={[[4, 82], [12, 82]]} ink="accent" dashed width={2.5} />
      <Note at={[14, 80.5]}>Extrapolated forecast</Note>
      {actual.map((p) => (
        <Dot key={`d${p[0]}`} at={p} ink="muted" />
      ))}
      <Tick x={7} label="Q1" />
      <Tick x={35} label="Q1" />
      <Tick x={63} label="Q1" />
      <Tick x={91} label="Q1" />
    </Graph>
  );
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function Correlation() {
  const panel = (title: string, f: (x: number) => number | null, seed: number) => {
    const rand = seeded(seed);
    const pts: Pt[] = Array.from({ length: 16 }, (_, i) => {
      const x = 8 + i * 5.5 + rand() * 3;
      const mid = f(x);
      return [x, mid === null ? 12 + rand() * 76 : mid + (rand() - 0.5) * 22];
    });
    const fit = f(10) === null ? null : line([8, f(8)!], [92, f(92)!]);
    return (
      <div>
        <PanelTitle>{title}</PanelTitle>
        <Graph label={`${title} correlation`} x="Variable X" y="Variable Y">
          {fit ? <Curve f={fit} from={4} to={96} ink="accent" dashed /> : null}
          {pts.map((p, i) => (
            <Dot key={i} at={p} />
          ))}
        </Graph>
      </div>
    );
  };
  return (
    <Panels cols={3}>
      {panel("Positive", (x) => 14 + 0.75 * x, 7)}
      {panel("Negative", (x) => 86 - 0.72 * x, 11)}
      {panel("None", () => null, 19)}
    </Panels>
  );
}

export function BusinessCycle() {
  const trend = (x: number) => 25 + 0.5 * x;
  const gdp = (x: number) => trend(x) + 12 * Math.sin((2 * Math.PI * (x - 5)) / 45);
  return (
    <Graph label="The business cycle" x="Time" y="Real GDP">
      <Curve f={trend} from={0} to={92} ink="muted" dashed />
      <Curve f={gdp} from={0} to={92} ink="accent" width={2.5} />
      <Note at={[16, 50]} anchor="middle" weight={700}>Boom</Note>
      <Note at={[27, 26]} anchor="end" weight={700}>Recession</Note>
      <Note at={[38.75, 24]} anchor="middle" weight={700}>Slump</Note>
      <Note at={[53, 42]} weight={700}>Recovery</Note>
      <Note at={[61, 72]} anchor="middle" weight={700}>Boom</Note>
      <Note at={[70, 81]} ink="muted">Trend growth (dashed)</Note>
    </Graph>
  );
}

export function CarrollPyramid() {
  const bands = [
    { name: "Philanthropic", note: "be a good corporate\ncitizen: desired", fill: "#ede9fe" },
    { name: "Ethical", note: "do what's right and\nfair: expected", fill: "#e0f2fe" },
    { name: "Legal", note: "obey the law:\nrequired", fill: "#fef9c3" },
    { name: "Economic", note: "be profitable:\nrequired", fill: "#dcfce7" },
  ];
  const top = 18;
  const base = 258;
  const left = 14;
  const right = 214;
  const apex = (left + right) / 2;
  const h = (base - top) / bands.length;
  const xAt = (y: number, side: -1 | 1) => apex + side * ((y - top) / (base - top)) * ((right - left) / 2);
  return (
    <Canvas label="Carroll's pyramid of corporate social responsibility">
      {bands.map((b, i) => {
        const y1 = top + i * h;
        const y2 = y1 + h;
        const pts = [
          [xAt(y1, -1), y1],
          [xAt(y1, 1), y1],
          [xAt(y2, 1), y2],
          [xAt(y2, -1), y2],
        ];
        return (
          <g key={b.name}>
            <polygon points={pts.map((p) => p.join(",")).join(" ")} fill={b.fill} stroke={INK.base} strokeWidth={1.4} />
            <Txt x={apex} y={y2 - (i === 0 ? 10 : h / 2 - 4)} size={i === 0 ? 9 : 11} weight={700}>
              {i === 0 ? "Phil." : b.name}
            </Txt>
            <Txt x={228} y={y1 + h / 2 - 2} size={10} anchor="start">
              {`${b.name}:\n${b.note}`}
            </Txt>
          </g>
        );
      })}
    </Canvas>
  );
}

export function ForceField() {
  const mid = 180;
  const unit = 26;
  const driving = [
    { text: "Lower costs", score: 4 },
    { text: "Customers want it", score: 3 },
    { text: "Rivals have it", score: 3 },
  ];
  const restraining = [
    { text: "Fear of job losses", score: 4 },
    { text: "Training cost", score: 3 },
    { text: "Disruption", score: 2 },
  ];
  const ys = [92, 150, 208];
  return (
    <Canvas label="Lewin's force field analysis">
      <line x1={mid} y1={40} x2={mid} y2={238} stroke={INK.base} strokeWidth={3} />
      <Txt x={mid} y={30} weight={700} size={11}>
        Change: a new IT system
      </Txt>
      <Txt x={mid - 8} y={58} anchor="end" weight={700} ink="green" keep>
        Driving forces
      </Txt>
      <Txt x={mid + 8} y={58} anchor="start" weight={700} ink="red" keep>
        Restraining forces
      </Txt>
      {driving.map((d, i) => (
        <g key={d.text}>
          <PxArrow x1={mid - 6 - d.score * unit} y1={ys[i]} x2={mid - 6} y2={ys[i]} ink="green" width={5} />
          <Txt x={mid - 8} y={ys[i] - 10} anchor="end" size={10}>
            {`${d.text} (${d.score})`}
          </Txt>
        </g>
      ))}
      {restraining.map((d, i) => (
        <g key={d.text}>
          <PxArrow x1={mid + 6 + d.score * unit} y1={ys[i]} x2={mid + 6} y2={ys[i]} ink="red" width={5} />
          <Txt x={mid + 8} y={ys[i] - 10} anchor="start" size={10}>
            {`${d.text} (${d.score})`}
          </Txt>
        </g>
      ))}
      <Txt x={mid - 8} y={256} anchor="end" weight={700} ink="green">
        Total 10
      </Txt>
      <Txt x={mid + 8} y={256} anchor="start" weight={700} ink="red">
        Total 9
      </Txt>
      <Txt x={mid} y={274} size={9.5} ink="muted">
        Driving beats restraining, so go ahead, but cut resistance first
      </Txt>
    </Canvas>
  );
}
