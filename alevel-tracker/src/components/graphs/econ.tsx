import { Arrow, Curve, Dot, Drop, Graph, line, meet, Note, PanelTitle, Panels, Region, Tick, type Fn, type Pt } from "./kit";

// Every curve is a real function, so intersections, tangencies and areas sit
// where the theory says they should.

const ppf = (r: number): Fn => (x) => r * Math.sqrt(Math.max(0, 1 - (x / r) ** 2));

export function PpfOpportunityCost() {
  const f = ppf(85);
  const a: Pt = [30, f(30)];
  const b: Pt = [60, f(60)];
  return (
    <Graph label="Production possibility frontier" x="Consumer goods" y="Capital goods">
      <Drop at={a} xTick="C1" yTick="K1" />
      <Drop at={b} xTick="C2" yTick="K2" />
      <Curve f={f} from={0} to={85} label="PPF" at={[72, f(72)]} dx={6} dy={-2} />
      <Dot at={a} label="A" />
      <Dot at={b} label="B" />
      <Arrow from={[4, a[1] - 1]} to={[4, b[1] + 1]} ink="red" />
      <Note at={[5, 72]} ink="red">{"Opportunity\ncost"}</Note>
      <Dot at={[45, 32]} label="X" ink="red" />
      <Note at={[33, 21]} ink="red">{"X: unused\nresources"}</Note>
      <Dot at={[72, 80]} label="Y: unattainable" ink="red" />
    </Graph>
  );
}

export function PpfGrowth() {
  const f1 = ppf(60);
  const f2 = ppf(86);
  return (
    <Graph label="Economic growth on a PPF" x="Consumer goods" y="Capital goods">
      <Curve f={f1} from={0} to={60} label="PPF1" at={[0, 60]} dx={6} dy={-6} />
      <Curve f={f2} from={0} to={86} label="PPF2" at={[0, 86]} dx={6} dy={-6} ink="accent" />
      <Arrow from={[44, 44]} to={[59, 59]} />
      <Note at={[50, 94]}>{"Growth: more or better\nresources, or new technology"}</Note>
    </Graph>
  );
}

export function DemandShift() {
  const d1 = line([0, 100], [100, 0]);
  const d2 = line([20, 100], [100, 20]);
  const s = line([0, 0], [100, 100]);
  const e1 = meet(d1, s);
  const e2 = meet(d2, s);
  return (
    <Graph label="A rise in demand" x="Quantity" y="Price">
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={e2} xTick="Q2" yTick="P2" />
      <Curve f={s} from={8} to={92} label="S" />
      <Curve f={d1} from={5} to={85} label="D1" />
      <Curve f={d2} from={25} to={95} label="D2" ink="accent" />
      <Arrow from={[30, 72]} to={[45, 72]} />
      <Dot at={e1} />
      <Dot at={e2} ink="accent" />
    </Graph>
  );
}

export function SupplyShift() {
  const d = line([0, 100], [100, 0]);
  const s1 = line([0, 0], [100, 100]);
  const s2 = line([0, 20], [80, 100]);
  const e1 = meet(d, s1);
  const e2 = meet(d, s2);
  return (
    <Graph label="A fall in supply" x="Quantity" y="Price">
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={e2} xTick="Q2" yTick="P2" />
      <Curve f={d} from={5} to={90} label="D" />
      <Curve f={s1} from={8} to={92} label="S1" />
      <Curve f={s2} from={0} to={76} label="S2" ink="accent" />
      <Arrow from={[69, 71]} to={[53, 71]} />
      <Dot at={e1} />
      <Dot at={e2} ink="accent" />
    </Graph>
  );
}

