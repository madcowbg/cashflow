import * as _ from "lodash";

export interface MarketParams {
  currentDividendYield: number;
  realDividendGrowth: number;
  inflation: number;
}

export interface Security {
  time: number;
  currentPrice: number;
  currentAnnualDividends: number;
}

export interface Position {
  numberOfShares: number;
}

export interface Statistics {
  pv: number;
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

export function dividendGrowth(economy: MarketParams) {
  return economy.realDividendGrowth + economy.inflation;
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
) {
  const { totalDividends, totalBought, totalSold } = aggregated(transactions);
  return {
    pv: investment.numberOfShares * futurePrice,
    paidDividends: totalDividends - totalBought + totalSold,
    reinvestedDividends: totalBought - totalSold,
  };
}

export function noReinvestmentStrategy(
  futurePrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;
  const obj = {
    time: vehicle.time,
    investment: { numberOfShares: investment.numberOfShares },
    transactions: [{ dividend: dividends }],
  };
  return _.assign(obj, {
    statistics: calculateStatistics(
      futurePrice,
      obj.investment,
      obj.transactions
    ),
  });
}

export function fullReinvestmentStrategy(
  futurePrice: number,
  vehicle: Security,
  investment: Position
): Outcome {
  const dividends =
    (investment.numberOfShares * vehicle.currentAnnualDividends) / 12;

  const boughtShares = dividends / futurePrice;
  const futureShares = investment.numberOfShares + boughtShares;
  return {
    time: vehicle.time,
    investment: { numberOfShares: futureShares },
    transactions: [
      { bought: boughtShares, cost: dividends },
      { dividend: dividends },
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

export function investOneMoreTime(
  economy: MarketParams,
  vehicle: Security,
  investment: Position,
  strategy: (
    futurePrice: number,
    vehicle: Security,
    investment: Position
  ) => Outcome
): { outcome: Outcome; statistics: Statistics; evolvedVehicle: Security } {
  const futurePrice = priceViaGordonEquation(
    vehicle.currentAnnualDividends,
    marketReturn(economy),
    dividendGrowth(economy)
  );
  const outcome = strategy(futurePrice, vehicle, investment);
  return {
    outcome: outcome,
    statistics: calculateStatistics(
      futurePrice,
      outcome.investment,
      outcome.transactions
    ),
    evolvedVehicle: {
      time: vehicle.time + 1,
      currentPrice: futurePrice,
      currentAnnualDividends:
        vehicle.currentAnnualDividends * (1 + dividendGrowth(economy) / 12),
    },
  };
}

export function marketReturn(params: MarketParams) {
  return (
    params.currentDividendYield + params.realDividendGrowth + params.inflation
  );
}
