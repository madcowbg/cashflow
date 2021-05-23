import * as React from "react";
import { SavingsParams } from "../calc/esg";

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
      <div>
        Monthly investment ($):{" "}
        <input
          type="number"
          value={this.state.monthlyInvestment}
          onChange={(ev) =>
            this.setState({ monthlyInvestment: parseFloat(ev.target.value) })
          }
        />
      </div>
    );
  }
}