export function ExcessDemandSupply() {
  const d = line([0, 100], [100, 0]);
  const s = line([0, 0], [100, 100]);
  return (
    <Graph label="Excess demand and excess supply" x="Quantity" y="Price">
      <Drop at={[50, 50]} xTick="Qe" yTick="Pe" />
      <Curve pts={[[0, 70], [80, 70]]} ink="muted" dashed width={1} />
      <Curve pts={[[0, 30], [80, 30]]} ink="muted" dashed width={1} />
      <Tick y={70} label="P high" />
      <Tick y={30} label="P low" />
      <Curve f={d} from={5} to={90} label="D" />
      <Curve f={s} from={8} to={92} label="S" />
      <Arrow from={[30, 70]} to={[70, 70]} ink="red" both />
      <Note at={[50, 74]} anchor="middle" ink="red">Excess supply</Note>
      <Arrow from={[30, 30]} to={[70, 30]} ink="red" both />
      <Note at={[50, 22]} anchor="middle" ink="red">Excess demand</Note>
      <Arrow from={[90, 66]} to={[90, 54]} />
      <Arrow from={[90, 34]} to={[90, 46]} />
      <Dot at={[50, 50]} />
    </Graph>
  );
}

export function PedElasticInelastic() {
  const elastic = line([30, 60], [70, 40]);
  const inelastic = line([45, 60], [55, 40]);
  return (
    <Panels>
      <div>
        <PanelTitle>Price elastic (PED &gt; 1)</PanelTitle>
        <Graph label="Price elastic demand" x="Quantity" y="Price">
          <Region pts={[[0, 40], [30, 40], [30, 60], [0, 60]]} tone="loss" label="lost" />
          <Region pts={[[30, 0], [70, 0], [70, 40], [30, 40]]} tone="profit" label="gained" />
          <Drop at={[30, 60]} xTick="Q1" yTick="P1" />
          <Drop at={[70, 40]} xTick="Q2" yTick="P2" />
          <Curve f={elastic} from={2} to={98} label="D" at="end" dy={-6} dx={-6} />
        </Graph>
      </div>
      <div>
        <PanelTitle>Price inelastic (PED &lt; 1)</PanelTitle>
        <Graph label="Price inelastic demand" x="Quantity" y="Price">
          <Region pts={[[0, 40], [45, 40], [45, 60], [0, 60]]} tone="loss" label="lost" />
          <Region pts={[[45, 0], [55, 0], [55, 40], [45, 40]]} tone="profit" />
          <Drop at={[45, 60]} xTick="Q1" yTick="P1" />
          <Drop at={[55, 40]} xTick="Q2" yTick="P2" />
          <Curve f={inelastic} from={27.5} to={72.5} label="D" />
          <Note at={[58, 20]}>gained</Note>
        </Graph>
      </div>
    </Panels>
  );
}

export function PedSpecialCases() {
  const unit: Fn = (x) => 1500 / x;
  return (
    <Panels cols={3}>
      <div>
        <PanelTitle>Perfectly inelastic</PanelTitle>
        <Graph label="Perfectly inelastic demand" x="Quantity" y="Price">
          <Curve pts={[[50, 6], [50, 94]]} label="D" at="end" dx={6} dy={8} />
          <Note at={[56, 50]}>PED = 0</Note>
        </Graph>
      </div>
      <div>
        <PanelTitle>Perfectly elastic</PanelTitle>
        <Graph label="Perfectly elastic demand" x="Quantity" y="Price">
          <Curve pts={[[0, 50], [92, 50]]} label="D" />
          <Note at={[40, 58]}>PED = ∞</Note>
        </Graph>
      </div>
      <div>
        <PanelTitle>Unitary elastic</PanelTitle>
        <Graph label="Unitary elastic demand" x="Quantity" y="Price">
          <Region pts={[[0, 0], [30, 0], [30, 50], [0, 50]]} tone="consumer" />
          <Region pts={[[0, 0], [60, 0], [60, 25], [0, 25]]} tone="consumer" />
          <Drop at={[30, 50]} xTick="Q1" yTick="P1" />
          <Drop at={[60, 25]} xTick="Q2" yTick="P2" />
          <Curve f={unit} from={16} to={95} label="D" />
          <Note at={[38, 70]}>{"PED = 1:\nTR the same"}</Note>
        </Graph>
      </div>
    </Panels>
  );
}

