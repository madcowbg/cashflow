import _ from "lodash";
import * as React from "react";
import { Line } from "react-chartjs-2";

import { EconometricInputComponent, EconomicParams } from "../calc/econometric";
import {
  currentYield,
  DummyI,
  InvestmentOutcome,
  MarketParams,
  MarketSentiment,
  Outcome,
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
  initialState: ESGState;
  onRender: (state: ESGState) => void;
}

class ESGState {
  readonly params: EconomicParams;
  readonly startingPV: number;
  readonly savings: SavingsParams;
  readonly displayFreq: number;
  readonly displayPeriodYears: number;
  readonly numSims: number;
  readonly simIndex: number;
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

function resampleToFrequency<I extends string>(
  displayPeriodYears: number,
  displayFreq: number,
  cpi: Process<number>,
  process: {
    evolution: Process<InvestmentOutcome<I>>;
    monthsIdx: Process<number>;
    sentimentOverTime: Process<MarketSentiment>;
  }
): {
  evolution: InvestmentOutcome<I>[];
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

function seedForSimIndex(i: number): number {
  const BASE_SEED = 123;
  return BASE_SEED + i;
}

export class ESGSimulation extends React.Component<ESGProps, ESGState> {
  private readonly onRender: (state: ESGState) => void;

  constructor(props: ESGProps) {
    super(props);
    this.onRender = props.onRender;
    this.state = props.initialState;
  }
  readonly formatDollar = formatFloat(1);
  readonly formatPercent = formatFloat(3);

  private onParamsChange(params: EconomicParams) {
    this.setState({ params: params });
  }

  private onChangeStartingPV(startingPV: number): void {
    this.setState({ startingPV: startingPV });
  }

  private onSavingsChange(data: SavingsParams): void {
    this.setState({ savings: data });
  }

  render() {
    this.onRender(this.state);
    const {
      outcomeOverTime,
      statisticsOverTime,
      initialSecurity,
      monthsIdx,
      sentimentOverTime,
      adjustForInflation,
    } = this.calculateInvestmentDatasets();

    const investmentSummary: ChartDataSets[] = [
      {
        label: "Investment Current Market Price ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.fv))
        ),
        yAxisID: "$",
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
        label: "Cashflow ($)",
        data: this.formatDollar(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.externalCashflow)
          )
        ),
        yAxisID: "$ small",
      },
      {
        label: "Shortfall ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.shortfall))
        ),
        yAxisID: "$ small",
      },
      {
        label: "Theoretic Fully Rebalanced Investment Value ($) [FIXME]",
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
        hidden: true,
        yAxisID: "$",
      },
    ];

    const miscSummaryDatasets: ChartDataSets[] = [
      {
        label: "Num shares",
        data: this.formatDollar(
          _.map(statisticsOverTime, (s) => s.numberOfShares["equity"]) // FIXME!
        ),
        yAxisID: "#",
      },
      {
        label: "Num bought shares",
        data: this.formatDollar(
          adjustForInflation(
            _.map(statisticsOverTime, (s) => s.totalBoughtNumShares)
          )
        ),
        yAxisID: "#",
      },
      {
        label: "Dividends ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.totalDividends))
        ),
        yAxisID: "$ small",
      },
      {
        label: "Shortfall ($)",
        data: this.formatDollar(
          adjustForInflation(_.map(statisticsOverTime, (s) => s.shortfall))
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
        <div id="simulations">
          <div id="preferences" className="preferences-group">
            <div id="preferences-investement" className="preferences-box">
              <p className="preferences-head">Investment preferences</p>
              <table>
                <tbody>
                  <tr>
                    <td className="prop-name-cell">Initial investment size</td>
                    <td>
                      <input
                        type="number"
                        value={this.state.startingPV}
                        onChange={(e) =>
                          this.onChangeStartingPV(parseFloat(e.target.value))
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <EconometricInputComponent
              data={this.state.params}
              onChange={(data) => this.onParamsChange(data)}
            />
            <SavingsParametersInput
              data={this.state.savings}
              onChange={(data: SavingsParams) => this.onSavingsChange(data)}
            />
          </div>
          <div className="chart-box">
            <div id="preferences-simulation" className="preferences-box">
              <p className="preferences-head">Simulation preferences</p>
              <table>
                <tbody>
                  <tr>
                    <td className="prop-name-cell"># sims</td>
                    <td>
                      <input
                        type="number"
                        value={this.state.numSims}
                        min={1}
                        max={5000}
                        onChange={(ev) =>
                          this.setState({ numSims: parseInt(ev.target.value) })
                        }
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="standard-chart">
              {this.simsChart(sims.monthsIdx, sims.trajectoryDatasets)},
            </div>
          </div>
        </div>
        <div id="selected-trajectory">
          <div id="preferences-trajectory" className="preferences-box">
            <table>
              <tbody>
                <tr>
                  <td className="prop-name-cell">Sim index</td>
                  <td>
                    <input
                      type="number"
                      value={this.state.simIndex}
                      min={0}
                      max={this.state.numSims - 1}
                      onChange={(ev) =>
                        this.setState({ simIndex: parseInt(ev.target.value) })
                      }
                    />
                  </td>
                </tr>
                <tr>
                  <td>Display frequency</td>
                  <td>
                    <select
                      id="frequency"
                      datatype="number"
                      value={this.state.displayFreq}
                      onChange={(ev) =>
                        this.setState({
                          displayFreq: parseInt(ev.target.value),
                        })
                      }
                    >
                      <option value="1">Monthly</option>
                      <option value="3">Quarterly</option>
                      <option value="6">Semi-Annual</option>
                      <option value="12">Annual</option>
                    </select>
                  </td>
                </tr>
                <tr>
                  <td>Period in Years</td>
                  <td>
                    <input
                      type="number"
                      value={this.state.displayPeriodYears}
                      min={2}
                      max={100}
                      onChange={(ev) =>
                        this.setState({
                          displayPeriodYears: parseInt(ev.target.value),
                        })
                      }
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="chart-box">
            <div className="standard-chart">
              {this.summaryChart(
                monthsIdx,
                sentimentDatasets,
                "Sentiment and yields"
              )}
            </div>
          </div>
          <div className="chart-box">
            <div className="standard-chart">
              {this.summaryChart(
                monthsIdx,
                investmentSummary,
                "Investment value and cashflows"
              )}
            </div>
          </div>
          <div className="chart-box">
            <div className="standard-chart">
              {this.summaryChart(
                monthsIdx,
                miscSummaryDatasets,
                "Other charts"
              )}
            </div>
          </div>
          <div className="chart-box">
            <div className="standard-chart">
              {this.gainsChart(
                monthsIdx,
                statisticsOverTime,
                adjustForInflation,
                "Gains and cashflows"
              )}
            </div>
          </div>
          <table id="details-table">
            <thead>
              <tr key="title">
                <th key="month">Period {this.state.displayFreq}-months</th>
                {miscSummaryDatasets.map((d, idx) => (
                  <th key={idx}>{d.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {_.range(0, monthsIdx.length).map((iPeriod) => (
                <tr key={iPeriod}>
                  <td key="month">{iPeriod}</td>
                  {miscSummaryDatasets.map((d, idx) => (
                    <td key={idx}>{`${d.data[iPeriod]}`}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  private calculateInvestmentDatasets(): {
    outcomeOverTime: Outcome<DummyI>[];
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
        this.state.params,
        this.state.savings
      );

    const { sentiment, investments } = trajectory.pick(
      seedForSimIndex(this.state.simIndex)
    );

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
      resampleToFrequency<DummyI>(
        this.state.displayPeriodYears,
        this.state.displayFreq,
        cpiProc,
        process
      );

    return {
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

  private summaryChart(
    monthsIdx: number[],
    summaryDatasets: ChartDataSets[],
    titleText: string
  ) {
    return (
      <Line
        data={{
          labels: monthsIdx,
          datasets: summaryDatasets,
        }}
        options={{
          title: {
            display: true,
            text: titleText,
          },
          maintainAspectRatio: false,
          responsive: true,
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
              {
                id: "#",
                type: "linear",
                position: "right",
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
    adjustForInflation: (vals: number[]) => number[],
    titleText: string
  ) {
    return (
      <Line
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
          title: {
            display: true,
            text: titleText,
          },
          maintainAspectRatio: false,
          responsive: true,
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
        data={{
          labels: monthsIdx,
          datasets: trajectoryDatasets,
        }}
        options={{
          maintainAspectRatio: false,
          responsive: true,
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
      this.state.params,
      this.state.savings
    );

    const sampler = aggregate(12, aggregateIO);
    const periodTake = take(this.state.displayPeriodYears);

    const simulationOutcomes = _.map(_.range(this.state.numSims), (i) =>
      sampler(trajectory.pick(seedForSimIndex(i)).investments)
    );
    const simulatedFVs: Process<number>[] = _.map(simulationOutcomes, (s) =>
      fmap((io: InvestmentOutcome<DummyI>): number => io.statistics.fv)(s)
    );
    const cpi = inflationAdjustmentFactor(this.state.params, 12);
    const inflationAdjust = this.state.params.adjustForInflation
      ? (proc: Process<number>) =>
          fmap((val: number, cpi: number) => val / cpi)(proc, cpi)
      : (proc: Process<number>) => proc;

    const monthIdxs = fmap((io: InvestmentOutcome<DummyI>) => io.time)(
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
        })
      ),
    };
  }
}
