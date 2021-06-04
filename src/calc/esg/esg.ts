import * as _ from "lodash";
import {
  Random,
  random_mean_reverting,
  rmap,
  white_noise,
} from "../random_processes";
import { count, fmap, Process, stateful } from "../processes";

export interface MarketParams {
  inflation: number; // %
}

export interface InvestmentParams {
  currentDividendYield: number; // %
  realDividendGrowth: number; // %
}

export interface Security {
  currentAnnualDividends: number; // $
  realDividendGrowth: number; // %
}

export interface Position {
  numberOfShares: number; // #
}

export interface Statistics {
  numberOfShares: number;
  fv: number;
  totalDividends: number;
  totalBoughtDollar: number;
  totalBoughtNumShares: number;
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
    numberOfShares: investment.numberOfShares,
    fv: investment.numberOfShares * futurePrice,
    totalDividends: agg.totalDividends,
    totalBoughtDollar: agg.totalBoughtDollar - agg.totalSoldDollar,
    totalBoughtNumShares: agg.totalBoughtNumShares - agg.totalSoldNumShares,
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
  initialVehicle: Security,
  sentiment: Process<MarketSentiment>,
  realizedDividendRatio: Process<number>,
  T: number
): Process<SecurityAtTime> {
  type State = { time: number; security: Security };
  const evolvingState = stateful(
    (state: State, realizedDividendRatio: number): State => ({
      time: state.time + 1,
      security: evolveSecurity(economy, state.security, realizedDividendRatio),
    })
  )({ time: T, security: initialVehicle }, realizedDividendRatio);

  return fmap(
    (state: State, s: MarketSentiment): SecurityAtTime => ({
      time: state.time,
      security: state.security,
      price: priceDDM(state.security, economy, s),
    })
  )(evolvingState, sentiment);
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

function investCashflow(
  strategyDecision: InvestmentDecision,
  savings: SavingsParams,
  securityAtTplus1: SecurityAtTime
) {
  const decision = {
    time: strategyDecision.time,
    transactions: strategyDecision.transactions.concat({
      bought: savings.monthlyInvestment / securityAtTplus1.price,
      cost: savings.monthlyInvestment,
    }),
  };
  return decision;
}

function computeInvestmentsAtTime(
  time: number,
  securityAtTplus1: SecurityAtTime,
  currentSecurity: SecurityAtTime,
  currentPosition: Position,
  currentSavings: SavingsParams,
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position,
    savings: SavingsParams
  ) => InvestmentDecision
): { futurePosition: Position; investmentOutcome: InvestmentOutcome } {
  const strategyDecision = strategy(
    time,
    securityAtTplus1.price,
    currentSecurity.security,
    currentPosition,
    currentSavings
  );

  const decision = investCashflow(
    strategyDecision,
    currentSavings,
    securityAtTplus1
  );
  const futurePosition = consolidateInvestment(currentPosition, decision);
  const investmentOutcome: InvestmentOutcome = {
    time: time,
    outcome: {
      investment: futurePosition,
      decision: decision,
    },
    statistics: calculateStatistics(
      securityAtTplus1.price,
      futurePosition,
      decision.transactions,
      currentSavings
    ),
    evolvedVehicle: securityAtTplus1.security,
  };
  return { futurePosition, investmentOutcome };
}

export function investOverTime(
  startTime: number,
  securityProcess: Process<SecurityAtTime>,
  initialInvestment: Position,
  savingsProcess: Process<SavingsParams>,
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position,
    savings: SavingsParams
  ) => InvestmentDecision
): Process<InvestmentOutcome> {
  const futureSecurityProcess = securityProcess.evolve;
  type State = {
    t: number;
    currentPosition: Position;
    outcome?: InvestmentOutcome;
  };

  const stateP = stateful(
    (
      state: State,
      currentSecurity: SecurityAtTime,
      currentSavings: SavingsParams,
      securityAtTplus1: SecurityAtTime
    ): State => {
      const { futurePosition, investmentOutcome } = computeInvestmentsAtTime(
        state.t,
        securityAtTplus1,
        currentSecurity,
        state.currentPosition,
        currentSavings,
        strategy
      );
      return {
        t: state.t + 1,
        currentPosition: futurePosition,
        outcome: investmentOutcome,
      };
    }
  )(
    { t: startTime, currentPosition: initialInvestment, outcome: undefined },
    securityProcess,
    savingsProcess,
    futureSecurityProcess
  );
  return fmap((s: State) => s.outcome)(stateP.evolve);
}