export function PesShortLongRun() {
  const d1 = line([0, 80], [80, 0]);
  const d2 = line([0, 100], [100, 0]);
  const sr = line([40, 40], [60, 80]);
  const lr = line([0, 20], [40, 40]);
  const e1: Pt = [40, 40];
  const short = meet(d2, sr);
  const long = meet(d2, lr);
  return (
    <Graph label="Short-run and long-run supply" x="Quantity" y="Price">
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={short} xTick="Q2" yTick="P2" />
      <Drop at={long} xTick="Q3" yTick="P3" />
      <Curve f={d1} from={0} to={72} label="D1" />
      <Curve f={d2} from={6} to={92} label="D2" ink="accent" />
      <Curve f={sr} from={24} to={68} label="S short run" />
      <Curve f={lr} from={0} to={95} label="S long run" at={[95, lr(95)]} dx={-58} dy={-8} ink="second" />
      <Arrow from={[22, 62]} to={[34, 70]} />
      <Dot at={e1} />
      <Dot at={short} />
      <Dot at={long} ink="second" />
    </Graph>
  );
}

export function ConsumerProducerSurplus() {
  const d = line([0, 90], [100, 10]);
  const s = line([0, 10], [100, 90]);
  const e = meet(d, s);
  return (
    <Graph label="Consumer and producer surplus" x="Quantity" y="Price">
      <Region pts={[[0, 90], [0, e[1]], e]} tone="consumer" label={"Consumer\nsurplus"} at={[15, 62]} />
      <Region pts={[[0, 10], [0, e[1]], e]} tone="producer" label={"Producer\nsurplus"} at={[15, 38]} />
      <Drop at={e} xTick="Qe" yTick="Pe" />
      <Curve f={d} from={0} to={95} label="D" />
      <Curve f={s} from={0} to={95} label="S" />
      <Dot at={e} />
    </Graph>
  );
}

const D_TAX = line([0, 110], [50, 50]);

export function SpecificTax() {
  const s1 = line([0, 10], [50, 50]);
  const s2: Fn = (x) => s1(x) + 25;
  const e1 = meet(D_TAX, s1);
  const e2 = meet(D_TAX, s2);
  const received = s1(e2[0]);
  const q2 = e2[0];
  return (
    <Graph label="Specific indirect tax" x="Quantity" y="Price">
      <Region pts={[[0, e1[1]], [q2, e1[1]], e2, [0, e2[1]]]} tone="tax" label="Consumers pay" at={[q2 / 2, (e1[1] + e2[1]) / 2 - 2]} size={9.5} />
      <Region pts={[[0, received], [q2, received], [q2, e1[1]], [0, e1[1]]]} tone="producer" label="Producers pay" at={[q2 / 2, (received + e1[1]) / 2 - 2]} size={9.5} />
      <Region pts={[e2, [q2, received], e1]} tone="loss" />
      <Note at={[52, 38]}>{"Deadweight\nloss"}</Note>
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={e2} xTick="Q2" yTick="P2" />
      <Drop at={[q2, received]} yTick="P2 − t" toX={false} />
      <Curve f={D_TAX} from={10} to={82} label="D" />
      <Curve f={s1} from={0} to={95} label="S" />
      <Curve f={s2} from={0} to={80} label="S + tax" ink="accent" />
      <Arrow from={[72, s1(72) + 1]} to={[72, s2(72) - 1]} ink="accent" both />
      <Note at={[74, 80]} ink="accent">t</Note>
    </Graph>
  );
}

