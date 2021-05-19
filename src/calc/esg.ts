import * as _ from "lodash";

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
  security: Security;
  price: number;
}

function calculateTrajectory(
  economy: MarketParams,
  sentiment: MarketSentiment,
  vehicle: Security,
  T: number
): SecurityAtTime[] {
  const result: SecurityAtTime[] = [];
  for (let i = 0; i < T; i++) {
    result.push({
      security: vehicle,
      price: priceDDM(vehicle, economy, sentiment),
    });
    vehicle = evolveVehicle(economy, vehicle);
  }
  return result;
}

export function investOverTime(
  economy: MarketParams,
  sentiment: MarketSentiment,
  vehicle: Security,
  T: number,
  investment: Position,
  strategy: (
    time: number,
    futurePrice: number,
    vehicle: Security,
    investment: Position
  ) => Outcome
): { outcome: Outcome; statistics: Statistics; evolvedVehicle: Security }[] {
  const vehicleTrajectory = calculateTrajectory(economy, sentiment, vehicle, T);
  const result: {
    outcome: Outcome;
    statistics: Statistics;
    evolvedVehicle: Security;
  }[] = [];
  for (let t = 0; t < T - 1; t++) {
    const futurePrice = vehicleTrajectory[t + 1].price;

    const outcome = strategy(t, futurePrice, vehicle, investment);
    investment = outcome.investment;
    vehicle = vehicleTrajectory[t + 1].security;

    result.push({
      outcome: outcome,
      statistics: calculateStatistics(
        futurePrice,
        outcome.investment,
        outcome.transactions
      ),
      evolvedVehicle: vehicle,
    });
  }
  return result;
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