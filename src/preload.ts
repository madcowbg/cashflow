// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import * as _ from "lodash";
import { Chart, ChartData, ChartDataSets } from "chart.js";
import "chartjs-plugin-colorschemes";

import { calcRandom, RandomSeriesData } from "./calc/randomdata";

import { appSettings } from "./settings";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { AnalysisComponent } from "./component/analysis";
import { ESGSimulation } from "./component/simulation";

function toChartData(data: RandomSeriesData): ChartData {
  return {
    labels: data.days,
    datasets: [
      {
        label: "Price",
        data: data.pricesData,
        borderWidth: 1,
      },
    ],
  };
}

function createCharts(element: HTMLCanvasElement, data: ChartData): Chart {
  const ctx = element.getContext("2d");

  const chart = new Chart(ctx, {
    type: "line",
    data: data,
    options: {
      maintainAspectRatio: true,
      responsive: false,
    },
  });

  chart.update();

  console.log(chart.getDatasetMeta(0));

  return chart;
}

function updateChart(
  chart: Chart,
  inputMean: HTMLInputElement,
  inputStd: HTMLInputElement
): () => void {
  const dataset: ChartDataSets = chart.data.datasets[0];

  return () => {
    appSettings.mean = parseFloat(inputMean.value) / 100;
    appSettings.std = parseFloat(inputStd.value) / 100;

    console.log(
      `setting mean to ${appSettings.mean}% and stdev to ${appSettings.std}%`
    );

    const randomData = calcRandom(appSettings.mean, appSettings.std);

    dataset.data = randomData.pricesData;
    chart.update();
  };
}

function initLinkedChart(
  chartCanvas: HTMLCanvasElement,
  inputMean: HTMLInputElement,
  inputStd: HTMLInputElement
): void {
  const chartData = toChartData(calcRandom(0, 0.15));
  const chart = createCharts(chartCanvas, chartData);

  const updater = updateChart(chart, inputMean, inputStd);
  inputMean.addEventListener("change", updater);
  inputStd.addEventListener("change", updater);

  updater();
}

window.addEventListener("DOMContentLoaded", () => {
  const replaceText = (selector: string, text: string) => {
    const element = document.getElementById(selector);
    if (element) {
      element.innerText = text;
    }
  };

  for (const type of ["chrome", "node", "electron"]) {
    replaceText(
      `${type}-version`,
      process.versions[type as keyof NodeJS.ProcessVersions]
    );
  }

  const summaryChartCanvas = document.getElementById(
    "summary-chart"
  ) as HTMLCanvasElement;
  const ctx = summaryChartCanvas.getContext("2d");

  ReactDOM.render(
    React.createElement(ESGSimulation, {
      params: {
        currentDividendYield: 0.0154,
        realDividendGrowth: 0.025,
        inflation: 0.02,
        marketPriceOf100DollarInvestment: 100,
        discountRate: 0.085,
        adjustForInflation: true,
      },
      savings: {
        monthlyInvestment: 5000,
      },
    }),
    document.getElementById("portfolio-simulation")
  );
  ReactDOM.render(
    React.createElement(AnalysisComponent, {
      currentDividendYield: 0.0154,
      realDividendGrowth: 0.025,
      inflation: 0.02,
      marketPriceOf100DollarInvestment: 100,
      discountRate: 0.085,
      adjustForInflation: true,
    }),
    document.getElementById("portfolio-forecast")
  );

  const inputMean = document.getElementById(
    "parameter-mean"
  ) as HTMLInputElement;
  const inputStd = document.getElementById("parameter-std") as HTMLInputElement;
  const chartCanvas = document.getElementById("myChart") as HTMLCanvasElement;

  inputMean.value = (appSettings.mean * 100).toString();
  inputStd.value = (appSettings.std * 100).toString();

  initLinkedChart(chartCanvas, inputMean, inputStd);
});