export function AdValoremTax() {
  const s1 = line([0, 10], [50, 50]);
  const s2: Fn = (x) => 1.3 * s1(x);
  const e1 = meet(D_TAX, s1);
  const e2 = meet(D_TAX, s2);
  const received = s1(e2[0]);
  return (
    <Graph label="Ad valorem tax" x="Quantity" y="Price">
      <Region pts={[[0, received], [e2[0], received], e2, [0, e2[1]]]} tone="tax" label={"Tax\nrevenue"} />
      <Region pts={[e2, [e2[0], received], e1]} tone="loss" />
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={e2} xTick="Q2" yTick="P2" />
      <Drop at={[e2[0], received]} toX={false} />
      <Curve f={D_TAX} from={10} to={82} label="D" />
      <Curve f={s1} from={0} to={95} label="S" />
      <Curve f={s2} from={0} to={82} label="S + tax (%)" ink="accent" />
      <Arrow from={[18, s1(18) + 0.5]} to={[18, s2(18) - 0.5]} ink="accent" width={1.2} />
      <Arrow from={[70, s1(70) + 0.5]} to={[70, s2(70) - 0.5]} ink="accent" width={1.2} />
      <Note at={[74, 62]} ink="accent">{"gap widens\nas price rises"}</Note>
    </Graph>
  );
}

export function Subsidy() {
  const s1 = line([0, 30], [50, 70]);
  const s2 = line([0, 10], [50, 50]);
  const e1 = meet(D_TAX, s1);
  const e2 = meet(D_TAX, s2);
  const received = s1(e2[0]);
  return (
    <Graph label="Producer subsidy" x="Quantity" y="Price">
      <Region pts={[[0, e2[1]], e2, [e2[0], received], [0, received]]} tone="tax" label={"Cost to the\ngovernment"} />
      <Drop at={e1} xTick="Q1" yTick="P1" />
      <Drop at={e2} xTick="Q2" yTick="P2" />
      <Drop at={[e2[0], received]} yTick="P2 + s" toX={false} />
      <Curve f={D_TAX} from={10} to={85} label="D" />
      <Curve f={s1} from={0} to={85} label="S" />
      <Curve f={s2} from={0} to={88} label="S − subsidy" ink="accent" />
      <Arrow from={[75, s1(75) - 1]} to={[75, s2(75) + 1]} ink="accent" />
      <Dot at={e1} />
      <Dot at={e2} ink="accent" />
    </Graph>
  );
}

// Short-run costs from TC = 940 + 45q − 0.9q² + 0.012q³.
const AVC: Fn = (q) => 45 - 0.9 * q + 0.012 * q * q;
const MC: Fn = (q) => 45 - 1.8 * q + 0.036 * q * q;
const ATC: Fn = (q) => 940 / q + AVC(q);

export function ShortRunCosts() {
  const minAvc: Pt = [37.5, AVC(37.5)];
  const minAtc = meet(MC, ATC, 40, 70);
  return (
    <Graph label="Short-run cost curves" x="Output" y="Costs">
      <Curve f={(q) => 940 / q} from={10} to={95} label="AFC" />
      <Curve f={AVC} from={3} to={92} label="AVC" />
      <Curve f={ATC} from={15} to={92} label="ATC" />
      <Curve f={MC} from={3} to={71} label="MC" ink="accent" />
      <Dot at={minAvc} />
      <Dot at={minAtc} />
      <Note at={[20, 93]}>{"MC cuts AVC and ATC\nat their lowest points"}</Note>
    </Graph>
  );
}

// Falls (economies), stays flat from the MES (constant returns), then rises.
export const LRAC: Fn = (q) => 26 + 0.00045 * Math.max(0, 50 - q) ** 3 + 0.0009 * Math.max(0, q - 62) ** 3;

