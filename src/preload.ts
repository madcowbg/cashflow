// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

import {Chart, ChartData, ChartDataSets} from "chart.js"
import {calcRandom, RandomSeriesData} from "./calc/randomdata";

import * as fs from 'fs';
import {app} from "electron";

interface AppSettings {
    mean: number
    std: number
}

const settingsFilename = "settings.json";
let appSettings: AppSettings;
try {
    const fileData = fs.readFileSync(settingsFilename, {encoding: "UTF8"});
    appSettings = JSON.parse(fileData);
} catch {
    appSettings = {} as AppSettings;
}


appSettings.mean = appSettings.mean || 0.0;
appSettings.std = appSettings.std || 0.2;

function saveSettings(): void {
    fs.writeFileSync(settingsFilename, JSON.stringify(appSettings), {encoding: "UTF8"});
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
        appSettings.mean = parseFloat(inputMean.value) / 100;
        appSettings.std = parseFloat(inputStd.value) / 100;

        console.log(`setting mean to ${appSettings.mean}% and stdev to ${appSettings.std}%`);

        const randomData = calcRandom(appSettings.mean, appSettings.std);

        dataset.data = randomData.pricesData;
        chart.update();

        saveSettings();
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

    inputMean.value = (appSettings.mean * 100).toString();
    inputStd.value = (appSettings.std * 100).toString();

    initLinkedChart(chartCanvas, inputMean, inputStd);
});
