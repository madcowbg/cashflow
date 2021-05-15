// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
import * as _ from "lodash";
import { Chart, ChartData, ChartDataSets } from "chart.js";
import "chartjs-plugin-colorschemes";

import { calcRandom, RandomSeriesData } from "./calc/randomdata";

import { appSettings, saveSettings } from "./settings";

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

  chart.update({ duration: 500, lazy: false, easing: "linear" });

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

interface EconomicParams {
  currentDividendYield?: number;
  realDividendGrowth?: number;
  inflation?: number;
  marketPriceOf100DollarInvestment?: number;
  discountRate?: number;
}

function nominalDividends(
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

function realDividends(
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

function discountedDividends(
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

function chain(firstOp: () => void, secondOp: () => void): () => void {
  return () => {
    firstOp();
    secondOp();
  };
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

  const btnSaveSettings = document.getElementById(
    "global-save-settings"
  ) as HTMLButtonElement;
  btnSaveSettings.addEventListener("click", saveSettings);

  const discountRateField = document.getElementById(
    "global-parameter-discount-rate"
  ) as HTMLInputElement;
  const marketPriceOf100DollarInvestmentField = document.getElementById(
    "global-parameter-market-price"
  ) as HTMLInputElement;

  const currentDividendYieldField = document.getElementById(
    "global-parameter-dividend-yield"
  ) as HTMLInputElement;
  const realDividendGrowthField = document.getElementById(
    "global-parameter-dividend-growth"
  ) as HTMLInputElement;
  const inflationField = document.getElementById(
    "global-parameter-inflation"
  ) as HTMLInputElement;

  function recalculateMarketPriceOf1Dollar() {
    const params = readParameters();

    const marketPriceOf100DollarInvestment =
      (100 * params.currentDividendYield) /
      (params.discountRate - (params.realDividendGrowth + params.inflation));

    marketPriceOf100DollarInvestmentField.value =
      marketPriceOf100DollarInvestment.toFixed(2);
  }

  function recalculateDiscountRateField() {
    const params = readParameters();
    const discountRate =
      params.realDividendGrowth +
      params.inflation +
      (100 * params.currentDividendYield) /
        params.marketPriceOf100DollarInvestment;

    discountRateField.value = (discountRate * 100).toFixed(2);
  }

  function readParameters(): EconomicParams {
    return {
      currentDividendYield: parseFloat(currentDividendYieldField.value) / 100,
      realDividendGrowth: parseFloat(realDividendGrowthField.value) / 100,
      inflation: parseFloat(inflationField.value) / 100,
      marketPriceOf100DollarInvestment: parseFloat(
        marketPriceOf100DollarInvestmentField.value
      ),
      discountRate: parseFloat(discountRateField.value) / 100,
    };
  }

  discountRateField.addEventListener(
    "change",
    chain(recalculateMarketPriceOf1Dollar, recalculateChart)
  );
  marketPriceOf100DollarInvestmentField.addEventListener(
    "change",
    chain(recalculateDiscountRateField, recalculateChart)
  );

  currentDividendYieldField.addEventListener(
    "change",
    chain(recalculateMarketPriceOf1Dollar, recalculateChart)
  );
  realDividendGrowthField.addEventListener(
    "change",
    chain(recalculateMarketPriceOf1Dollar, recalculateChart)
  );
  inflationField.addEventListener(
    "change",
    chain(recalculateMarketPriceOf1Dollar, recalculateChart)
  );

  recalculateMarketPriceOf1Dollar();

  const summaryChartCanvas = document.getElementById(
    "summary-chart"
  ) as HTMLCanvasElement;
  const ctx = summaryChartCanvas.getContext("2d");

  const monthsIdx = _.range(0, 100);
  const datasets: {
    dividends_nominal: ChartDataSets;
    dividends_real: ChartDataSets;
    dividends_discounted: ChartDataSets;
  } = {
    dividends_nominal: {
      label: "Nominal dividends",
      yAxisID: "$",
      data: [],
    },
    dividends_real: {
      label: "Real dividends",
      yAxisID: "$",
      data: [],
    },
    dividends_discounted: {
      label: "Discounted dividends",
      yAxisID: "$",
      data: [],
    },
  };

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: _.map(_.range(0, 100), (i) => `month ${i + 1}`),
      datasets: [
        datasets.dividends_nominal,
        datasets.dividends_real,
        datasets.dividends_discounted,
      ],
    },

    options: {
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
      plugins: {
        colorschemes: {
          scheme: "office.Focus6",
        },
      },
    },
  });

  function recalculateChart() {
    const econParameters = readParameters();
    datasets.dividends_nominal.data = nominalDividends(
      monthsIdx,
      econParameters
    );
    datasets.dividends_real.data = realDividends(monthsIdx, econParameters);
    datasets.dividends_discounted.data = discountedDividends(
      monthsIdx,
      econParameters
    );
    chart.update();
  }

  recalculateChart();

  const inputMean = document.getElementById(
    "parameter-mean"
  ) as HTMLInputElement;
  const inputStd = document.getElementById("parameter-std") as HTMLInputElement;
  const chartCanvas = document.getElementById("myChart") as HTMLCanvasElement;

  inputMean.value = (appSettings.mean * 100).toString();
  inputStd.value = (appSettings.std * 100).toString();

  initLinkedChart(chartCanvas, inputMean, inputStd);
});
