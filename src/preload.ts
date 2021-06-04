// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import * as _ from "lodash";
import "chartjs-plugin-colorschemes";

import { appSettings } from "./settings";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { ESGSimulation } from "./component/simulation";

window.addEventListener("DOMContentLoaded", () => {
  ReactDOM.render(
    React.createElement(ESGSimulation, {
      params: {
        currentDividendYield: 0.0154,
        realDividendGrowth: 0.025,
        realizedDividendAnnualStandardDeviation: 0.03, // S&P 500 in 2014-2021 has this at 0.03 - annual stdev of logchange of dividend
        inflation: 0.02,
        marketPriceOf100DollarInvestment: 100,
        discountRate: 0.085,
        adjustForInflation: true,
      },
      savings: {
        monthlyInvestment: -1500,
      },
    }),
    document.getElementById("portfolio-simulation")
  );
});
