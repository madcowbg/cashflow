import _ from "lodash";
import * as React from "react";
import { Line } from "react-chartjs-2";

import { EconometricInputComponent, EconomicParams } from "./econometric";
import {
  Investment,
  InvestmentVehicleAtTime,
  investOneMoreTime,
  marketReturn,
  noReinvestmentStrategy,
  Outcome,
} from "./esg";

class ESGProps {
  params: EconomicParams;
}

class ESGState {
  params: EconomicParams;
}

function investmentValue(
  initialValue: number,
  params: EconomicParams,
  monthsIdx: number[]
): number[] {
  return _.map(
    monthsIdx,
    (i) => initialValue * Math.pow(1 + marketReturn(params) / 12, i)
  );
}

function fromParams(
  params: EconomicParams,
  numberOfShares: number,
  initialInvestmentPrice: number
): {
  initialInvestment: Investment;
  initialInvestmentVehicle: InvestmentVehicleAtTime;
} {
  return {
    initialInvestment: { numberOfShares },
    initialInvestmentVehicle: {
      time: 0,
      currentPrice: initialInvestmentPrice,
      currentAnnualDividends:
        initialInvestmentPrice * params.currentDividendYield,
    },
  };
}

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  constructor(props: ESGProps) {
    super(props);
    this.state = { params: props.params };
  }

  onChange(params: EconomicParams) {
    console.log(`changed params: ${JSON.stringify(params)}`);
    this.setState({ params: params });
  }

  render() {
    const { initialInvestment, initialInvestmentVehicle } = fromParams(
      this.state.params,
      1,
      100
    );
    const params = [this.state.params];
    const investmentOverTime = [initialInvestment];
    const investmentVehicleOverTime = [initialInvestmentVehicle];
    const outcomeOverTime: Outcome[] = [];

    const MAX_TIME = 240;
    for (let i = 0; i < MAX_TIME; i++) {
      const { outcome, evolvedVehicle } = investOneMoreTime(
        _.last(params),
        _.last(investmentVehicleOverTime),
        _.last(investmentOverTime),
        // fullReinvestmentStrategy
        noReinvestmentStrategy
      );
      investmentVehicleOverTime.push(evolvedVehicle);
      investmentOverTime.push(outcome.investment);
      outcomeOverTime.push(outcome);
    }

    const monthsIdx = _.map(outcomeOverTime, (o) => o.time);
    return (
      <div>
        <EconometricInputComponent
          data={this.state.params}
          onChange={(data) => this.onChange(data)}
        />
        {this.summaryChart(monthsIdx, outcomeOverTime)}
        {this.gainsChart(
          monthsIdx,
          outcomeOverTime,
          investmentOverTime,
          investmentVehicleOverTime
        )}
      </div>
    );
  }

  private summaryChart(monthsIdx: number[], outcomes: Outcome[]) {
    return (
      <Line
        width={800}
        height={400}
        data={{
          labels: monthsIdx,
          datasets: [
            {
              label: "Theoretic Fully Rebalanced Investment Value ($)",
              data: investmentValue(100, this.state.params, monthsIdx),
              yAxisID: "$",
            },
            {
              label: "Investment Current Market Price ($)",
              data: _.map(outcomes, (o) => o.investmentPrice),
              yAxisID: "$",
            },
            {
              label: "Paid Dividends ($)",
              data: _.map(outcomes, (o) => o.paidDividends),
              yAxisID: "$ small",
            },
            {
              label: "Reinvested Dividends ($)",
              data: _.map(outcomes, (o) => o.reinvestedDividends),
              yAxisID: "$ small",
            },
            {
              label: "Current Dividend Yield (%)",
              data: _.map(
                outcomes,
                (o) =>
                  (((o.reinvestedDividends + o.paidDividends) * 12) /
                    o.investmentPrice) *
                  100
              ),
              yAxisID: "%",
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
    investmentOverTime: Investment[],
    investmentVehicleOverTime: InvestmentVehicleAtTime[]
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
                  outcomeOverTime[i].reinvestedDividends +
                  outcomeOverTime[i].paidDividends
              ),
            },
            {
              label: "Capital Gains ($)",
              data: _.map(
                monthsIdx,
                (i) =>
                  investmentOverTime[i].numberOfShares *
                  (investmentVehicleOverTime[i].currentPrice -
                    investmentVehicleOverTime[Math.max(0, i - 1)].currentPrice)
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
}