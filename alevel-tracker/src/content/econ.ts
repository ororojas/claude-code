import type { ExamTechnique, TeachCard } from "./types";

export const econTechnique: ExamTechnique = {
  subjectId: "econ",
  paper: "AQA 7136/1 · 2 hours · 80 marks",
  timing:
    "1.5 minutes per mark. Section A (one data context out of two, 40 marks) and Section B (one essay out of three, 40 marks) get about an hour each. In this mock, pick the context and essay that stay inside Y12 content.",
  questionTypes: [
    { marks: 2, command: "Define / calculate", minutes: 3, howToHit: "Textbook definition or a calculation with working and units. No waffle." },
    { marks: 4, command: "Explain (often with a diagram)", minutes: 6, howToHit: "Accurate, fully labelled diagram plus two linked sentences that say what the diagram shows." },
    { marks: 9, command: "Analyse, using the data", minutes: 13, howToHit: "Two developed chains of reasoning, each anchored to figures from the extracts, with a diagram where it helps. Evaluation is not rewarded." },
    { marks: 15, command: "Explain / analyse (essay part 1)", minutes: 20, howToHit: "Two or three well-developed analytical points with a diagram. Depth beats breadth. No evaluation needed." },
    { marks: 25, command: "Evaluate / discuss", minutes: 35, howToHit: "Two or three analysed points, each followed by evaluation, then a conclusion that makes a supported judgement and says what it depends on." },
  ],
};

