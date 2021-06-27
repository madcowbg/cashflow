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

export interface Allocation {
  numberOfShares: number; // #
}

export interface Statistics {
  numberOfShares: { [id: string]: number };
  fv: number;
  totalDividends: number;
  totalBoughtDollar: number;
  totalBoughtNumShares: number;
  externalCashflow: number;
}

type Transaction<I> =
  | ({ id: I } & (
      | { bought: number; cost: number }
      | { sold: number; proceeds: number }
    ))
  | { dividend: number };

export interface InvestmentDecision<I> {
  time: number;
  transactions: Transaction<I>[];
}

export interface Outcome<I extends string> {
  investment: Portfolio<I>;
  decision: InvestmentDecision<I>;
}

export function nominalDividendGrowth(
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

function aggregated<I>(transactions: Transaction<I>[]): AggregateTransaction {
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

export function calculateStatistics<I extends string>(
  futurePrice: Pricing<I>,
  investment: Portfolio<I>,
  transactions: Transaction<I>[],
  savings: SavingsParams
): Statistics {
  const agg = aggregated(transactions);
  return {
    numberOfShares: _.mapValues(investment, (pos) => pos.numberOfShares),
    fv: _.sum(_.values(pricePositions(investment, futurePrice))),
    totalDividends: agg.totalDividends,
    totalBoughtDollar: agg.totalBoughtDollar - agg.totalSoldDollar,
    totalBoughtNumShares: agg.totalBoughtNumShares - agg.totalSoldNumShares,
    externalCashflow: savings.monthlyInvestment,
  };
}

export function fullRebalancing<I extends string>(
  time: number,
  investment: Portfolio<I>,
  tPricing: Pricing<I>,
  tPlus1Pricing: Pricing<I>,
  portfolioFV: number
): Portfolio<I> {
  const currentPositionValues = pricePositions(investment, tPricing);
  const portfolioPV = _.sum(_.values(currentPositionValues));
  return _.mapValues(currentPositionValues, (cp: number, id: I): Allocation => {
    const futurePositionValue = (cp / portfolioPV) * portfolioFV;
    return {
      numberOfShares: futurePositionValue / tPlus1Pricing[id].price,
    };
  });
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
  currentPrice: number
): MarketSentiment {
  return {
    discountRate:
      currentYield(vehicle, currentPrice) + vehicle.realDividendGrowth,
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

export interface InvestmentOutcome<I extends string> {
  time: number;
  outcome: Outcome<I>;
  statistics: Statistics;
}

export interface SavingsParams {
  monthlyInvestment: number;
}

type PerSecurity<InvestmentID extends string, T> = {
  [ID in InvestmentID]: T;
};

export type Pricing<I extends string> = PerSecurity<I, SecurityAtTime>;
type Portfolio<I extends string> = PerSecurity<I, Allocation>;

type Strategy<I extends string> = (
  time: number,
  portfolio: Portfolio<I>,
  tPricing: Pricing<I>,
  tPlus1Pricing: Pricing<I>,
  fv: number
) => Portfolio<I>;

export function diff<I extends string>(
  portfolio: Portfolio<I>,
  futurePortfolio: Portfolio<I>
): Portfolio<I> {
  const allIds = _.union(_.keys(portfolio), _.keys(futurePortfolio));

  const diffPosition: Allocation[] = _.map(
    allIds,
    (id: I): Allocation => ({
      numberOfShares:
        (futurePortfolio[id]?.numberOfShares ?? 0) -
        (portfolio[id]?.numberOfShares ?? 0),
    })
  );
  return _.zipObject<Allocation>(allIds, diffPosition) as Portfolio<I>;
}

export function pricePositions<I extends string>(
  portfolio: Portfolio<I>,
  securityAtTplus1: Pricing<I>
): PerSecurity<I, number> {
  return _.mapValues(
    portfolio,
    (pos, id: I) => securityAtTplus1[id].price * pos.numberOfShares
  );
}

export function toTrades<I extends string>(
  portfolioChange: Portfolio<I>,
  pricing: Pricing<I>
): Transaction<I>[] {
  return _.values(
    _.mapValues(
      portfolioChange,
      (pos: Allocation, id: I): Transaction<I> =>
        pos.numberOfShares < 0
          ? {
              id,
              sold: pos.numberOfShares,
              proceeds: -pos.numberOfShares * pricing[id].price,
            }
          : {
              id,
              bought: pos.numberOfShares,
              cost: pos.numberOfShares * pricing[id].price,
            }
    )
  );
}

function computeInvestmentsAtTime<I extends string>(
  time: number,
  securityAtTplus1: Pricing<I>,
  securityAtT: Pricing<I>,
  portfolio: Portfolio<I>,
  currentSavings: SavingsParams,
  strategy: Strategy<I>
): { futurePortfolio: Portfolio<I>; investmentOutcome: InvestmentOutcome<I> } {
  const accruedDividendsPerPosition = _.mapValues(
    portfolio,
    (pos, id: I) =>
      pos.numberOfShares *
      (securityAtT[id].security.currentAnnualDividends / 12)
  );
  const accruedDividends = _.sum(_.values(accruedDividendsPerPosition));

  const tPlus1PortfolioPrices = pricePositions(portfolio, securityAtTplus1);
  const fv =
    accruedDividends +
    currentSavings.monthlyInvestment +
    _.sum(_.values(tPlus1PortfolioPrices));

  const futurePortfolio = strategy(
    time,
    portfolio,
    securityAtT,
    securityAtTplus1,
    fv
  );

  const trades: Transaction<I>[] = toTrades(
    diff(portfolio, futurePortfolio),
    securityAtTplus1
  );

  const decision = {
    time: time,
    transactions: trades.concat({
      dividend: accruedDividends,
    } as Transaction<I>),
  };

  const investmentOutcome: InvestmentOutcome<I> = {
    time: time,
    outcome: {
      investment: futurePortfolio,
      decision: decision,
    },
    statistics: calculateStatistics(
      securityAtTplus1,
      futurePortfolio,
      decision.transactions,
      currentSavings
    ),
  };
  return { futurePortfolio, investmentOutcome };
}

export function investOverTime<I extends string>(
  startTime: number,
  savingsProcess: Process<SavingsParams>,
  securityProcess: Process<Pricing<I>>,
  initialInvestment: Portfolio<I>,
  strategy: Strategy<I>
): Process<InvestmentOutcome<I>> {
  const futureSecurityProcess = securityProcess.evolve;
  type State = {
    t: number;
    currentPortfolio: Portfolio<I>;
    outcome?: InvestmentOutcome<I>;
  };

  const stateP = stateful(
    (
      state: State,
      currentSecurity: Pricing<I>,
      currentSavings: SavingsParams,
      securityAtTplus1: Pricing<I>
    ): State => {
      const { futurePortfolio, investmentOutcome } = computeInvestmentsAtTime(
        state.t,
        securityAtTplus1,
        currentSecurity,
        state.currentPortfolio,
        currentSavings,
        strategy
      );
      return {
        t: state.t + 1,
        currentPortfolio: futurePortfolio,
        outcome: investmentOutcome,
      };
    }
  )(
    { t: startTime, currentPortfolio: initialInvestment, outcome: undefined },
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
      Math.pow(1 + nominalDividendGrowth(vehicle, economy), 1.0 / 12),
    realDividendGrowth: vehicle.realDividendGrowth,
  };
}

export function defaultRevertingSentiment(
  economy: MarketParams,
  minDiscountRate: number,
  initialSentiment: MarketSentiment
): Random<Process<MarketSentiment>> {
  return {
    pick(seed: number) {
      const sentiment_value_above_min = random_mean_reverting(
        initialSentiment.discountRate,
        initialSentiment.discountRate,
        0.1,
        0.001304846
      ).pick(seed);

      return fmap((sentiment_value: number) => ({
        discountRate: sentiment_value,
      }))(sentiment_value_above_min);
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
    security.realDividendGrowth
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

const SENTIMENT_SEED = 0;
const REALIZATION_DIVIDEND_RATIO_SEED = 5123;

export type DummyI = "equity"; // FIXME remove!

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
    investments: Process<InvestmentOutcome<DummyI>>;
  }>;
} {
  const initialInvestmentPrice = 100;
  const initialInvestmentVehicle: Security = {
    currentAnnualDividends:
      initialInvestmentPrice * investmentParams.currentDividendYield,
    realDividendGrowth: investmentParams.realDividendGrowth,
  };

  const initialInvestment: Allocation = {
    numberOfShares: startingPV / initialInvestmentPrice,
  };

  const initialSentiment = impliedSentiment(initialInvestmentVehicle, 100);

  return {
    initialInvestmentVehicle,
    investmentResult: {
      pick(seed: number) {
        const sentiment = defaultRevertingSentiment(
          marketParams,
          initialInvestmentVehicle.realDividendGrowth,
          initialSentiment
        ).pick(SENTIMENT_SEED + seed);

        const realizedDividendRatio = defaultRealizedDividendRatio(
          dividendParams
        ).pick(REALIZATION_DIVIDEND_RATIO_SEED + seed);

        const securityAtTimes = fmap<SecurityAtTime, Pricing<DummyI>>(
          (s: SecurityAtTime) => ({ equity: s })
        )(
          evaluateSecurity(
            marketParams,
            initialInvestmentVehicle,
            sentiment,
            realizedDividendRatio,
            0
          )
        ); // fixme need multiple securities

        const savings = inflationAdjustedSavings(marketParams, savingsParams);

        const investments: Process<InvestmentOutcome<DummyI>> = investOverTime(
          0,
          savings,
          securityAtTimes,
          { equity: initialInvestment },
          fullRebalancing
        );
        return { sentiment, investments };
      },
    },
  };
}
