import _ from "lodash";
import { aggregate, count, fmap, Process, sample } from "../processes";
import {
  InvestmentDecision,
  InvestmentOutcome,
  MarketParams,
  MarketSentiment,
  Outcome,
  Statistics,
} from "./esg";

function aggregateD(ids: InvestmentDecision[]): InvestmentDecision {
  return {
    time: _.last(_.map(ids, (dec) => dec.time)),
    transactions: [].concat(...ids.map((dec) => dec.transactions)),
  };
}

function aggregateO(outcomes: Outcome[]): Outcome {
  return {
    decision: aggregateD(outcomes.map((o) => o.decision)),
    investment: _.last(outcomes.map((io) => io.investment)),
  };
}

function aggregateS(statistics: Statistics[]): Statistics {
  return {
    externalCashflow: _.sum(statistics.map((s) => s.externalCashflow)),
    fv: _.last(statistics.map((s) => s.fv)),
    totalBoughtDollar: _.sum(statistics.map((s) => s.totalBoughtDollar)),
    totalDividends: _.sum(statistics.map((s) => s.totalDividends)),
    totalSoldDollar: _.sum(statistics.map((s) => s.totalSoldDollar)),
  };
}

function aggregateIO(...args: InvestmentOutcome[]): InvestmentOutcome {
  return {
    time: _.last(_.map(args, (io) => io.time)),
    outcome: aggregateO(args.map((io) => io.outcome)),
    statistics: aggregateS(args.map((io) => io.statistics)),
    evolvedVehicle: _.last(_.map(args, (io) => io.evolvedVehicle)),
  };
}

export function investmentProcess(
  displayFreq: number,
  investments: Process<InvestmentOutcome>,
  sentiment: Process<MarketSentiment>,
  marketParams: MarketParams
): {
  sentimentOverTime: Process<MarketSentiment>;
  evolution: Process<InvestmentOutcome>;
  cpi: Process<number>;
  monthsIdx: Process<number>;
} {
  const monthsIdx = sample<number>(displayFreq)(count(0));

  const evolution = aggregate<InvestmentOutcome>(
    displayFreq,
    aggregateIO
  )(investments);
  const sentimentOverTime = sample<MarketSentiment>(displayFreq)(sentiment);
  const monthlyCPI = fmap((i: number) =>
    Math.pow(1 + marketParams.inflation / 12, i)
  )(count(0));

  const cpi = sample<number>(displayFreq)(monthlyCPI);
  return { monthsIdx, evolution, sentimentOverTime, cpi };
}
