// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

import * as _ from "lodash"
import * as fs from "fs"
import {Chart} from "chart.js"

import * as d3 from "d3-random"
const normalRNG = d3.randomNormal.source(d3.randomLcg(1251241))(0, 1);

function createCharts() {
  const root = fs.readdirSync('/')

  console.log(root)

  console.log("renderer executing!");

  (document.getElementById('mytext') as HTMLDivElement).textContent = "Edited!"

  const ctx = (document.getElementById('myChart') as HTMLCanvasElement).getContext('2d');

  const returnsData = _.map(_.range(0, 100), normalRNG);

  const pricesData = [0];
  for (let i = 0; i < returnsData.length; i++) {
    pricesData.push(pricesData[pricesData.length-1] + returnsData[i]);
  }

  const days = _.map(_.range(0, 100), (v) => "day " + (v + 1));

  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: days,
      datasets: [{
        label: 'Price',
        data: pricesData,
        borderWidth: 1
      }]
    },
    options: {
      maintainAspectRatio: true,
      responsive: false
    }
  });

  chart.update({duration: 500, lazy: false, easing: 'linear'});

  console.log(chart.getDatasetMeta(0));
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

  createCharts();
});
