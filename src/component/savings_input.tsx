import * as React from "react";
import { SavingsParams } from "../calc/esg/esg";

export class SavingsParametersInput extends React.Component<
  { onChange: (data: SavingsParams) => void; data: SavingsParams },
  SavingsParams
> {
  private readonly onChange: (data: SavingsParams) => void;

  constructor(params: {
    onChange: (data: SavingsParams) => void;
    data: SavingsParams;
  }) {
    super(params);
    this.onChange = params.onChange;
    this.state = params.data;
  }

  render() {
    return (
      <div id="preferences-savings" className="preferences-box">
        <p className="preferences-head">Savings preferences</p>
        <table>
          <tbody>
            <tr>
              <td className="prop-name-cell">Monthly investment ($)</td>
              <td>
                <input
                  type="number"
                  value={this.state.monthlyInvestment}
                  onChange={(ev) =>
                    this.setSavings(parseFloat(ev.target.value))
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  private setSavings(monthlyInvestment: number) {
    this.setState({ monthlyInvestment });
    this.onChange({ monthlyInvestment });
  }
}
