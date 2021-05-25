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
import { asArray } from "../calc/processes";

class ESGProps {
  params: EconomicParams;
  savings: SavingsParams;
}

class ESGState {
  params: EconomicParams;
  startingPV: number;
  savings: SavingsParams;
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

function adjustForInflation(
  params: EconomicParams
): (vals: number[]) => number[] {
  return (vals: number[]): number[] =>
    _.map(
      vals,
      (val: number, i: number): number =>
        val /
        (params.adjustForInflation
          ? Math.pow(1 + params.inflation / 12, i)
          : 1.0)
    );
}

function formatFloat(precision: number): (vals: number[]) => number[] {
  const size = Math.pow(10, precision);
  return (vals) => _.map(vals, (val) => Math.round(val * size) / size);
}

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  constructor(props: ESGProps) {
    super(props);
    this.state = {
      params: props.params,
      startingPV: 250000,
      savings: props.savings,
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
    } = this.calculateInvestmentDatasets();

    const summaryDatasets: ChartDataSets[] = [
      {
        label: "Theoretic Fully Rebalanced Investment Value ($)",
        data: this.formatDollar(
          adjustForInflation(this.state.params)(
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
          adjustForInflation(this.state.params)(
            _.map(statisticsOverTime, (s) => s.fv)
          )
        ),
        yAxisID: "$",
      },
      {
        label: "Dividends ($)",
        data: this.formatDollar(
          adjustForInflation(this.state.params)(
            _.map(statisticsOverTime, (s) => s.totalDividends)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Total Bought ($)",
        data: this.formatDollar(
          adjustForInflation(this.state.params)(
            _.map(statisticsOverTime, (s) => s.totalBoughtDollar)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Total Sold ($)",
        data: this.formatDollar(
          adjustForInflation(this.state.params)(
            _.map(statisticsOverTime, (s) => s.totalSoldDollar)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Cashflow ($)",
        data: this.formatDollar(
          adjustForInflation(this.state.params)(
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
            (s) => ((s.totalDividends * 12) / s.fv) * 100
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
            (s) => ((s.totalDividends * 12) / s.fv) * 100
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
          adjustForInflation(this.state.params)(
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
        {this.summaryChart(monthsIdx, sentimentDatasets)}
        {this.summaryChart(monthsIdx, summaryDatasets)}
        {this.gainsChart(
          monthsIdx,
          outcomeOverTime,
          investmentOverTime,
          investmentVehicleOverTime,
          statisticsOverTime
        )}

        <table>
          <thead>
            <tr key="title">
              <th key="month">Month</th>
              {summaryDatasets.map((d, idx) => (
                <th key={idx}>{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {monthsIdx.map((iMonth) => (
              <tr key={iMonth}>
                <td key="month">{iMonth}</td>
                {summaryDatasets.map((d, idx) => (
                  <td key={idx}>{d.data[iMonth]}</td>
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
  } {
    const initialInvestmentPrice = 100;
    const numberOfShares = this.state.startingPV / initialInvestmentPrice;
    const { initialInvestment, initialInvestmentVehicle } = fromParams(
      this.state.params,
      numberOfShares,
      initialInvestmentPrice
    );

    const MAX_TIME = 240;
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

    const evolution: InvestmentOutcome[] = asArray(investments, MAX_TIME - 1);
    const monthsIdx: number[] = _.range(0, MAX_TIME - 1);
    return {
      investmentOverTime: _.map(evolution, (e) => e.outcome.investment),
      investmentVehicleOverTime: _.map(evolution, (e) => e.evolvedVehicle),
      outcomeOverTime: _.map(evolution, (e) => e.outcome),
      statisticsOverTime: _.map(evolution, (e) => e.statistics),
      initialSecurity: initialInvestmentVehicle,
      monthsIdx: monthsIdx,
      sentimentOverTime: asArray(sentiment, MAX_TIME),
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
    outcomeOverTime: Outcome[],
    investmentOverTime: Position[],
    investmentVehicleOverTime: Security[],
    statisticsOverTime: Statistics[]
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
                adjustForInflation(this.state.params)(
                  _.map(monthsIdx, (i) => statisticsOverTime[i].totalDividends)
                )
              ),
              yAxisID: "$ small",
            },
            {
              label: "Capital Gains ($)",
              data: this.formatDollar(
                adjustForInflation(this.state.params)(
                  _.map(
                    monthsIdx,
                    (i) =>
                      statisticsOverTime[i].fv -
                      statisticsOverTime[Math.max(0, i - 1)].fv
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
