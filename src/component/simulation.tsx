import _ from "lodash";
import * as React from "react";
import { Line } from "react-chartjs-2";

import { EconometricInputComponent, EconomicParams } from "../calc/econometric";
import {
  currentYield,
  evaluateSecurity,
  fullReinvestmentStrategy,
  impliedSentiment,
  inflationAdjustedSavings,
  InvestmentDecision,
  InvestmentOutcome,
  investOverTime,
  MarketSentiment,
  Outcome,
  Position,
  revertingSentiment,
  SavingsParams,
  Security,
  Statistics,
} from "../calc/esg";
import { ChartDataSets } from "chart.js";
import { SavingsParametersInput } from "./savings_input";
import { aggregate, count, fmap, sample, take } from "../calc/processes";

class ESGProps {
  params: EconomicParams;
  savings: SavingsParams;
}

class ESGState {
  readonly params: EconomicParams;
  readonly startingPV: number;
  readonly savings: SavingsParams;
  readonly displayFreq: number;
  readonly displayPeriodYears: number;
}

function theoreticInvestmentValue(
  initialValue: number,
  params: EconomicParams,
  security: Security,
  initialPrice: number,
  monthsIdx: number[]
): number[] {
  const expectedMarketReturn =
    currentYield(security, initialPrice) +
    security.realDividendGrowth +
    params.inflation;
  return _.map(
    monthsIdx,
    (i) => initialValue * Math.pow(1 + expectedMarketReturn / 12, i + 1)
  );
}

function fromParams(
  params: EconomicParams,
  numberOfShares: number,
  initialInvestmentPrice: number
): {
  initialInvestment: Position;
  initialInvestmentVehicle: Security;
} {
  return {
    initialInvestment: { numberOfShares },
    initialInvestmentVehicle: {
      currentAnnualDividends:
        initialInvestmentPrice * params.currentDividendYield,
      realDividendGrowth: params.realDividendGrowth,
    },
  };
}

function adjustForInflation(cpi: number[]): (vals: number[]) => number[] {
  return (vals: number[]): number[] => {
    if (cpi.length != vals.length) {
      throw new Error(
        `can't adjust for inflation, cpi size ${cpi.length} != vals size ${vals.length}`
      );
    }
    return _.map(vals, (val: number, i: number): number => val / cpi[i]);
  };
}