export function LongRunAverageCost() {
  return (
    <Graph label="Long-run average cost" x="Output (scale)" y="Average cost">
      <Drop at={[50, LRAC(50)]} xTick="MES" />
      <Curve f={LRAC} from={5} to={95} label="LRAC" />
      <Note at={[22, 62]}>{"Economies\nof scale"}</Note>
      <Note at={[56, 38]} anchor="middle">{"Constant\nreturns"}</Note>
      <Note at={[68, 72]}>{"Diseconomies\nof scale"}</Note>
      <Arrow from={[14, 50]} to={[34, 32]} ink="green" />
      <Arrow from={[70, 31]} to={[88, 50]} ink="red" />
    </Graph>
  );
}

export function RevenueCurves() {
  const ar = line([0, 90], [100, 0]);
  const mr = line([0, 90], [50, 0]);
  return (
    <Panels>
      <div>
        <PanelTitle>Price taker</PanelTitle>
        <Graph label="Revenue curves for a price taker" x="Quantity" y="Price, revenue">
          <Tick y={50} label="P" />
          <Curve pts={[[0, 50], [95, 50]]} label="AR = MR = D" at={[30, 50]} dy={-8} />
          <Note at={[8, 30]}>{"Sells any amount at the\nmarket price, so every\nunit adds P to revenue"}</Note>
        </Graph>
      </div>
      <div>
        <PanelTitle>Price maker</PanelTitle>
        <Graph label="Revenue curves for a price maker" x="Quantity" y="Price, revenue">
          <Drop at={[50, ar(50)]} xTick="TR max" />
          <Curve f={ar} from={0} to={95} label="AR = D" at="end" dx={-30} dy={-8} />
          <Curve f={mr} from={0} to={50} label="MR" at="end" dx={4} dy={-4} ink="accent" />
          <Dot at={[50, ar(50)]} label="PED = 1" />
          <Note at={[20, 84]}>PED &gt; 1</Note>
          <Note at={[72, 36]}>PED &lt; 1</Note>
        </Graph>
      </div>
    </Panels>
  );
}

// Monopoly: AR = 92 − 0.8Q, MR = 92 − 1.6Q, TC = 704 + 40Q − Q² + 0.015Q³.
const M_AR = line([0, 92], [50, 52]);
const M_MR = line([0, 92], [50, 12]);
const M_MC: Fn = (q) => 40 - 2 * q + 0.045 * q * q;
const M_AC: Fn = (q) => 704 / q + 40 - q + 0.015 * q * q;

export function MonopolyProfit() {
  const [qm] = meet(M_MC, M_MR, 25, 60);
  const pm = M_AR(qm);
  const ac = M_AC(qm);
  return (
    <Graph label="Monopoly: profit maximisation" x="Quantity" y="Price, costs">
      <Region pts={[[0, ac], [qm, ac], [qm, pm], [0, pm]]} tone="profit" label={"Supernormal\nprofit"} at={[11, 54]} size={8.5} />
      <Drop at={[qm, pm]} xTick="Qm" yTick="Pm" />
      <Drop at={[qm, ac]} yTick="AC" toX={false} />
      <Curve f={M_AR} from={0} to={95} label="AR = D" at="end" dx={-40} dy={16} />
      <Curve f={M_MR} from={0} to={57.5} label="MR" at="end" dx={4} dy={-4} ink="second" />
      <Curve f={M_AC} from={11} to={90} label="AC" />
      <Curve f={M_MC} from={3} to={64} label="MC" ink="accent" />
      <Dot at={[qm, M_MR(qm)]} label="MC = MR" dx={8} dy={4} />
    </Graph>
  );
}

