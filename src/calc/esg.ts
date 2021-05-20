import * as _ from "lodash";
import { random_discrete_bridge } from "./brownian_bridge";

export interface MarketParams {
  inflation: number; // %
}

export interface Security {
  currentAnnualDividends: number; // $
  realDividendGrowth: number; // %
}

export interface Position {
  numberOfShares: number; // #
}

export interface Statistics {
  fv: number;
  paidDividends: number;
  reinvestedDividends: number;
}

type Transaction =
  | { bought: number; cost: number }
  | { sold: number; proceeds: number }
  | { dividend: number };

export interface Outcome {
  time: number;
  investment: Position;
  transactions: Transaction[];
}

export function dividendGrowth(
  security: Security,
  economy: MarketParams
): number {
  return security.realDividendGrowth + economy.inflation;
}

function aggregated(transactions: Transaction[]): {
  totalDividends: number;
  totalBought: number;
  totalSold: number;
} {
  const { totalDividends, totalBought, totalSold } = _.reduce(
    transactions,
    (a: { totalDividends: 0; totalBought: 0; totalSold: 0 }, b: any) => ({
      totalDividends: a.totalDividends + (b.dividend || 0),
      totalBought: a.totalBought + ((b.bought && b.cost) || 0),
      totalSold: a.totalSold + ((b.sold && b.proceeds) || 0),
    }),
    { totalDividends: 0, totalBought: 0, totalSold: 0 }
  );
  return { totalDividends, totalBought, totalSold };
}

export function calculateStatistics(
  futurePrice: number,
  investment: Position,
  transactions: Transaction[]
): Statistics {
  const { totalDividends, totalBought, totalSold } = aggregated(transactions);
  return {
    fv: investment.numberOfShares * futurePrice,
    paidDividends: totalDividends - totalBought + totalSold,
    reinvestedDividends: totalBought - totalSold,
  };
}

export function noReinvestmentStrategy(
  time: number,
  reinvestmentPrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  return {
    time: time,
    investment: { numberOfShares: investment.numberOfShares },
    transactions: [{ dividend: dividends }],
  };
}

export function fullReinvestmentStrategy(
  time: number,
  reinvestmentPrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const accruedDividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;

  const boughtShares = accruedDividends / reinvestmentPrice;
  const futureShares = investment.numberOfShares + boughtShares;
  return {
    time: time,
    investment: { numberOfShares: futureShares },
    transactions: [
      { bought: boughtShares, cost: accruedDividends },
      { dividend: accruedDividends },
    ],
  };
}

/**
 * https://www.investopedia.com/terms/g/gordongrowthmodel.asp
 * @param annualDividends
 * @param discountRate
 * @param dividendGrowth
 */
function priceViaGordonEquation(
  annualDividends: number,
  discountRate: number,
  dividendGrowth: number
): number {
  return discountRate < dividendGrowth
    ? Number.POSITIVE_INFINITY
    : annualDividends / (discountRate - dividendGrowth);
}

export function currentYield(vehicle: Security, currentPrice: number) {
  return vehicle.currentAnnualDividends / currentPrice;
}

export function impliedSentiment(
  vehicle: Security,
  currentPrice: number,
  economy: MarketParams
): MarketSentiment {
  return {
    discountRate:
      currentYield(vehicle, currentPrice) +
      vehicle.realDividendGrowth +
      economy.inflation,
  };
}

export interface SecurityAtTime {
  time: number;
  security: Security;
  price: number;
  next: () => SecurityAtTime;
}

function evaluateSecurity(
  economy: MarketParams,
  sentiment: MarketSentimentEvolition,
  vehicle: Security,
  T: number
): SecurityAtTime {
  return {
    time: T,
    security: vehicle,
    price: priceDDM(vehicle, economy, sentiment.current),
    next: () =>
      evaluateSecurity(
        economy,
        sentiment.next(),
        evolveVehicle(economy, vehicle),
        T + 1
      ),
  };
}

export interface InvestmentOutcome {
  time: number;
  outcome: Outcome;
  statistics: Statistics;
  evolvedVehicle: Security;
  next: () => InvestmentOutcome;
}

export interface MarketSentimentEvolition {
  current: MarketSentiment;
  next: () => MarketSentimentEvolition;
}

export function unchangingSentiment(sentiment: MarketSentiment) {
  const unchangingSentiment: MarketSentimentEvolition = {
    current: sentiment,
    next: () => unchangingSentiment,
  };
  return unchangingSentiment;
}

export function investOverTime(
  economy: MarketParams,
  sentiment: MarketSentimentEvolition,
  vehicle: Security,
  time: number,
  investment: Position,
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position
  ) => Outcome
): InvestmentOutcome {
  const securityNow = evaluateSecurity(economy, sentiment, vehicle, time);

  const securityAtTplus1 = securityNow.next();
  const outcome = strategy(time, securityAtTplus1.price, vehicle, investment);
  return {
    time: time,
    outcome: outcome,
    statistics: calculateStatistics(
      securityAtTplus1.price,
      outcome.investment,
      outcome.transactions
    ),
    evolvedVehicle: securityAtTplus1.security,
    next: () =>
      investOverTime(
        economy,
        sentiment.next(),
        securityAtTplus1.security,
        time + 1,
        outcome.investment,
        strategy
      ),
  };
}

export interface MarketSentiment {
  discountRate: number;
}

export function evolveVehicle(
  economy: MarketParams,
  vehicle: Security
): Security {
  return {
    currentAnnualDividends:
      vehicle.currentAnnualDividends *
      (1 + dividendGrowth(vehicle, economy) / 12),
    realDividendGrowth: vehicle.realDividendGrowth,
  };
}

export function priceDDM(
  security: Security,
  economy: MarketParams,
  sentiment: MarketSentiment
): number {
  return priceViaGordonEquation(
    security.currentAnnualDividends,
    sentiment.discountRate,
    dividendGrowth(security, economy)
  );
}

export function revertingSentiment(
  sentiment: MarketSentiment,
  MAX_TIME: number
): MarketSentimentEvolition {
  const sentiment_logchange = random_discrete_bridge(
    MAX_TIME,
    0,
    0,
    0.1 / 12,
    1251253
  );
  const sentiments = _.map(sentiment_logchange, (v) => ({
    discountRate: sentiment.discountRate * Math.exp(v),
  }));

  function atTime(t: number): MarketSentimentEvolition {
    return {
      current: sentiments[Math.min(t, sentiments.length - 1)],
      next: () => atTime(t + 1),
    };
  }

  return atTime(0);
}
