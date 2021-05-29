import _ from "lodash";
import * as React from "react";
import { Line } from "react-chartjs-2";

import { EconometricInputComponent, EconomicParams } from "../calc/econometric";
import {
  currentYield,
  InvestmentOutcome,
  MarketParams,
  MarketSentiment,
  Outcome,
  Position,
  SavingsParams,
  savingsTrajectory,
  Security,
  Statistics,
} from "../calc/esg/esg";
import { ChartDataSets } from "chart.js";
import { SavingsParametersInput } from "./savings_input";
import {
  aggregate,
  count,
  fmap,
  Process,
  sample,
  take,
} from "../calc/processes";
import { aggregateIO, investmentProcess } from "../calc/esg/aggregation";

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
  readonly numSims: number;
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

function resampleToFrequency(
  displayPeriodYears: number,
  displayFreq: number,
  cpi: Process<number>,
  process: {
    evolution: Process<InvestmentOutcome>;
    monthsIdx: Process<number>;
    sentimentOverTime: Process<MarketSentiment>;
  }
): {
  evolution: InvestmentOutcome[];
  monthsIdx: number[];
  sentimentOverTime: MarketSentiment[];
  cpi: number[];
} {
  const periods = Math.ceil((12 * displayPeriodYears) / displayFreq);
  return {
    evolution: take(periods)(process.evolution),
    monthsIdx: take(periods)(process.monthsIdx),
    sentimentOverTime: take(periods)(process.sentimentOverTime),
    cpi: take(periods)(cpi),
  };
}

function inflationAdjustmentFactor(
  params: MarketParams,
  frequency: number
): Process<number> {
  const monthlyCPI = fmap((i: number) =>
    Math.pow(1 + params.inflation / 12, i)
  )(count(0));

  return sample<number>(frequency)(monthlyCPI);
}

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  constructor(props: ESGProps) {
    super(props);
    this.state = {
      params: props.params,
      startingPV: 250000,
      savings: props.savings,
      displayFreq: 12,
      displayPeriodYears: 20,
      numSims: 10,
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

    const sims = this.calculateSims();
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
            # sims:{" "}
            <input
              type="number"
              value={this.state.numSims}
              min={1}
              max={5000}
              onChange={(ev) =>
                this.setState({ numSims: parseInt(ev.target.value) })
              }
            />
          </p>
        </div>
        {this.simsChart(sims.monthsIdx, sims.trajectoryDatasets)},
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
    const { initialInvestmentVehicle, investmentResult: trajectory } =
      savingsTrajectory(
        this.state.startingPV,
        this.state.params,
        this.state.params,
        this.state.savings
      );

    const { sentiment, investments } = trajectory.pick(14123);

    const process = investmentProcess(
      this.state.displayFreq,
      investments,
      sentiment
    );
    const cpiProc = inflationAdjustmentFactor(
      this.state.params,
      this.state.displayFreq
    );

    const { evolution, monthsIdx, sentimentOverTime, cpi } =
      resampleToFrequency(
        this.state.displayPeriodYears,
        this.state.displayFreq,
        cpiProc,
        process
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

  private simsChart(monthsIdx: string[], trajectoryDatasets: ChartDataSets[]) {
    return (
      <Line
        width={800}
        height={400}
        data={{
          labels: monthsIdx,
          datasets: trajectoryDatasets,
        }}
        options={{
          maintainAspectRatio: true,
          responsive: false,
          legend: { display: false },
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
            ],
          },
        }}
      />
    );
  }

  private calculateSims(): {
    monthsIdx: string[];
    trajectoryDatasets: ChartDataSets[];
  } {
    const { investmentResult: trajectory } = savingsTrajectory(
      this.state.startingPV,
      this.state.params,
      this.state.params,
      this.state.savings
    );

    const sampler = aggregate(12, aggregateIO);
    const periodTake = take(this.state.displayPeriodYears);

    const BASE_SEED = 123;
    const simulationOutcomes = _.map(_.range(this.state.numSims), (i) =>
      sampler(trajectory.pick(BASE_SEED + i).investments)
    );
    const simulatedFVs: Process<number>[] = _.map(simulationOutcomes, (s) =>
      fmap((io: InvestmentOutcome): number => io.statistics.fv)(s)
    );
    const cpi = inflationAdjustmentFactor(this.state.params, 12);
    const inflationAdjust = this.state.params.adjustForInflation
      ? (proc: Process<number>) =>
          fmap((val: number, cpi: number) => val / cpi)(proc, cpi)
      : (proc: Process<number>) => proc;

    const monthIdxs = fmap((io: InvestmentOutcome) => io.time)(
      sampler(trajectory.pick(-1).investments)
    );

    return {
      monthsIdx: _.map(periodTake(monthIdxs), (m) => `month ${m}`),
      trajectoryDatasets: _.map(
        simulatedFVs,
        (sims, idx): ChartDataSets => ({
          label: `sim ${idx}`,
          data: this.formatDollar(periodTake(inflationAdjust(sims))),
          yAxisID: "$",
          fill: false,
          borderColor: `rgba(0, 0, 255, ${1 / Math.sqrt(this.state.numSims)}`,
          pointRadius: 0,
        })
      ),
    };
  }
}
