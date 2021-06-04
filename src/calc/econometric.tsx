import * as React from "react";
import * as _ from "lodash";
import { saveSettings } from "../settings";
import { DividendParams, InvestmentParams, MarketParams } from "./esg/esg";

export class EconometricInputComponent extends React.Component<
  { data: EconomicParams; onChange: (newData: EconomicParams) => void },
  EconomicParams
> {
  private readonly onChange: (newData: EconomicParams) => void;
  constructor(props: {
    data: EconomicParams;
    onChange: (this: EconometricInputComponent) => void;
  }) {
    super(props);
    this.state = recalculateMarketPriceOf100DollarInvestment(props.data);
    this.onChange = props.onChange;
    this.onChange(this.state);
  }

  handleChange(props: Partial<EconomicParams>): void {
    const state = recalculateMarketPriceOf100DollarInvestment(
      _.assign({}, this.state, props)
    );
    this.setState(state);
    this.onChange(state);
  }

  render(): JSX.Element {
    return (
      <div id="preferences-econometric" className="preferences-box">
        <p className="preferences-head">Econometric preferences</p>
        <table>
          {/*<thead>*/}
          {/*<tr key="title">*/}
          {/*    <th key="month"></th>*/}
          {/*</tr>*/}
          {/*</thead>*/}
          <tbody>
            <tr>
              <td className="prop-name-cell">Current dividend yield (%)</td>
              <td>
                <input
                  type="number"
                  onChange={(e) =>
                    this.handleChange({
                      currentDividendYield: parseFloat(e.target.value) / 100,
                    })
                  }
                  value={this.state.currentDividendYield * 100}
                />
              </td>
            </tr>
            <tr>
              <td>Real dividend growth p.a. (%)</td>
              <td>
                <input
                  type="number"
                  onChange={(e) =>
                    this.handleChange({
                      realDividendGrowth: parseFloat(e.target.value) / 100,
                    })
                  }
                  value={this.state.realDividendGrowth * 100}
                />
              </td>
            </tr>
            <tr>
              <td>Dividend realization factor standard deviation</td>
              <td>
                <input
                  type="number"
                  value={
                    this.state.realizedDividendAnnualStandardDeviation * 100
                  }
                  onChange={(e) =>
                    this.handleChange({
                      realizedDividendAnnualStandardDeviation:
                        parseFloat(e.target.value) / 100,
                    })
                  }
                />
              </td>
            </tr>
            <tr>
              <td>Inflation (%)</td>
              <td>
                <input
                  type="number"
                  onChange={(e) =>
                    this.handleChange({
                      inflation: parseFloat(e.target.value) / 100,
                    })
                  }
                  value={this.state.inflation * 100}
                />
              </td>
            </tr>
            <tr>
              <td>Show inflation-adjusted ($)</td>
              <td>
                <input
                  type="checkbox"
                  onChange={(e) => {
                    this.handleChange({
                      adjustForInflation: e.target.checked,
                    });
                  }}
                  checked={this.state.adjustForInflation}
                />
              </td>
            </tr>
            <tr>
              <td>Discount Rate p.a. (%)</td>
              <td>
                <input
                  type="number"
                  onChange={(e) =>
                    this.handleChange({
                      discountRate: parseFloat(e.target.value) / 100,
                    })
                  }
                  value={this.state.discountRate * 100}
                />
              </td>
            </tr>{" "}
            <tr>
              <td>Market price of $100 investment</td>
              <td>
                <input
                  type="number"
                  onChange={(e) =>
                    this.handleChange({
                      marketPriceOf100DollarInvestment: parseFloat(
                        e.target.value
                      ),
                    })
                  }
                  disabled={true}
                  value={this.state.marketPriceOf100DollarInvestment}
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <button onClick={() => saveSettings()}>Save settings</button>
        </p>
      </div>
    );
  }
}

export interface EconomicParams
  extends MarketParams,
    InvestmentParams,
    DividendParams {
  marketPriceOf100DollarInvestment: number;
  discountRate: number;
  adjustForInflation: boolean;
}

export function nominalDividends(
  monthsIdx: number[],
  econParameters: EconomicParams
): number[] {
  return _.map(
    monthsIdx,
    (i) =>
      100 *
      econParameters.currentDividendYield *
      Math.pow(
        1 + (econParameters.realDividendGrowth + econParameters.inflation) / 12,
        i
      )
  );
}

export function realDividends(
  monthsIdx: number[],
  econParameters: EconomicParams
): number[] {
  return _.map(
    monthsIdx,
    (i) =>
      100 *
      econParameters.currentDividendYield *
      Math.pow(1 + econParameters.realDividendGrowth / 12, i)
  );
}

export function discountedDividends(
  monthsIdx: number[],
  econParameters: EconomicParams
): number[] {
  return _.map(
    monthsIdx,
    (i) =>
      100 *
      econParameters.currentDividendYield *
      Math.pow(
        1 +
          (econParameters.realDividendGrowth +
            econParameters.inflation -
            econParameters.discountRate) /
            12,
        i
      )
  );
}

export function recalculateMarketPriceOf100DollarInvestment(
  params: EconomicParams
): EconomicParams {
  return _.assign({}, params, {
    marketPriceOf100DollarInvestment:
      (100 * params.currentDividendYield) /
      (params.discountRate - (params.realDividendGrowth + params.inflation)),
  });
}
