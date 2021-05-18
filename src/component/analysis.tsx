import * as React from "react";
import { Line } from "react-chartjs-2";

import * as _ from "lodash";
import { ChartDataSets } from "chart.js";
import {
  discountedDividends,
  EconomicParams,
  EconometricInputComponent,
  nominalDividends,
  realDividends,
} from "../calc/econometric";

interface AnalysisDatasets {
  dividends_nominal: ChartDataSets;
  dividends_real: ChartDataSets;
  dividends_discounted: ChartDataSets;
}

interface AnalysisProps {
  econParams: EconomicParams;
  datasets: AnalysisDatasets;
}

export class AnalysisComponent extends React.Component<
  EconomicParams,
  AnalysisProps
> {
  constructor(props: EconomicParams) {
    super(props);
    this.state = {
      econParams: props,
      datasets: calculateDatasets(props),
    };
  }

  onChangeParams(econParams: EconomicParams): void {
    console.log(`new params: ${JSON.stringify(econParams)}`);
    this.setState({
      econParams: econParams,
      datasets: calculateDatasets(econParams),
    });
  }

  render() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const analysis = this;
    return (
      <div>
        <EconometricInputComponent
          data={this.state.econParams}
          onChange={(newData: EconomicParams) => {
            this.onChangeParams(newData);
          }}
        />

        <Line
          width={800}
          height={600}
          type="line"
          data={{
            labels: _.map(_.range(0, 100), (i) => `month ${i + 1}`),
            datasets: [
              this.state.datasets.dividends_nominal,
              this.state.datasets.dividends_real,
              this.state.datasets.dividends_discounted,
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
      </div>
    );
  }
}

function calculateDatasets(econParameters: EconomicParams): AnalysisDatasets {
  const monthsIdx = _.range(0, 100);
  return {
    dividends_nominal: {
      label: "Nominal dividends",
      yAxisID: "$",
      data: nominalDividends(monthsIdx, econParameters),
    },
    dividends_real: {
      label: "Real dividends",
      yAxisID: "$",
      data: realDividends(monthsIdx, econParameters),
    },
    dividends_discounted: {
      label: "Discounted dividends",
      yAxisID: "$",
      data: discountedDividends(monthsIdx, econParameters),
    },
  };
}
