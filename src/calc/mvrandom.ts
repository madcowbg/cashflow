import _ = require("lodash");
import {
  column,
  diag,
  eigs,
  matrix,
  Matrix,
  multiply,
  sqrt,
  transpose,
} from "mathjs";

import { Process } from "./processes";
import { Random, standard_white_noise } from "./random_processes";

function toMatrix(cov: {
  [p: string]: { [p: string]: number };
}): [string[], Matrix] {
  const keys = _.keys(cov).sort();
  const sorter = (x: string) => {
    const cx = cov[x];
    return _.map(keys, (y) => cx[y]);
  };

  return [keys, matrix(_.map(keys, sorter))];
}

function sqrt_symm(covmatrix: Matrix): Matrix {
  const { values: D, vectors: V } = eigs(covmatrix);
  // V' \sqrt D V is the symmetric root, sims are more stable
  return multiply(multiply(transpose(V), diag(sqrt(D as Matrix))), V) as Matrix;
}

const SEED_OFFSET_PER_IDX = 27644437;

function processForVariable(
  independent: Process<number>[]
): (col: number[]) => Process<number> {
  return (col: number[]) => {
    const scaledProcess = (independentSims: Process<number>[]) => {
      return {
        v: _.sum(
          _.zipWith(
            col,
            _.map(independentSims, (i) => i.v),
            (a, b) => a * b
          )
        ),
        get evolve(): Process<number> {
          return scaledProcess(_.map(independentSims, (i) => i.evolve));
        },
      };
    };
    return scaledProcess(independent);
  };
}

export function mvnsims(cov: {
  [x: string]: { [y: string]: number };
}): Random<{ [x: string]: Process<number> }> {
  const [keys, covmatrix] = toMatrix(cov);
  const dependenceTransformation = sqrt_symm(covmatrix);
  const simulatorMultiplications = _.map(
    _.range(0, keys.length),
    (i) => column(dependenceTransformation, i).valueOf() as number[]
  );

  return {
    pick(seed: number): { [x: string]: Process<number> } {
      const independent = _.map(_.range(0, keys.length), (idx) =>
        standard_white_noise.pick(seed + idx * SEED_OFFSET_PER_IDX)
      );

      return _.zipObject<Process<number>>(
        keys,
        _.map(simulatorMultiplications, (col) =>
          processForVariable(independent)(col)
        )
      );
    },
  };
}
