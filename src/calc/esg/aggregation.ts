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

function aggregateD<I extends string>(
  ids: InvestmentDecision<I>[]
): InvestmentDecision<I> {
  return {
    time: _.last(_.map(ids, (dec) => dec.time)),
    transactions: [].concat(...ids.map((dec) => dec.transactions)),
  };
}

function aggregateO<I extends string>(outcomes: Outcome<I>[]): Outcome<I> {
  return {
    decision: aggregateD(outcomes.map((o) => o.decision)),
    investment: _.last(outcomes.map((io) => io.investment)),
  };
}

function aggregateS(statistics: Statistics[]): Statistics {
  return {
    numberOfShares: _.last(statistics).numberOfShares,
    externalCashflow: _.sum(statistics.map((s) => s.externalCashflow)),
    fv: _.last(statistics).fv,
    totalBoughtDollar: _.sum(statistics.map((s) => s.totalBoughtDollar)),
    totalDividends: _.sum(statistics.map((s) => s.totalDividends)),
    totalBoughtNumShares: _.sum(statistics.map((s) => s.totalBoughtNumShares)),
    shortfall: _.sum(statistics.map((s) => s.shortfall)),
  };
}

export function aggregateIO<I extends string>(
  ...args: InvestmentOutcome<I>[]
): InvestmentOutcome<I> {
  return {
    time: _.last(_.map(args, (io) => io.time)),
    outcome: aggregateO(args.map((io) => io.outcome)),
    statistics: aggregateS(args.map((io) => io.statistics)),
  };
}

export function investmentProcess<I extends string>(
  displayFreq: number,
  investments: Process<InvestmentOutcome<I>>,
  sentiment: Process<MarketSentiment>
): {
  sentimentOverTime: Process<MarketSentiment>;
  evolution: Process<InvestmentOutcome<I>>;
  monthsIdx: Process<number>;
} {
  const monthsIdx = sample<number>(displayFreq)(count(0));

  const evolution = aggregate<InvestmentOutcome<I>>(
    displayFreq,
    aggregateIO
  )(investments);
  const sentimentOverTime = sample<MarketSentiment>(displayFreq)(sentiment);

  return { monthsIdx, evolution, sentimentOverTime };
}