export interface MarketSentiment {
  discountRate: number;
}

export function evolveSecurity(
  economy: MarketParams,
  vehicle: Security,
  realizedDividendRatio: number
): Security {
  return {
    currentAnnualDividends:
      realizedDividendRatio *
      vehicle.currentAnnualDividends *
      (1 + dividendGrowth(vehicle, economy) / 12),
    realDividendGrowth: vehicle.realDividendGrowth,
  };
}

export function defaultRevertingSentiment(
  economy: MarketParams,
  minDiscountRate: number,
  initialSentiment: MarketSentiment
): Random<Process<MarketSentiment>> {
  const optionalDR = initialSentiment.discountRate - minDiscountRate;
  return {
    pick(seed: number) {
      const sentiment_optional_logchange = random_mean_reverting(
        0,
        0,
        0.1,
        0.8 / 12
      ).pick(seed);

      return fmap((sentiment_diff_loglevel_value: number) => ({
        discountRate:
          minDiscountRate +
          optionalDR * Math.exp(sentiment_diff_loglevel_value),
      }))(sentiment_optional_logchange);
    },
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

export function inflationAdjustedSavings(
  params: MarketParams,
  savings: SavingsParams
): Process<SavingsParams> {
  return fmap((tMonth: number) => ({
    monthlyInvestment:
      savings.monthlyInvestment * Math.pow(1 + params.inflation / 12, tMonth),
  }))(count(0));
}

function defaultRealizedDividendRatio(
  params: DividendParams
): Random<Process<number>> {
  const realizedDividendLNRatio = white_noise(
    0,
    params.realizedDividendAnnualStandardDeviation / Math.sqrt(12)
  );
  return rmap(fmap(Math.exp))(realizedDividendLNRatio);
}

export interface DividendParams {
  realizedDividendAnnualStandardDeviation: number; // as percentage of current dividend level
}

export function savingsTrajectory(
  startingPV: number,
  marketParams: MarketParams,
  investmentParams: InvestmentParams,
  dividendParams: DividendParams,
  savingsParams: SavingsParams
): {
  initialInvestmentVehicle: Security;
  investmentResult: Random<{
    sentiment: Process<MarketSentiment>;
    investments: Process<InvestmentOutcome>;
  }>;
} {
  const initialInvestmentPrice = 100;
  const initialInvestmentVehicle: Security = {
    currentAnnualDividends:
      initialInvestmentPrice * investmentParams.currentDividendYield,
    realDividendGrowth: investmentParams.realDividendGrowth,
  };

  const initialInvestment: Position = {
    numberOfShares: startingPV / initialInvestmentPrice,
  };

  const initialSentiment = impliedSentiment(
    initialInvestmentVehicle,
    100,
    marketParams
  );

  return {
    initialInvestmentVehicle,
    investmentResult: {
      pick(seed: number) {
        const sentiment = defaultRevertingSentiment(
          marketParams,
          dividendGrowth(initialInvestmentVehicle, marketParams),
          initialSentiment
        ).pick(seed);

        const savings = inflationAdjustedSavings(marketParams, savingsParams);

        const REALIZATION_DIVIDEND_RATIO_SEED = 5123;
        const realizedDividendRatio = defaultRealizedDividendRatio(
          dividendParams
        ).pick(REALIZATION_DIVIDEND_RATIO_SEED + seed);

        const securityAtTimes = evaluateSecurity(
          marketParams,
          initialInvestmentVehicle,
          sentiment,
          realizedDividendRatio,
          0
        );

        const investments: Process<InvestmentOutcome> = investOverTime(
          0,
          securityAtTimes,
          initialInvestment,
          savings,
          fullReinvestmentStrategy
        );
        return { sentiment, investments };
      },
    },
  };
}