function formatFloat(precision: number): (vals: number[]) => number[] {
  const size = Math.pow(10, precision);
  return (vals) => _.map(vals, (val) => Math.round(val * size) / size);
}

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

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  constructor(props: ESGProps) {
    super(props);
    this.state = {
      params: props.params,
      startingPV: 250000,
      savings: props.savings,
      displayFreq: 1,
      displayPeriodYears: 20,
    };
  }
  readonly formatDollar = formatFloat(1);
  readonly formatPercent = formatFloat(3);

  private onParamsChange(params: EconomicParams) {
    console.log(`changed params: ${JSON.stringify(params)}`);
    this.setState({ params: params });
  }

  private onChangeStartingPV(startingPV: number): void {
    this.setState({ startingPV: startingPV });
  }

  private onSavingsChange(data: SavingsParams): void {
    this.setState({ savings: data });
  }

  render() {
    const {
      investmentOverTime,
      investmentVehicleOverTime,
      outcomeOverTime,
      statisticsOverTime,
      initialSecurity,
      monthsIdx,
      sentimentOverTime,
      adjustForInflation,
    } = this.calculateInvestmentDatasets();

    const summaryDatasets: ChartDataSets[] = [
      {
        label: "Theoretic Fully Rebalanced Investment Value ($)",
        data: this.formatDollar(
          adjustForInflation(
            theoreticInvestmentValue(
              this.state.startingPV,
              this.state.params,
              initialSecurity,
              100,
              monthsIdx
            )
          )
        ),
        yAxisID: "$",
      },
      {
        label: "Investment Current Market Price ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.fv))
        ),
        yAxisID: "$",
      },
      {
        label: "Dividends ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.totalDividends))
        ),
        yAxisID: "$ small",
      },
      {
        label: "Total Bought ($)",
        data: this.formatDollar(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.totalBoughtDollar)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Total Sold ($)",
        data: this.formatDollar(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.totalSoldDollar)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Cashflow ($)",
        data: this.formatDollar(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.externalCashflow)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Realized Dividend Yield (%)",
        data: this.formatPercent(
          _.map(
            statisticsOverTime,
            (s) =>
              ((s.totalDividends * 12) / this.state.displayFreq / s.fv) * 100
          )
        ),
        yAxisID: "%",
      },
    ];

    const sentimentDatasets = [
      {
        label: "Realized Dividend Yield (%)",
        data: this.formatPercent(
          _.map(
            statisticsOverTime,
            (s) =>
              ((s.totalDividends * 12) / this.state.displayFreq / s.fv) * 100
          )
        ),
        yAxisID: "%",
      },
      {
        label: "Discount Rate (%)",
        data: this.formatPercent(
          _.map(sentimentOverTime, (s) => s.discountRate * 100)
        ),
        yAxisID: "%",
      },
      {
        label: "Cashflow ($)",
        data: this.formatPercent(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.externalCashflow)
          )
        ),
        yAxisID: "$",
      },
    ];

    return (
      <div>
        <p>
          Initial investment size:{" "}
          <input
            type="number"
            value={this.state.startingPV}
            onChange={(e) =>
              this.onChangeStartingPV(parseFloat(e.target.value))
            }
          />{" "}
        </p>
        <EconometricInputComponent
          data={this.state.params}
          onChange={(data) => this.onParamsChange(data)}
        />
        <SavingsParametersInput
          data={this.state.savings}
          onChange={(data: SavingsParams) => this.onSavingsChange(data)}
        />
        <div>
          <p>
            Frequency:{" "}
            <input
              type="number"
              value={this.state.displayFreq}
              min={1}
              max={12}
              onChange={(ev) =>
                this.setState({ displayFreq: parseInt(ev.target.value) })
              }
            />
          </p>
          <p>
            Period in Years:{" "}
            <input
              type="number"
              value={this.state.displayPeriodYears}
              min={2}
              max={100}
              onChange={(ev) =>
                this.setState({ displayPeriodYears: parseInt(ev.target.value) })
              }
            />
          </p>
        </div>
        {this.summaryChart(monthsIdx, sentimentDatasets)}
        {this.summaryChart(monthsIdx, summaryDatasets)}
        {this.gainsChart(monthsIdx, statisticsOverTime, adjustForInflation)}

        <table>
          <thead>
            <tr key="title">
              <th key="month">Period {this.state.displayFreq}-months</th>
              {summaryDatasets.map((d, idx) => (
                <th key={idx}>{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {_.range(0, monthsIdx.length).map((iPeriod) => (
              <tr key={iPeriod}>
                <td key="month">{iPeriod}</td>
                {summaryDatasets.map((d, idx) => (
                  <td key={idx}>{d.data[iPeriod]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  private calculateInvestmentDatasets(): {
    outcomeOverTime: Outcome[];
    investmentOverTime: Position[];
    investmentVehicleOverTime: Security[];
    statisticsOverTime: Statistics[];
    initialSecurity: Security;
    monthsIdx: number[];
    sentimentOverTime: MarketSentiment[];
    adjustForInflation: (vals: number[]) => number[];
  } {
    const initialInvestmentPrice = 100;
    const numberOfShares = this.state.startingPV / initialInvestmentPrice;
    const { initialInvestment, initialInvestmentVehicle } = fromParams(
      this.state.params,
      numberOfShares,
      initialInvestmentPrice
    );

    const initialSentiment = impliedSentiment(
      initialInvestmentVehicle,
      100,
      this.state.params
    );

    const sentiment = revertingSentiment(
      this.state.params,
      initialInvestmentVehicle,
      initialSentiment
    );

    const savings = inflationAdjustedSavings(
      this.state.params,
      this.state.savings
    );

    const securityAtTimes = evaluateSecurity(
      this.state.params,
      sentiment,
      initialInvestmentVehicle,
      0
    );
    const investments = investOverTime(
      0,
      securityAtTimes,
      initialInvestment,
      savings,
      fullReinvestmentStrategy
    );

    const periods = Math.ceil(
      (12 * this.state.displayPeriodYears) / this.state.displayFreq
    );
    const evolution: InvestmentOutcome[] = take(
      periods,
      aggregate<InvestmentOutcome>(
        this.state.displayFreq,
        aggregateIO
      )(investments)
    );
    const monthsIdx: number[] = take(
      periods,
      sample<number>(this.state.displayFreq)(count(0))
    );
    const sentimentOverTime = take(
      periods,
      sample<MarketSentiment>(this.state.displayFreq)(sentiment)
    );
    const monthlyCPI = fmap((i: number) =>
      Math.pow(1 + this.state.params.inflation / 12, i)
    )(count(0));
    const cpi = take(
      periods,
      sample<number>(this.state.displayFreq)(monthlyCPI)
    );

    return {
      investmentOverTime: _.map(evolution, (e) => e.outcome.investment),
      investmentVehicleOverTime: _.map(evolution, (e) => e.evolvedVehicle),
      outcomeOverTime: _.map(evolution, (e) => e.outcome),
      statisticsOverTime: _.map(evolution, (e) => e.statistics),
      initialSecurity: initialInvestmentVehicle,
      monthsIdx: monthsIdx,
      sentimentOverTime: sentimentOverTime,
      adjustForInflation: this.state.params.adjustForInflation
        ? adjustForInflation(cpi)
        : (vals: number[]) => vals,
    };
  }

  private summaryChart(monthsIdx: number[], summaryDatasets: ChartDataSets[]) {
    return (
      <Line
        width={800}
        height={400}
        data={{
          labels: monthsIdx,
          datasets: summaryDatasets,
        }}
        options={{
          maintainAspectRatio: true,
          responsive: false,
          scales: {
            yAxes: [
              {
                id: "$",
                type: "linear",
                position: "left",
                scaleLabel: {
                  labelString: this.state.params.adjustForInflation
                    ? "adjusted $"
                    : "nominal $",
                  display: true,
                },
              },
              {
                id: "$ small",
                type: "linear",
                position: "left",
                scaleLabel: {
                  labelString: this.state.params.adjustForInflation
                    ? "adjusted $"
                    : "nominal $",
                  display: true,
                },
              },
              {
                id: "%",
                type: "linear",
                position: "right",
                ticks: {
                  min: 0,
                },
              },
            ],
          },
        }}
      />
    );
  }

  private gainsChart(
    monthsIdx: number[],
    statisticsOverTime: Statistics[],
    adjustForInflation: (vals: number[]) => number[]
  ) {
    return (
      <Line
        width={800}
        height={400}
        data={{
          labels: _.map(monthsIdx, (i) => `month ${i}`),
          datasets: [
            {
              label: "Dividends ($)",
              data: this.formatDollar(
                adjustForInflation(
                  _.map(
                    _.range(0, monthsIdx.length),
                    (i) => statisticsOverTime[i].totalDividends
                  )
                )
              ),
              yAxisID: "$ small",
            },
            {
              label: "Capital Gains ($)",
              data: this.formatDollar(
                adjustForInflation(
                  _.map(
                    _.range(0, monthsIdx.length),
                    (i) =>
                      statisticsOverTime[i].fv -
                      statisticsOverTime[Math.max(0, i - 1)].fv -
                      (i == 0 ? 0 : statisticsOverTime[i - 1].externalCashflow)
                  )
                )
              ),
              yAxisID: "$",
            },
          ],
        }}
        options={{
          maintainAspectRatio: true,
          responsive: false,
          scales: {
            yAxes: [
              {
                id: "$",
                type: "linear",
                position: "left",
                scaleLabel: {
                  labelString: this.state.params.adjustForInflation
                    ? "adjusted $"
                    : "nominal $",
                  display: true,
                },
              },
              {
                id: "$ small",
                type: "linear",
                position: "left",
                scaleLabel: {
                  labelString: this.state.params.adjustForInflation
                    ? "adjusted $"
                    : "nominal $",
                  display: true,
                },
              },
              {
                id: "%",
                type: "linear",
                position: "right",
                ticks: {
                  min: 0,
                },
              },
            ],
          },
        }}
      />
    );
  }
}