export function MonopolyVsCompetition() {
  const ar = line([0, 90], [100, 15]);
  const mr = line([0, 90], [60, 0]);
  const cost = 30;
  return (
    <Graph label="Monopoly compared with a competitive market" x="Quantity" y="Price, costs">
      <Region pts={[[0, cost], [40, cost], [40, 60], [0, 60]]} tone="profit" label={"Monopoly\nprofit"} at={[14, 47]} />
      <Region pts={[[40, 60], [40, cost], [80, cost]]} tone="loss" />
      <Note at={[50, 46]}>{"Deadweight\nloss"}</Note>
      <Drop at={[40, 60]} xTick="Qm" yTick="Pm" />
      <Drop at={[80, cost]} xTick="Qc" yTick="Pc" />
      <Curve f={ar} from={0} to={100} label="AR = D" at="end" dx={-40} dy={16} />
      <Curve f={mr} from={0} to={60} label="MR" at="end" dx={4} dy={-4} ink="second" />
      <Curve pts={[[0, cost], [100, cost]]} label="MC = AC" at={[1, cost]} dy={14} ink="accent" />
      <Dot at={[40, 60]} />
      <Dot at={[80, cost]} />
    </Graph>
  );
}

// Externalities share one demand and supply so they're easy to compare.
const MPB = line([0, 90], [100, 10]);
const MPC = line([0, 10], [100, 90]);
const EXT_MSC = line([0, 30], [66, 96]);

/** The welfare loss label sits in clear space and points at the triangle. */
function WelfareLoss({ at, to, text = "Welfare loss" }: { at: Pt; to: Pt; text?: string }) {
  return (
    <g className="lbl">
      <Note at={at} ink="red" weight={600}>
        {text}
      </Note>
      <Arrow from={[at[0] - 1, at[1] + 1]} to={to} ink="red" width={1.1} />
    </g>
  );
}

export function NegativeProductionExternality() {
  const market = meet(MPB, MPC);
  const best = meet(MPB, EXT_MSC);
  return (
    <Graph label="Negative production externality" x="Quantity" y="Price, costs, benefits">
      <Region pts={[best, [market[0], EXT_MSC(market[0])], market]} tone="loss" />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Curve f={MPB} from={0} to={95} label="MPB = MSB" at="end" dx={-66} dy={16} />
      <Curve f={MPC} from={0} to={95} label="MPC" />
      <Curve f={EXT_MSC} from={0} to={66} label="MSC" ink="red" />
      <WelfareLoss at={[58, 48]} to={[45, 63]} />
      <Dot at={best} ink="red" />
      <Dot at={market} />
    </Graph>
  );
}

export function NegativeConsumptionExternality() {
  const msb = line([0, 80], [80, 4]);
  const market = meet(MPB, MPC);
  const best = meet(msb, MPC);
  return (
    <Graph label="Negative consumption externality" x="Quantity" y="Price, costs, benefits">
      <Region pts={[best, market, [market[0], msb(market[0])]]} tone="loss" />
      <WelfareLoss at={[60, 49]} to={[48, 42]} />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Curve f={MPC} from={0} to={95} label="MPC = MSC" at={[95, MPC(95)]} dx={-62} dy={-10} />
      <Curve f={MPB} from={0} to={95} label="MPB" />
      <Curve f={msb} from={0} to={80} label="MSB" ink="red" />
      <Dot at={best} ink="red" />
      <Dot at={market} />
    </Graph>
  );
}

const MERIT_MPB = line([0, 80], [100, 0]);
const MERIT_MSB = line([0, 92], [100, 17]);

export function PositiveConsumptionExternality() {
  const market = meet(MERIT_MPB, MPC);
  const best = meet(MERIT_MSB, MPC);
  return (
    <Graph label="Positive consumption externality (merit good)" x="Quantity" y="Price, costs, benefits">
      <Region pts={[[market[0], MERIT_MSB(market[0])], market, best]} tone="loss" />
      <WelfareLoss at={[64, 51]} to={[48, 52]} />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Curve f={MPC} from={0} to={95} label="MPC = MSC" at={[95, MPC(95)]} dx={-62} dy={-10} />
      <Curve f={MERIT_MPB} from={0} to={95} label="MPB" />
      <Curve f={MERIT_MSB} from={0} to={100} label="MSB" at="end" dx={-26} dy={-6} ink="green" />
      <Dot at={market} />
      <Dot at={best} ink="green" />
    </Graph>
  );
}

