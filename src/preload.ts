// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

import * as _ from "lodash"
import {Chart, ChartData, ChartDataSets} from "chart.js"

import * as d3 from "d3-random"

interface RandomSeriesData {
    returnsData: number[],
    pricesData: number[],
    days: string[]
}

function calcRandom(mean: number, std: number): RandomSeriesData {
    const normalRNG = d3.randomNormal.source(d3.randomLcg(1251241))(mean, std);

    const returnsData = _.map(_.range(0, 100), normalRNG);

    const pricesData = [100];
    for (let i = 0; i < returnsData.length; i++) {
        pricesData.push(pricesData[pricesData.length - 1] * (1 + returnsData[i]));
    }

    const days = _.map(_.range(0, 100), (v) => "day " + (v + 1));

    return {returnsData, pricesData, days}
}

function toChartData(data: RandomSeriesData): ChartData {
    return {
        labels: data.days,
        datasets: [{
            label: 'Price',
            data: data.pricesData,
            borderWidth: 1
        }]
    }
}

function createCharts(element: HTMLCanvasElement, data: ChartData): Chart {
    const ctx = element.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            maintainAspectRatio: true,
            responsive: false
        }
    });

    chart.update({duration: 500, lazy: false, easing: 'linear'});

    console.log(chart.getDatasetMeta(0));

    return chart;
}

function updateChart(chart: Chart, inputMean: HTMLInputElement, inputStd: HTMLInputElement): () => void {
    const dataset: ChartDataSets = chart.data.datasets[0];

    return () => {
        const percentMean = parseFloat(inputMean.value) / 100;
        const percentStd = parseFloat(inputStd.value) / 100;

        console.log(`setting mean to ${percentMean}% and stdev to ${percentStd}%`);

        const randomData = calcRandom(percentMean, percentStd);

        dataset.data = randomData.pricesData;
        chart.update();
    }
}

function initLinkedChart(chartCanvas: HTMLCanvasElement, inputMean: HTMLInputElement, inputStd: HTMLInputElement): void {
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
        replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions]);
    }

    const inputMean = document.getElementById("parameter-mean") as HTMLInputElement;
    const inputStd = document.getElementById("parameter-std") as HTMLInputElement;
    const chartCanvas = document.getElementById('myChart') as HTMLCanvasElement;

    initLinkedChart(chartCanvas, inputMean, inputStd);
});
