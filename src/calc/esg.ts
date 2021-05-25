import * as _ from "lodash";
import { random_mean_reverting } from "./mean_reversion";
import { evolvingState, map, map2, Recursive } from "./processes";

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
  totalDividends: number;
  totalBoughtDollar: number;
  totalSoldDollar: number;
  externalCashflow: number;
}

type Transaction =
  | { bought: number; cost: number }
  | { sold: number; proceeds: number }
  | { dividend: number };

export interface InvestmentDecision {
  time: number;
  transactions: Transaction[];
}

export interface Outcome {
  investment: Position;
  decision: InvestmentDecision;
}

export function dividendGrowth(
  security: Security,
  economy: MarketParams
): number {
  return security.realDividendGrowth + economy.inflation;
}

type AggregateTransaction = {
  totalDividends: number;
  totalBoughtDollar: number;
  totalBoughtNumShares: number;
  totalSoldDollar: number;
  totalSoldNumShares: number;
};

function aggregated(transactions: Transaction[]): AggregateTransaction {
  return _.reduce(
    transactions,
    (a: AggregateTransaction, b: any) => ({
      totalDividends: a.totalDividends + (b.dividend ?? 0),
      totalBoughtDollar: a.totalBoughtDollar + ((b.bought && b.cost) ?? 0),
      totalBoughtNumShares: a.totalBoughtNumShares + (b.bought ?? 0),
      totalSoldDollar: a.totalSoldDollar + ((b.sold && b.proceeds) ?? 0),
      totalSoldNumShares: a.totalSoldNumShares + (b.sold ?? 0),
    }),
    {
      totalDividends: 0,
      totalBoughtDollar: 0,
      totalBoughtNumShares: 0,
      totalSoldDollar: 0,
      totalSoldNumShares: 0,
    }
  );
}

export function calculateStatistics(
  futurePrice: number,
  investment: Position,
  transactions: Transaction[],
  savings: SavingsParams
): Statistics {
  const agg = aggregated(transactions);
  return {
    fv: investment.numberOfShares * futurePrice,
    totalDividends: agg.totalDividends,
    totalBoughtDollar: agg.totalBoughtDollar,
    totalSoldDollar: agg.totalSoldDollar,
    externalCashflow: savings.monthlyInvestment,
  };
}

export function noReinvestmentStrategy(
  time: number,
  reinvestmentPrice: number,
  vehicle: Security,
  investment: Position
): InvestmentDecision {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  return {
    time: time,
    transactions: [{ dividend: dividends }],
  };
}

export function fullReinvestmentStrategy(
  time: number,
  reinvestmentPrice: number,
  vehicle: Security,
  investment: Position
): InvestmentDecision {
  const accruedDividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;

  const reinvestmentBoughtShares = accruedDividends / reinvestmentPrice;
  return {
    time: time,
    transactions: [
      { bought: reinvestmentBoughtShares, cost: accruedDividends },
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
}

export function evaluateSecurity(
  economy: MarketParams,
  sentiment: Recursive<MarketSentiment>,
  vehicle: Security,
  T: number
): Recursive<SecurityAtTime> {
  const evolvingVehicle = evolvingState<
    { t: number; v: Security },
    Security,
    undefined
  >(
    (state) => state.v,
    (state: { t: number; v: Security }) => ({
      t: state.t + 1,
      v: evolveVehicle(economy, state.v),
    }),
    { t: 0, v: vehicle }
  );

  return map2(
    (currentTime, v: Security, s: MarketSentiment) => ({
      time: currentTime,
      security: v,
      price: priceDDM(v, economy, s),
    }),
    (t) => t + 1,
    T,
    evolvingVehicle,
    sentiment
  );
}

export interface InvestmentOutcome {
  time: number;
  outcome: Outcome;
  statistics: Statistics;
  evolvedVehicle: Security;
}

export function consolidateInvestment(
  investment: Position,
  decision: InvestmentDecision
): Position {
  const agg = aggregated(decision.transactions);
  return {
    numberOfShares:
      investment.numberOfShares +
      agg.totalBoughtNumShares -
      agg.totalSoldNumShares,
  };
}

export interface SavingsParams {
  monthlyInvestment: number;
}

export function investCashflow(
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position
  ) => InvestmentDecision
): (
  time: number,
  futurePrice: number,
  vehicle: Security,
  investment: Position,
  savings: SavingsParams
) => InvestmentDecision {
  return (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position,
    savings: SavingsParams
  ) => {
    const strategyDecision = strategy(time, futurePrice, vehicle, investment);
    return {
      time: strategyDecision.time,
      transactions: strategyDecision.transactions.concat({
        bought: savings.monthlyInvestment / futurePrice,
        cost: savings.monthlyInvestment,
      }),
    };
  };
}

export function investOverTime(
  time: number,
  securityNow: Recursive<SecurityAtTime>,
  investment: Position,
  savings: Recursive<SavingsParams>,
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position,
    savings: SavingsParams
  ) => InvestmentDecision
): Recursive<InvestmentOutcome> {
  const futureSecurity = securityNow.next();

  const securityAtTplus1 = futureSecurity.current;
  const decision = strategy(
    time,
    securityAtTplus1.price,
    securityNow.current.security,
    investment,
    savings.current
  );
  const futureInvestment = consolidateInvestment(investment, decision);
  return {
    current: {
      time: time,
      outcome: {
        investment: futureInvestment,
        decision: decision,
      },
      statistics: calculateStatistics(
        securityAtTplus1.price,
        futureInvestment,
        decision.transactions,
        savings.current
      ),
      evolvedVehicle: securityAtTplus1.security,
    },
    next: () =>
      investOverTime(
        time + 1,
        futureSecurity,
        futureInvestment,
        savings.next(),
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

export function revertingSentiment(
  economy: MarketParams,
  security: Security,
  sentiment: MarketSentiment
): Recursive<MarketSentiment> {
  const minDiscountRate = dividendGrowth(security, economy);
  const optionalDR = sentiment.discountRate - minDiscountRate;
  const sentiment_optional_logchange = random_mean_reverting(
    0,
    0,
    0.1,
    0.8 / 12,
    1251253
  );

  return map(
    (time, sentiment_diff_loglevel_value: number) => ({
      discountRate:
        minDiscountRate + optionalDR * Math.exp(sentiment_diff_loglevel_value),
    }),
    0,
    sentiment_optional_logchange
  );
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

export function inflationAdjustedSavings(
  params: MarketParams,
  savings: SavingsParams
): Recursive<SavingsParams> {
  return map(
    (tMonth) => ({
      monthlyInvestment:
        savings.monthlyInvestment * Math.pow(1 + params.inflation / 12, tMonth),
    }),
    0
  );
}