export function PositiveProductionExternality() {
  const mpc = line([0, 20], [95, 96]);
  const msc = line([0, 10], [100, 80]);
  const market = meet(MPB, mpc);
  const best = meet(MPB, msc);
  return (
    <Graph label="Positive production externality" x="Quantity" y="Price, costs, benefits">
      <Region pts={[market, [market[0], msc(market[0])], best]} tone="loss" />
      <WelfareLoss at={[62, 45]} to={[48, 47.5]} />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Curve f={MPB} from={0} to={95} label="MPB = MSB" at="end" dx={-66} dy={16} />
      <Curve f={mpc} from={0} to={95} label="MPC" />
      <Curve f={msc} from={0} to={100} label="MSC" at="end" dx={-26} dy={-6} ink="green" />
      <Dot at={market} />
      <Dot at={best} ink="green" />
    </Graph>
  );
}

export function TaxOnExternality() {
  const best = meet(MPB, EXT_MSC);
  const market = meet(MPB, MPC);
  const tax = EXT_MSC(best[0]) - MPC(best[0]);
  const taxed: Fn = (x) => MPC(x) + tax;
  return (
    <Graph label="Indirect tax to correct a negative externality" x="Quantity" y="Price, costs, benefits">
      <Region pts={[[0, MPC(best[0])], [best[0], MPC(best[0])], best, [0, best[1]]]} tone="tax" label={"Tax\nrevenue"} at={[26, 44]} size={9.5} />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Drop at={[best[0], MPC(best[0])]} toX={false} />
      <Curve f={MPB} from={0} to={95} label="MPB = MSB" at="end" dx={-66} dy={16} />
      <Curve f={MPC} from={0} to={95} label="MPC" />
      <Curve f={EXT_MSC} from={0} to={60} label="MSC" ink="red" dashed at="end" dx={-30} dy={-4} />
      <Curve f={taxed} from={0} to={78} label="MPC + tax" ink="accent" />
      <Arrow from={[84, MPC(84) + 1]} to={[84, taxed(84) - 1]} ink="accent" />
      <Dot at={best} ink="accent" />
    </Graph>
  );
}

export function SubsidyMeritGood() {
  const market = meet(MERIT_MPB, MPC);
  const best = meet(MERIT_MSB, MPC);
  const s = best[1] - MERIT_MPB(best[0]);
  const subsidised: Fn = (x) => MPC(x) - s;
  const paid = MERIT_MPB(best[0]);
  return (
    <Graph label="Subsidy for a merit good" x="Quantity" y="Price, costs, benefits">
      <Region pts={[[0, paid], [best[0], paid], best, [0, best[1]]]} tone="tax" label="Subsidy cost" at={[17, 47]} size={9} />
      <Drop at={market} xTick="Qm" yTick="Pm" />
      <Drop at={best} yTick="P2 + s" toX={false} />
      <Drop at={[best[0], paid]} xTick="Q*" yTick="P2" />
      <Curve f={MPC} from={0} to={95} label="MPC" />
      <Curve f={subsidised} from={(s - 10) / 0.8} to={80} label="MPC − subsidy" ink="accent" />
      <Curve f={MERIT_MPB} from={0} to={95} label="MPB" />
      <Curve f={MERIT_MSB} from={0} to={100} label="MSB" at="end" dx={-26} dy={-6} ink="green" dashed />
      <Dot at={[best[0], paid]} ink="accent" />
    </Graph>
  );
}

const PC_D = line([0, 90], [100, 10]);
const PC_S = line([0, 10], [100, 90]);

