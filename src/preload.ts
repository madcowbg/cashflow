// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import * as _ from "lodash";
import "chartjs-plugin-colorschemes";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { ESGSimulation } from "./component/simulation";
import { saveSettings, storedSettings } from "./settings";

const defaults = {
  params: {
    currentDividendYield: 0.0154,
    realDividendGrowth: 0.025,
    realizedDividendAnnualStandardDeviation: 0.03, // S&P 500 in 2014-2021 has this at 0.03 - annual stdev of logchange of dividend
    inflation: 0.02,
    marketPriceOf100DollarInvestment: 100,
    discountRate: 0.085,
    adjustForInflation: true,
  },
  startingPV: 250000,
  savings: {
    monthlyInvestment: -1500,
  },
  displayFreq: 1,
  displayPeriodYears: 20,
  numSims: 19,
  simIndex: 18,
};

window.addEventListener("DOMContentLoaded", () => {
  ReactDOM.render(
    React.createElement(ESGSimulation, {
      initialState: storedSettings(defaults),
      onRender(state) {
        saveSettings(state);
      },
    }),
    document.getElementById("portfolio-simulation")
  );
});