export const econCards: TeachCard[] = [
  {
    topicId: "econ-problem",
    summary: [
      "Scarcity: wants are unlimited but resources (land, labour, capital, enterprise) are finite, so every society has to choose what, how and for whom to produce.",
      "Opportunity cost is the next best alternative given up. Use it in evaluation: money spent on one policy can't be spent on another.",
      "A PPF shows the maximum combinations of two goods when resources are fully and efficiently used. Inside the curve means unemployed or misused resources. Outside it is unattainable today.",
      "Movement along the PPF is reallocation. An outward shift is economic growth from more or better resources or new technology.",
      "A concave PPF shows increasing opportunity cost, because resources are not equally suited to producing both goods.",
      "Positive statements can be tested against evidence. Normative statements contain a value judgement (\"should\", \"fair\", \"too high\").",
      "Specialisation and the division of labour raise productivity but create the need for exchange, and so for money.",
    ],
    definitions: [
      { term: "Scarcity", definition: "The basic economic problem: finite resources relative to unlimited wants." },
      { term: "Opportunity cost", definition: "The value of the next best alternative forgone when a choice is made." },
      { term: "Production possibility frontier", definition: "A curve showing the maximum possible output combinations of two goods with all resources fully and efficiently employed." },
      { term: "Productive efficiency", definition: "Producing on the PPF, so output of one good can't rise without reducing another." },
      { term: "Positive statement", definition: "A statement of fact that can be tested with evidence." },
      { term: "Normative statement", definition: "A statement containing a value judgement that can't be proved true or false." },
    ],
    diagrams: [
      {
        name: "PPF",
        checklist: [
          "Axes labelled with the two goods (e.g. capital goods, consumer goods), origin at 0",
          "Concave curve touching both axes",
          "Point inside labelled as unemployment / inefficiency; point outside as unattainable",
          "For growth: second PPF drawn outward with an arrow",
          "Opportunity cost shown as the fall in one good when moving along the curve",
        ],
      },
    ],
    essays: [
      {
        marks: 9,
        label: "Analyse (9)",
        question: "Using a PPF diagram, analyse how a rise in investment in education and training could affect the UK economy.",
        structure: [
          "Short run: resources move into education, so the economy moves along the PPF and gives up current consumer goods (opportunity cost).",
          "Long run: a more productive labour force shifts the PPF outward. Draw both curves and label the shift.",
          "Link to data: use any productivity or spending figures in the extract to show the size of the change.",
        ],
        evaluation: [
          "Not needed for 9 marks. Put the effort into a clean diagram and two linked chains.",
        ],
      },
    ],
    mistakes: [
      "Treating a movement along the PPF as growth.",
      "Describing opportunity cost as the money price paid.",
      "Drawing a straight-line PPF without saying it implies constant opportunity cost.",
    ],
    practice: [
      { marks: 2, question: "Define opportunity cost." },
      { marks: 4, question: "Explain, using a PPF diagram, the likely effect of a major flood that destroys farmland." },
      { marks: 9, question: "Analyse why a government that increases spending on healthcare faces an opportunity cost." },
    ],
  },
  {
    topicId: "econ-behavioural",
    summary: [
      "Traditional theory assumes rational consumers who maximise utility. Diminishing marginal utility helps explain why demand curves slope down.",
      "Bounded rationality (Simon): people have limited information, time and brainpower, so they satisfice rather than maximise.",
      "Bounded self-control: people often choose short-term pleasure over long-term benefit (overeating, under-saving).",
      "Biases to name and apply: rules of thumb, anchoring, availability bias, social norms and herding, framing, and the power of defaults.",
      "People also care about fairness and other people (altruism), which pure self-interest can't explain.",
      "Choice architecture shapes decisions without banning options. Nudges include defaults (pension auto-enrolment, opt-out organ donation), framing, restricted and mandated choice.",
      "Nudges are cheap and keep freedom of choice, but effects can be small or fade, they can feel manipulative, and they don't change prices or incentives.",
    ],
    definitions: [
      { term: "Rational decision making", definition: "Choosing the option that maximises utility (consumers) or profit (firms) given full information." },
      { term: "Marginal utility", definition: "The extra satisfaction from consuming one more unit of a good." },
      { term: "Bounded rationality", definition: "Rationality limited by information, time and cognitive ability, leading people to satisfice." },
      { term: "Anchoring", definition: "Relying too heavily on the first piece of information seen when making a decision." },
      { term: "Availability bias", definition: "Judging likelihood by how easily examples come to mind." },
      { term: "Nudge", definition: "A change in choice architecture that alters behaviour predictably without banning options or changing incentives much." },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate the view that nudges are a more effective way than taxation to reduce the consumption of sugary drinks.",
        structure: [
          "Intro: define nudge and bounded self-control. Sugary drinks are a demerit good with health costs to third parties.",
          "Nudges analysis: shelf placement, smaller default sizes and traffic-light labels target biases at the point of choice, cost little and keep consumer freedom.",
          "Tax analysis: an indirect tax shifts supply left, raises price and internalises part of the external cost. Draw the diagram. The UK soft drinks levy pushed many firms to reformulate.",
          "Compare: nudges work on habit and information; taxes work on price. Demand for sugary drinks may be price inelastic, which limits a tax.",
          "Conclusion: they complement each other. The best mix depends on PED, the size of the external cost and how strong the biases are.",
        ],
        evaluation: [
          "Nudge effects are often small and can fade as people get used to them.",
          "Taxes raise revenue that can be spent on health education; nudges raise none.",
          "Inelastic demand means a tax mostly raises revenue rather than cutting consumption, and it is regressive.",
          "Firms' reaction (reformulation) can matter more than consumers' reaction.",
          "Government may lack the information to design either policy well, risking government failure.",
        ],
      },
    ],
    mistakes: [
      "Calling people \"irrational\" without naming the specific bias.",
      "Describing a nudge without linking it to the bias it targets.",
      "Forgetting to contrast with the traditional rational model.",
    ],
    practice: [
      { marks: 2, question: "Define bounded rationality." },
      { marks: 4, question: "Explain how a default choice can change behaviour, using an example." },
      { marks: 15, question: "Explain how behavioural economics can help the government increase saving for retirement." },
    ],
  },
  {
    topicId: "econ-demand-supply",
    summary: [
      "Demand is the quantity consumers are willing and able to buy at each price. It falls as price rises (income and substitution effects).",
      "A change in the good's own price moves along the curve. Anything else shifts it: income, prices of substitutes and complements, tastes, advertising, population.",
      "Supply is the quantity firms are willing and able to sell at each price. Higher prices make production more profitable, so supply slopes up.",
      "Supply shifts with costs of production, technology, indirect taxes and subsidies, the number of firms, weather and expectations.",
      "Equilibrium is where demand equals supply. Excess demand pushes price up; excess supply pushes it down.",
      "Always write the chain: shock → curve shifts → excess demand/supply at the old price → price adjusts → new equilibrium price and quantity.",
      "How big the change is depends on elasticity. Say so in 9-markers.",
    ],
    definitions: [
      { term: "Effective demand", definition: "Desire for a good backed by the ability to pay." },
      { term: "Supply", definition: "The quantity of a good firms are willing and able to sell at each price over a period of time." },
      { term: "Equilibrium price", definition: "The price at which quantity demanded equals quantity supplied, so the market clears." },
      { term: "Excess demand", definition: "Quantity demanded is greater than quantity supplied at the current price." },
      { term: "Excess supply", definition: "Quantity supplied is greater than quantity demanded at the current price." },
      { term: "Ceteris paribus", definition: "All other things held constant." },
    ],
    diagrams: [
      {
        name: "Shift in demand or supply",
        checklist: [
          "Axes: Price (P) and Quantity (Q)",
          "Curves labelled D1, D2 / S1, S2 with an arrow showing the shift",
          "Old and new equilibria with dotted lines to P1, P2, Q1, Q2",
          "Only the curve that the shock affects moves",
          "Text says what the diagram shows, with the direction of P and Q",
        ],
      },
    ],
    essays: [
      {
        marks: 9,
        label: "Analyse (9)",
        question: "Using the data and a demand and supply diagram, analyse the likely reasons for the rise in the world price of cocoa.",
        structure: [
          "Supply side: poor harvests (weather, disease) shift supply left. Quote the output fall from the extract. Diagram.",
          "Demand side: rising incomes in emerging economies shift demand right. Quote the demand growth figure.",
          "Combine: both shifts push price up; the price rise is large if supply is price inelastic in the short run.",
        ],
        evaluation: ["Not rewarded at 9 marks. Use the data instead."],
      },
    ],
    mistakes: [
      "Saying \"demand rises, so supply rises\". Supply extends along the curve; it doesn't shift.",
      "Unlabelled axes or curves.",
      "Text and diagram telling different stories.",
    ],
    practice: [
      { marks: 2, question: "Define equilibrium price." },
      { marks: 4, question: "Explain, using a diagram, the effect of a fall in the price of a complement on the market for games consoles." },
      { marks: 9, question: "Analyse two factors that might cause the price of houses to rise." },
    ],
  },
  {
    topicId: "econ-elasticities",
    summary: [
      "PED measures how responsive quantity demanded is to a change in price. It is negative; say so and interpret the size.",
      "Elastic (>1), inelastic (<1), unitary (=1), perfectly inelastic (0), perfectly elastic (∞).",
      "PED determinants: availability of substitutes, proportion of income spent, necessity vs luxury, habit or addiction, time period, how broadly the market is defined.",
      "PED and total revenue: if demand is inelastic, raising price raises revenue. If elastic, cutting price raises revenue. Unitary leaves it unchanged.",
      "YED: normal goods are positive, luxuries above 1, inferior goods negative.",
      "XED: substitutes are positive, complements negative, unrelated goods close to zero.",
      "PES depends on spare capacity, stock levels, time period, factor mobility and production lags (farming).",
      "Uses: firms' pricing, predicting the effect of shocks, and which side bears a tax (the more inelastic side).",
    ],
    definitions: [
      { term: "PED", definition: "The responsiveness of quantity demanded to a change in the good's own price." },
      { term: "YED", definition: "The responsiveness of quantity demanded to a change in real income." },
      { term: "XED", definition: "The responsiveness of quantity demanded of good A to a change in the price of good B." },
      { term: "PES", definition: "The responsiveness of quantity supplied to a change in price." },
      { term: "Inferior good", definition: "A good with negative YED: demand falls as income rises." },
    ],
    formulas: [
      { name: "PED", formula: "% change in Qd ÷ % change in price" },
      { name: "YED", formula: "% change in Qd ÷ % change in income" },
      { name: "XED", formula: "% change in Qd of A ÷ % change in price of B" },
      { name: "PES", formula: "% change in Qs ÷ % change in price" },
      { name: "% change", formula: "(new − old) ÷ old × 100", tip: "Always divide by the original value." },
    ],
    diagrams: [
      {
        name: "Elastic vs inelastic demand",
        checklist: [
          "Two demand curves on separate diagrams, flatter for elastic and steeper for inelastic, with the same price change",
          "Revenue rectangles shaded to show gain and loss",
          "Note that a straight-line demand curve has changing elasticity along it",
        ],
      },
      {
        name: "Short-run vs long-run supply",
        checklist: ["Steep SR supply and flatter LR supply through the same point", "Same demand shift shows a bigger price rise in the SR"],
      },
    ],
    essays: [
      {
        marks: 9,
        label: "Analyse (9)",
        question: "Using the data, analyse how knowledge of PED and YED could help a budget airline set its prices.",
        structure: [
          "PED: leisure travellers are price sensitive (elastic), so cutting fares raises revenue. Use the data's passenger and fare figures.",
          "Business travellers book late with fewer substitutes (inelastic), so higher late fares raise revenue. That is why prices rise near departure.",
          "YED: flights are a normal or luxury good, so a recession hits demand hard. Plan capacity accordingly.",
        ],
        evaluation: ["Not rewarded at 9 marks."],
      },
    ],
    mistakes: [
      "Treating the slope of a curve as its elasticity.",
      "Dropping the minus sign or flipping the formula.",
      "Labelling a luxury as simply \"positive YED\" when it needs to be above 1.",
    ],
    practice: [
      { marks: 2, question: "The price of a coffee rises from £4.00 to £5.00 and daily sales fall from 200 to 170. Calculate the PED.", answer: "%ΔQd = (170 − 200) ÷ 200 = −15%. %ΔP = (5 − 4) ÷ 4 = +25%. PED = −15 ÷ 25 = −0.6 (inelastic)." },
      { marks: 2, question: "Incomes rise by 4% and demand for bus travel falls by 2%. Calculate YED and state the type of good.", answer: "YED = −2 ÷ 4 = −0.5. Negative, so an inferior good." },
      { marks: 4, question: "Explain why the PES of wheat is likely to be low in the short run." },
      { marks: 9, question: "Analyse how the PED for petrol affects the impact of a rise in fuel duty on consumers and the government." },
    ],
  },
  {
    topicId: "econ-price-mechanism",
    summary: [
      "Price does three jobs: signalling (where resources are wanted), rationing (who gets scarce goods) and incentive (rewards producers who respond).",
      "Consumer surplus is the area below demand and above price. Producer surplus is the area above supply and below price.",
      "Interrelated markets: joint demand (cars and petrol), competitive demand (substitutes), composite demand (milk for cheese and butter), derived demand (labour), joint supply (beef and leather).",
      "A specific (per-unit) tax shifts supply up by the tax. An ad valorem tax pivots it.",
      "Tax incidence falls more on whichever side is more inelastic. Inelastic demand means consumers pay most of the tax.",
      "Tax revenue = tax per unit × new quantity. The output lost creates a deadweight welfare loss.",
      "A subsidy shifts supply down. Consumers gain from a lower price, producers from a higher price received, and the cost to the government is subsidy per unit × new quantity.",
    ],
    definitions: [
      { term: "Signalling function", definition: "Price changes send information to buyers and sellers about where resources are wanted." },
      { term: "Consumer surplus", definition: "The difference between what consumers are willing to pay and what they actually pay." },
      { term: "Producer surplus", definition: "The difference between the price producers receive and the minimum they would accept." },
      { term: "Derived demand", definition: "Demand for a good or factor because it is needed to make another good." },
      { term: "Tax incidence", definition: "How the burden of a tax is split between consumers and producers." },
    ],
    diagrams: [
      {
        name: "Specific indirect tax",
        checklist: [
          "S1 and S1 + tax drawn parallel, vertical gap = tax per unit",
          "Original P1, Q1; new consumer price P2 and quantity Q2",
          "Price producers keep (P2 minus tax) marked on the price axis",
          "Consumer incidence (P1 to P2) and producer incidence shaded differently",
          "Tax revenue rectangle and the deadweight loss triangle",
        ],
      },
      {
        name: "Subsidy",
        checklist: ["S1 and S1 − subsidy, parallel", "Lower consumer price, higher producer price received", "Total cost to government rectangle"],
      },
    ],
    essays: [
      {
        marks: 9,
        label: "Analyse (9)",
        question: "Using a diagram, analyse how the PED of a product determines who bears the burden of an indirect tax.",
        structure: [
          "Draw the tax diagram for inelastic demand: price rises by most of the tax, so consumers bear most of it.",
          "Contrast with elastic demand: price barely rises, so producers absorb most of it and output falls a lot.",
          "Link to data, e.g. a tax on cigarettes or fuel where demand is inelastic.",
        ],
        evaluation: ["Not rewarded at 9 marks."],
      },
    ],
    mistakes: [
      "Shifting the demand curve for a tax on producers.",
      "Mixing up the shapes of specific (parallel) and ad valorem (pivot) taxes.",
      "Forgetting to mark the price producers actually receive.",
    ],
    practice: [
      { marks: 4, question: "Explain the rationing function of the price mechanism using the market for concert tickets." },
      { marks: 2, question: "A £2 per-unit tax raises the price of a good from £10 to £11.50. What share of the tax do consumers pay?", answer: "Consumers pay £1.50 of £2, so 75%. Producers pay the other 25%." },
      { marks: 9, question: "Analyse how a subsidy for electric cars affects consumers, producers and the government." },
    ],
  },
  {
    topicId: "econ-costs-revenue",
    summary: [
      "Productivity is output per worker (or per hour). Specialisation and the division of labour raise it but can mean boredom and dependence.",
      "Short run: at least one factor is fixed. The law of diminishing returns makes marginal cost rise, so average cost is U-shaped.",
      "Fixed costs don't vary with output; variable costs do. ATC = AFC + AVC, and MC cuts ATC at its lowest point.",
      "Long run: all factors are variable. Economies of scale (technical, purchasing, managerial, financial, marketing, risk-bearing) lower long-run average cost.",
      "Diseconomies of scale (communication, coordination, motivation) raise LRAC as the firm grows too large.",
      "Minimum efficient scale is the lowest output where LRAC is minimised. A high MES relative to the market favours a few large firms.",
      "Revenue: TR = P × Q, AR = TR ÷ Q (the demand curve), MR = ΔTR ÷ ΔQ. A price taker has AR = MR.",
      "Normal profit is the minimum to keep the firm in the industry. Supernormal profit is anything above, and it signals entry.",
    ],
    definitions: [
      { term: "Productivity", definition: "Output per unit of input, usually output per worker per hour." },
      { term: "Law of diminishing returns", definition: "In the short run, adding more of a variable factor to a fixed factor eventually makes marginal output fall." },
      { term: "Economies of scale", definition: "Falling long-run average costs as the scale of production increases." },
      { term: "Diseconomies of scale", definition: "Rising long-run average costs as a firm grows beyond its optimum size." },
      { term: "Minimum efficient scale", definition: "The lowest output at which long-run average cost is at its minimum." },
      { term: "Normal profit", definition: "The level of profit just sufficient to keep a firm in the industry (covers opportunity cost)." },
    ],
    formulas: [
      { name: "Total revenue", formula: "Price × quantity" },
      { name: "Average revenue", formula: "Total revenue ÷ quantity" },
      { name: "Marginal revenue", formula: "Change in TR ÷ change in quantity" },
      { name: "Average total cost", formula: "Total cost ÷ quantity (= AFC + AVC)" },
      { name: "Profit", formula: "Total revenue − total cost" },
    ],
    diagrams: [
      {
        name: "LRAC with economies and diseconomies of scale",
        checklist: ["Axes: Costs/revenue and Output", "U-shaped (or L-shaped) LRAC", "Falling section labelled economies of scale, rising section diseconomies", "MES marked on the output axis"],
      },
      {
        name: "Short-run cost curves",
        checklist: ["U-shaped ATC and AVC", "MC cuts both at their minimum points", "AFC falls continuously"],
      },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate the view that large firms are always more efficient than small firms.",
        structure: [
          "Intro: define productive efficiency and economies of scale.",
          "For: technical and purchasing economies lower average cost. Draw the LRAC and show MES. Lower costs can mean lower prices.",
          "Against: diseconomies of scale and X-inefficiency in firms without competitive pressure.",
          "Small firms: flexibility, niche markets, close customer contact. Many industries have a low MES.",
          "Conclusion: efficiency depends on MES relative to the market size, competition and management quality, not size alone.",
        ],
        evaluation: [
          "Large firms with market power may not pass lower costs on to consumers.",
          "External economies of scale let small firms in clusters benefit too.",
          "Technology (online selling, cloud services) has lowered MES in many markets.",
          "Short run vs long run: growth by takeover often brings integration problems first.",
        ],
      },
    ],
    mistakes: [
      "Mixing up diminishing returns (short run) and diseconomies of scale (long run).",
      "Saying economies of scale reduce total cost. They reduce average cost.",
      "Not linking lower costs to the effect on consumers.",
    ],
    practice: [
      { marks: 2, question: "A firm sells 400 units at £15 with total costs of £5,200. Calculate its profit.", answer: "TR = 400 × £15 = £6,000. Profit = £6,000 − £5,200 = £800." },
      { marks: 4, question: "Explain the difference between internal and external economies of scale." },
      { marks: 15, question: "Explain why firms may experience diseconomies of scale as they grow." },
    ],
  },
  {
    topicId: "econ-market-structures",
    summary: [
      "Market structures run from perfect competition through monopolistic competition and oligopoly to monopoly.",
      "Competitive markets have many firms and low barriers to entry, which keeps prices close to cost and pushes firms to be efficient.",
      "Concentrated markets are dominated by a few firms. A concentration ratio (e.g. 4-firm CR) is the combined market share of the largest n firms.",
      "Pure monopoly is a single seller. In UK law, a firm with 25%+ market share can be investigated as having monopoly power.",
      "Barriers to entry: economies of scale, legal barriers (patents, licences), brand loyalty, sunk costs and control of key resources.",
      "Monopoly power lets a firm set price above cost and restrict output, cutting consumer surplus and causing allocative inefficiency.",
      "Counterweights: economies of scale can lower costs; supernormal profit can fund R&D (dynamic efficiency); natural monopolies avoid wasteful duplication.",
      "Firms are usually assumed to profit maximise (MC = MR), but may pursue growth, revenue or satisficing instead.",
    ],
    definitions: [
      { term: "Concentration ratio", definition: "The combined market share of the largest n firms in a market." },
      { term: "Barrier to entry", definition: "Anything that makes it hard for new firms to enter a market." },
      { term: "Monopoly power", definition: "The ability of a firm to set price above the competitive level." },
      { term: "Natural monopoly", definition: "A market where one firm can supply the whole market at lower average cost than two or more firms." },
      { term: "Dynamic efficiency", definition: "Improvements in products and processes over time, often funded by profit." },
    ],
    diagrams: [
      {
        name: "Monopoly vs competition",
        checklist: [
          "Competitive outcome at Pc, Qc where D = S (or MC)",
          "Monopoly outcome at a higher price and lower quantity (Pm, Qm)",
          "Lost consumer surplus and deadweight welfare loss shaded",
          "If you use AR/MR: profit-maximising output where MC = MR, price read off AR, supernormal profit rectangle",
        ],
      },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate the view that monopolies always act against the interests of consumers.",
        structure: [
          "Intro: define monopoly power and barriers to entry.",
          "Against consumers: higher prices, lower output, less choice, possible X-inefficiency. Diagram with welfare loss.",
          "For consumers: economies of scale may give lower prices than many small firms; profits fund innovation (pharmaceuticals).",
          "Natural monopolies (water, rail track): one network avoids wasteful duplication, but needs regulation.",
          "Conclusion: it depends on barriers, regulation (CMA, price caps), whether the market is contestable, and short vs long run.",
        ],
        evaluation: [
          "Monopolies are constrained by demand: they choose price or quantity, not both.",
          "A contestable market (threat of entry) can keep prices low even with one firm.",
          "Regulators may lack information to set the right price cap (government failure).",
          "Innovation gains are uncertain; profits may go to shareholders instead of R&D.",
        ],
      },
    ],
    mistakes: [
      "Saying a monopoly can set both price and quantity.",
      "Treating every large firm as a monopoly.",
      "Ignoring regulation and contestability in evaluation.",
    ],
    practice: [
      { marks: 2, question: "The four largest supermarkets have shares of 27%, 15%, 13% and 12%. Calculate the 4-firm concentration ratio.", answer: "27 + 15 + 13 + 12 = 67%." },
      { marks: 4, question: "Explain two barriers to entry in the market for mobile phone networks." },
      { marks: 25, question: "Evaluate whether the government should break up firms with high market share." },
    ],
  },
  {
    topicId: "econ-externalities",
    summary: [
      "An externality is a cost or benefit to a third party that isn't reflected in the market price.",
      "Social cost = private cost + external cost (MSC = MPC + MEC). Social benefit = private benefit + external benefit (MSB = MPB + MEB).",
      "Negative production externality (pollution): MSC is above MPC, so the free market over-produces at Qm instead of the social optimum Q*.",
      "Positive consumption externality (vaccines, education): MSB is above MPB, so the market under-consumes.",
      "The welfare loss triangle sits between the social curves, from Q* to the market quantity, and points towards the social optimum.",
      "Merit goods are under-consumed because of positive externalities and/or information gaps (people underestimate the private benefit). Demerit goods are over-consumed for the opposite reasons.",
      "Calling something a merit or demerit good involves a value judgement.",
      "Policy menu: indirect tax, subsidy, regulation, tradable permits, information provision, state provision, property rights.",
    ],
    definitions: [
      { term: "Externality", definition: "A spillover cost or benefit to a third party not involved in the transaction." },
      { term: "Marginal social cost", definition: "Marginal private cost plus marginal external cost." },
      { term: "Merit good", definition: "A good that is under-consumed in a free market, because of positive externalities and/or information failure." },
      { term: "Demerit good", definition: "A good that is over-consumed in a free market, because of negative externalities and/or information failure." },
      { term: "Social optimum", definition: "The output where MSC = MSB, which maximises social welfare." },
    ],
    diagrams: [
      {
        name: "Negative production externality",
        checklist: [
          "Axes: Costs/benefits and Quantity",
          "MPC (= supply) and MSC above it; vertical gap = MEC",
          "MPB = MSB (= demand)",
          "Market output Qm where MPC = MPB; social optimum Q* where MSC = MSB",
          "Welfare loss triangle between MSC and MSB from Q* to Qm, pointing at Q*",
        ],
      },
      {
        name: "Positive consumption externality",
        checklist: [
          "MPB below MSB; MPC = MSC",
          "Market consumption Qm below the optimum Q*",
          "Welfare loss triangle between MSB and MSC from Qm to Q*, pointing at Q*",
        ],
      },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate whether an indirect tax is the best way to reduce the negative externalities from single-use plastic packaging.",
        structure: [
          "Intro: define negative production externality and explain why plastic is over-produced.",
          "Tax analysis: a Pigouvian tax equal to the MEC shifts MPC up to MSC and moves output to Q*. Diagram.",
          "Problem 1: measuring the MEC is hard, so the tax may be set too high or too low.",
          "Alternatives: regulation (bans), tradable permits, deposit-return schemes, information campaigns. Compare cost and certainty.",
          "Conclusion: a tax works best when the MEC can be estimated and demand is not too inelastic; otherwise combine it with regulation.",
        ],
        evaluation: [
          "If demand is price inelastic, quantity falls only a little.",
          "Taxes can be regressive, hitting low-income households hardest.",
          "Revenue can be hypothecated to clean-up or recycling.",
          "Firms may relocate production abroad, so the pollution moves rather than falls.",
          "The 5p (later 10p) carrier bag charge in England sharply cut bag use, which shows small price signals can work when substitutes exist.",
        ],
      },
      {
        marks: 9,
        label: "Analyse (9)",
        question: "Using a diagram, analyse why the free market leads to under-consumption of vaccinations.",
        structure: [
          "Private benefit vs the external benefit to others (herd immunity).",
          "Diagram: MPB below MSB; market output below the optimum; welfare loss.",
          "Information gap: people underestimate their own benefit, adding to under-consumption.",
        ],
        evaluation: ["Not rewarded at 9 marks."],
      },
    ],
    mistakes: [
      "Placing the welfare loss triangle on the wrong side of the market output.",
      "Calling merit goods public goods.",
      "Forgetting the information-failure part of the merit/demerit definition.",
    ],
    practice: [
      { marks: 2, question: "Define a merit good." },
      { marks: 4, question: "Explain, using a diagram, why the free market over-produces electricity from coal." },
      { marks: 25, question: "Evaluate the case for subsidising public transport to reduce road congestion." },
    ],
  },
  {
    topicId: "econ-public-goods-info",
    summary: [
      "Public goods are non-rival (one person's use doesn't reduce another's) and non-excludable (non-payers can't be stopped).",
      "Non-excludability creates the free-rider problem, so firms can't charge and the market may not exist at all. That is complete market failure.",
      "Examples: national defence, street lighting, flood defences. Quasi-public goods have some of the features (roads can be congested or tolled).",
      "Technology can change a good's status: toll roads and paywalls make goods excludable.",
      "Private goods are rival and excludable. The NHS is not a public good; it is a merit good provided free.",
      "Information gaps and asymmetric information (one side knows more) cause misallocation: second-hand cars, insurance, pensions, healthcare.",
      "Other imperfections: monopoly power and immobility of labour (geographical and occupational).",
      "Partial market failure means the market exists but gives the wrong quantity (externalities, merit goods).",
    ],
    definitions: [
      { term: "Public good", definition: "A good that is non-rival and non-excludable." },
      { term: "Non-rivalry", definition: "One person's consumption doesn't reduce the amount available to others." },
      { term: "Non-excludability", definition: "It is impossible or very costly to stop non-payers from consuming the good." },
      { term: "Free-rider problem", definition: "People benefit without paying, so the good is not provided by the market." },
      { term: "Asymmetric information", definition: "One party to a transaction has more or better information than the other." },
      { term: "Complete market failure", definition: "The market fails to provide a good at all, creating a missing market." },
    ],
    essays: [
      {
        marks: 15,
        label: "Explain (15)",
        question: "Explain why a free market may fail to provide public goods and why information gaps can lead to a misallocation of resources.",
        structure: [
          "Public goods: non-excludability → free riding → no revenue → missing market. Use street lighting as the worked example.",
          "Non-rivalry: the marginal cost of an extra user is zero, so charging would cut use below the efficient level.",
          "Information gaps: buyers of used cars can't judge quality, so they pay less, good sellers leave, and the market shrinks.",
        ],
        evaluation: ["Not needed at 15 marks. Depth and examples score."],
      },
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate whether the government should provide all public goods.",
        structure: [
          "Case for: free riding means no private provision. Government can fund it from taxation.",
          "Problem: with no price signal, the government struggles to know how much to provide (information gap).",
          "Alternatives: private provision of quasi-public goods with technology (toll roads), contracting out, sponsorship.",
          "Conclusion: pure public goods need state funding, but not necessarily state production.",
        ],
        evaluation: [
          "Opportunity cost of tax revenue.",
          "Public choice theory: provision may follow political rather than economic logic.",
          "Some \"public goods\" become excludable over time.",
        ],
      },
    ],
    mistakes: [
      "Saying a public good is any good the government provides.",
      "Mixing up public goods and goods with positive externalities.",
      "Not explaining why free riding stops provision.",
    ],
    practice: [
      { marks: 2, question: "Define a quasi-public good." },
      { marks: 4, question: "Explain why flood defences are likely to be under-provided by the free market." },
      { marks: 9, question: "Analyse how asymmetric information can cause market failure in the market for pensions." },
    ],
  },
  {
    topicId: "econ-gov-intervention",
    summary: [
      "Indirect taxes raise price and internalise external costs. Their effect on quantity depends on PED, and they raise revenue.",
      "Subsidies lower costs and price to raise consumption of merit goods, at an opportunity cost to the government. Firms may become dependent.",
      "A maximum price set below equilibrium creates excess demand, so expect shortages, queues and black markets (rent controls).",
      "A minimum price set above equilibrium creates excess supply (minimum unit pricing for alcohol, guaranteed farm prices).",
      "Regulation (bans, limits, standards) is direct and certain but needs monitoring and enforcement, and can push activity underground.",
      "State provision gives public and merit goods free at the point of use, funded by taxation.",
      "Tradable pollution permits cap total pollution and let the market find the cheapest cuts. Success depends on setting the cap right.",
      "Information provision (labels, campaigns) tackles information gaps cheaply, but the effect can be small.",
      "Judge every policy on effectiveness, cost, unintended consequences, fairness and time.",
    ],
    definitions: [
      { term: "Maximum price", definition: "A legal price ceiling set below the equilibrium price." },
      { term: "Minimum price", definition: "A legal price floor set above the equilibrium price." },
      { term: "Regulation", definition: "Rules backed by law that limit or require certain behaviour." },
      { term: "Tradable pollution permit", definition: "A permit to emit a set amount of pollution that can be bought and sold." },
      { term: "Pigouvian tax", definition: "A tax set equal to the marginal external cost to correct a negative externality." },
    ],
    diagrams: [
      {
        name: "Maximum price",
        checklist: ["Price ceiling drawn below equilibrium", "Qs and Qd at the ceiling", "Excess demand (shortage) labelled"],
      },
      {
        name: "Minimum price",
        checklist: ["Price floor drawn above equilibrium", "Qd and Qs at the floor", "Excess supply labelled; who buys the surplus?"],
      },
      {
        name: "Subsidy for a merit good",
        checklist: ["MPB below MSB", "Supply shifts down by the subsidy until output reaches Q*", "Cost to government rectangle"],
      },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate whether a minimum unit price is the best way to reduce alcohol consumption.",
        structure: [
          "Intro: alcohol as a demerit good with negative consumption externalities.",
          "Minimum price analysis: floor above equilibrium raises the price of the cheapest, strongest drinks most. Diagram.",
          "Targeting: heavy drinkers buy cheap alcohol, so the policy targets the harm. Scotland introduced 50p per unit in 2018 and later raised it.",
          "Compare with an indirect tax (raises revenue, hits all drinkers) and with information campaigns or regulation of sale hours.",
          "Conclusion: depends on PED of heavy drinkers, cross-border shopping and whether the revenue stays with retailers.",
        ],
        evaluation: [
          "With a minimum price the extra money goes to retailers, not the government.",
          "Demand from dependent drinkers is very inelastic, so consumption may fall little.",
          "Regressive: low-income moderate drinkers pay more.",
          "Possible substitution to illegal or cross-border alcohol.",
        ],
      },
    ],
    mistakes: [
      "Drawing a maximum price above equilibrium (it would have no effect).",
      "Forgetting black markets and unintended consequences.",
      "Analysing one policy without comparing it to any alternative.",
    ],
    practice: [
      { marks: 4, question: "Explain, using a diagram, why rent controls may lead to a shortage of rented housing." },
      { marks: 9, question: "Analyse how tradable pollution permits can reduce carbon emissions at the lowest cost." },
      { marks: 25, question: "Evaluate the view that regulation is more effective than taxation in correcting market failure." },
    ],
  },
  {
    topicId: "econ-gov-failure",
    summary: [
      "Government failure is when intervention causes a net welfare loss: resources end up worse allocated than before.",
      "Causes: information gaps (the external cost can't be measured), unintended consequences, distorted price signals, administrative costs, conflicting objectives.",
      "Political self-interest and short-termism (public choice theory) can steer policy towards votes rather than welfare.",
      "Regulatory capture: the regulator ends up serving the firms it regulates.",
      "Classic examples: EU farm price floors that created surpluses (\"butter mountains\"), rent controls that reduced the supply and quality of rented housing, fly-tipping after landfill charges.",
      "In a 25-marker, use it as evaluation: \"However, this may lead to government failure because …, for example …, especially if …\".",
    ],
    definitions: [
      { term: "Government failure", definition: "When government intervention leads to a net welfare loss compared with the free market outcome." },
      { term: "Unintended consequence", definition: "An unplanned and often undesirable result of a policy." },
      { term: "Regulatory capture", definition: "When a regulator acts in the interests of the industry it regulates rather than the public." },
      { term: "Public choice theory", definition: "The view that politicians and officials act in their own interest, such as winning votes." },
    ],
    essays: [
      {
        marks: 25,
        label: "Evaluate (25)",
        question: "Evaluate the view that government intervention to correct market failure often makes things worse.",
        structure: [
          "Intro: define market failure and government failure.",
          "Point 1: information gaps mean taxes and subsidies are set at the wrong level. Diagram showing a tax that overshoots Q*.",
          "Point 2: unintended consequences, with a real example (rent controls, black markets).",
          "Point 3: successes, such as the plastic bag charge or smoking ban, where intervention clearly improved outcomes.",
          "Conclusion: failure is more likely when information is poor and incentives to evade are strong; well-designed, reviewed policy can work.",
        ],
        evaluation: [
          "Compare the size of the market failure with the risk of government failure.",
          "Policies can be adjusted over time, which reduces lasting failure.",
          "Some failures come from poor design, not intervention as such.",
        ],
      },
    ],
    mistakes: [
      "Calling any policy weakness \"government failure\". It needs a net welfare loss.",
      "Giving no real-world example.",
    ],
    practice: [
      { marks: 2, question: "Define government failure." },
      { marks: 4, question: "Explain one way in which a subsidy could lead to government failure." },
      { marks: 15, question: "Explain why governments may lack the information needed to correct market failures." },
    ],
  },
];
