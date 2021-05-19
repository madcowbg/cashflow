import _ from "lodash";
import * as React from "react";
import { Line } from "react-chartjs-2";

import { EconometricInputComponent, EconomicParams } from "../calc/econometric";
import {
  Position,
  Security,
  noReinvestmentStrategy,
  Outcome,
  Statistics,
  currentYield,
  impliedSentiment,
  fullReinvestmentStrategy,
  investOverTime,
  InvestmentOutcome,
} from "../calc/esg";
import { ChartData, ChartDataSets } from "chart.js";

class ESGProps {
  params: EconomicParams;
}

class ESGState {
  params: EconomicParams;
  startingPV: number;
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

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  constructor(props: ESGProps) {
    super(props);
    this.state = { params: props.params, startingPV: 250000 };
  }

  onChange(params: EconomicParams) {
    console.log(`changed params: ${JSON.stringify(params)}`);
    this.setState({ params: params });
  }

  render() {
    const {
      investmentOverTime,
      investmentVehicleOverTime,
      outcomeOverTime,
      statisticsOverTime,
      initialSecurity,
      monthsIdx,
    } = this.calculateDatasets();

    const summaryDatasets: ChartDataSets[] = [
      {
        label: "Theoretic Fully Rebalanced Investment Value ($)",
        data: theoreticInvestmentValue(
          this.state.startingPV,
          this.state.params,
          initialSecurity,
          100,
          monthsIdx
        ),
        yAxisID: "$",
      },
      {
        label: "Investment Current Market Price ($)",
        data: _.map(statisticsOverTime, (s) => s.fv),
        yAxisID: "$",
      },
      {
        label: "Paid Dividends ($)",
        data: _.map(statisticsOverTime, (s) => s.paidDividends),
        yAxisID: "$ small",
      },
      {
        label: "Reinvested Dividends ($)",
        data: _.map(statisticsOverTime, (s) => s.reinvestedDividends),
        yAxisID: "$ small",
      },
      {
        label: "Realized Dividend Yield (%)",
        data: _.map(
          statisticsOverTime,
          (s) => (((s.reinvestedDividends + s.paidDividends) * 12) / s.fv) * 100
        ),
        yAxisID: "%",
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
          onChange={(data) => this.onChange(data)}
        />
        {this.summaryChart(monthsIdx, summaryDatasets)}
        {this.gainsChart(
          monthsIdx,
          outcomeOverTime,
          investmentOverTime,
          investmentVehicleOverTime,
          statisticsOverTime
        )}

        <table>
          <tr key="title">
            <th>Month</th>
            {summaryDatasets.map((d) => (
              <th>{d.label}</th>
            ))}
          </tr>
          {monthsIdx.map((iMonth) => (
            <tr key={iMonth}>
              <td>{iMonth}</td>
              {summaryDatasets.map((d) => (
                <td>{d.data[iMonth]}</td>
              ))}
            </tr>
          ))}
        </table>
      </div>
    );
  }

  private calculateDatasets(): {
    outcomeOverTime: Outcome[];
    investmentOverTime: Position[];
    investmentVehicleOverTime: Security[];
    statisticsOverTime: Statistics[];
    initialSecurity: Security;
    monthsIdx: number[];
  } {
    const initialInvestmentPrice = 100;
    const numberOfShares = this.state.startingPV / initialInvestmentPrice;
    const { initialInvestment, initialInvestmentVehicle } = fromParams(
      this.state.params,
      numberOfShares,
      initialInvestmentPrice
    );

    const MAX_TIME = 240;
    const sentiment = impliedSentiment(
      initialInvestmentVehicle,
      100,
      this.state.params
    );

    const investments = investOverTime(
      this.state.params,
      sentiment,
      initialInvestmentVehicle,
      MAX_TIME,
      initialInvestment,
      // noReinvestmentStrategy,
      fullReinvestmentStrategy
    );

    const evolution: InvestmentOutcome[] = [investments];
    const monthsIdx: number[] = [0];
    for (let i = 0; i < MAX_TIME - 1; i++) {
      evolution.push(_.last(evolution).next());
      monthsIdx.push(monthsIdx.length);
    }
    return {
      investmentOverTime: _.map(evolution, (e) => e.outcome.investment),
      investmentVehicleOverTime: _.map(evolution, (e) => e.evolvedVehicle),
      outcomeOverTime: _.map(evolution, (e) => e.outcome),
      statisticsOverTime: _.map(evolution, (e) => e.statistics),
      initialSecurity: initialInvestmentVehicle,
      monthsIdx: monthsIdx,
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
              },
              {
                id: "$ small",
                type: "linear",
                position: "left",
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
              data: _.map(
                monthsIdx,
                (i) =>
                  statisticsOverTime[i].reinvestedDividends +
                  statisticsOverTime[i].paidDividends
              ),
            },
            {
              label: "Capital Gains ($)",
              data: _.map(
                monthsIdx,
                (i) =>
                  statisticsOverTime[i].fv -
                  statisticsOverTime[Math.max(0, i - 1)].fv
              ),
            },
          ],
        }}
        options={{
          maintainAspectRatio: true,
          responsive: false,
          scales: {
            yAxes: [
              {
                stacked: true,
              },
            ],
          },
        }}
      />
    );
  }

  private onChangeStartingPV(startingPV: number): void {
    this.setState({ startingPV: startingPV });
  }
}