export function MaximumPrice() {
  const cap = 35;
  const qs = (cap - 10) / 0.8;
  const qd = (90 - cap) / 0.8;
  return (
    <Graph label="Maximum price" x="Quantity" y="Price">
      <Drop at={[50, 50]} xTick="Qe" yTick="Pe" />
      <Drop at={[qs, PC_D(qs)]} xTick="Qs" yTick="Pb" />
      <Drop at={[qd, cap]} xTick="Qd" toY={false} />
      <Curve f={PC_D} from={0} to={95} label="D" />
      <Curve f={PC_S} from={0} to={95} label="S" />
      <Curve pts={[[0, cap], [92, cap]]} ink="red" label="Max price" at={[78, cap]} dy={-6} width={2} />
      <Arrow from={[qs, 26]} to={[qd, 26]} ink="red" both />
      <Note at={[50, 18]} anchor="middle" ink="red">Shortage (excess demand)</Note>
      <Dot at={[qs, PC_D(qs)]} label="Black-market price" />
    </Graph>
  );
}

export function MinimumPrice() {
  const floor = 65;
  const qd = (90 - floor) / 0.8;
  const qs = (floor - 10) / 0.8;
  return (
    <Graph label="Minimum price" x="Quantity" y="Price">
      <Drop at={[50, 50]} xTick="Qe" yTick="Pe" />
      <Drop at={[qd, floor]} xTick="Qd" />
      <Drop at={[qs, floor]} xTick="Qs" toY={false} />
      <Curve f={PC_D} from={0} to={95} label="D" />
      <Curve f={PC_S} from={0} to={95} label="S" />
      <Curve pts={[[0, floor], [92, floor]]} ink="red" label="Min price" at={[78, floor]} dy={14} width={2} />
      <Arrow from={[qd, 73]} to={[qs, 73]} ink="red" both />
      <Note at={[50, 78]} anchor="middle" ink="red">Surplus (excess supply)</Note>
    </Graph>
  );
}

export function PollutionPermits() {
  const d = line([0, 90], [100, 0]);
  return (
    <Graph label="Tradable pollution permits" x="Number of permits" y="Price per permit">
      <Drop at={[60, d(60)]} xTick="Q1" yTick="P1" />
      <Drop at={[40, d(40)]} xTick="Q2" yTick="P2" />
      <Curve f={d} from={0} to={95} label="D for permits" at={[72, d(72)]} dx={8} dy={-6} />
      <Curve pts={[[60, 4], [60, 94]]} label="S1 (cap)" at="end" dx={4} dy={4} />
      <Curve pts={[[40, 4], [40, 94]]} label="S2" at="end" dx={-18} dy={4} ink="accent" />
      <Arrow from={[58, 84]} to={[42, 84]} />
      <Note at={[64, 66]}>{"Tighter cap:\npermits cost more,\nso cutting pollution\npays sooner"}</Note>
    </Graph>
  );
}

export function GovernmentFailureTax() {
  const best = meet(MPB, EXT_MSC);
  const high: Fn = (x) => MPC(x) + 45;
  const taxed = meet(MPB, high);
  return (
    <Graph label="Government failure: tax set too high" x="Quantity" y="Price, costs, benefits">
      <Region pts={[taxed, [taxed[0], EXT_MSC(taxed[0])], best]} tone="loss" />
      <Drop at={taxed} xTick="Qt" yTick="Pt" />
      <Drop at={best} xTick="Q*" yTick="P*" />
      <Curve f={MPB} from={0} to={95} label="MPB = MSB" at="end" dx={-66} dy={16} />
      <Curve f={MPC} from={0} to={95} label="MPC" />
      <Curve f={EXT_MSC} from={0} to={66} label="MSC" ink="red" dashed />
      <Curve f={high} from={0} to={52} label="MPC + tax" at="end" dx={-64} dy={-4} ink="accent" />
      <WelfareLoss at={[56, 49]} to={[26, 62]} text="New welfare loss" />
      <Dot at={taxed} ink="accent" />
      <Dot at={best} ink="red" />
    </Graph>
  );
}
