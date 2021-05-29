import * as _ from "lodash";

export interface Process<T> {
  readonly v: T;
  evolve(): Process<T>;
}

export function constant<T>(value: T): Process<T> {
  return {
    v: value,
    evolve: function () {
      return this;
    },
  };
}

// fixme this should be re-dobe with infering parameters in typestcript 4.0+
export function fmap<A, R>(f: (a: A) => R): (pa: Process<A>) => Process<R>;
export function fmap<A, B, R>(
  f: (a: A, b: B) => R
): (pa: Process<A>, pb: Process<B>) => Process<R>;
export function fmap<A, B, C, R>(
  f: (a: A, b: B, c: C) => R
): (pa: Process<A>, pb: Process<B>, pc: Process<C>) => Process<R>;
export function fmap<A, B, C, D, R>(
  f: (a: A, b: B, c: C, d: D) => R
): (
  pa: Process<A>,
  pb: Process<B>,
  pc: Process<C>,
  pd: Process<D>
) => Process<R>;
export function fmap<A, B, C, D, E, R>(
  f: (a: A, b: B, c: C, d: D, e: E) => R
): (
  pa: Process<A>,
  pb: Process<B>,
  pc: Process<C>,
  pd: Process<D>,
  pe: Process<E>
) => Process<R>;

export function fmap<R>(
  transform: (...args: unknown[]) => R
): (...args: Process<unknown>[]) => Process<R> {
  const result = (...args: Process<unknown>[]) => ({
    v: transform(...args.map((p: Process<unknown>) => p.v)),
    evolve: () => result(...args.map((p: Process<unknown>) => p.evolve())),
  });
  return result;
}

export function count(starting: number): Process<number> {
  return stateful((u: number, v: number) => u + v)(starting, constant(1));
}

export function stateful<S>(stateF: (prev: S) => S): (prev: S) => Process<S>;

export function stateful<A, S>(
  stateF: (prev: S, a: A) => S
): (prev: S, pa: Process<A>) => Process<S>;
export function stateful<A, B, S>(
  stateF: (prev: S, a: A, b: B) => S
): (prev: S, pa: Process<A>, pb: Process<B>) => Process<S>;
export function stateful<A, B, C, S>(
  stateF: (prev: S, a: A, b: B, c: C) => S
): (prev: S, pa: Process<A>, pb: Process<B>, pc: Process<C>) => Process<S>;
export function stateful<A, B, C, D, S>(
  stateF: (prev: S, a: A, b: B, c: C, d: D) => S
): (
  prev: S,
  pa: Process<A>,
  pb: Process<B>,
  pc: Process<C>,
  pd: Process<D>
) => Process<S>;
export function stateful<A, B, C, D, E, S>(
  stateF: (prev: S, a: A, b: B, c: C, d: D, e: E) => S
): (
  prev: S,
  pa: Process<A>,
  pb: Process<B>,
  pc: Process<C>,
  pd: Process<D>,
  pe: Process<E>
) => Process<S>;

export function stateful<T, S>(
  stateF: (prev: S, ...v: any[]) => S
): (prev: S, ...process: Process<any>[]) => Process<S> {
  const statefulWithF = (prev: S, ...process: Process<any>[]) => ({
    v: prev,
    evolve: () =>
      statefulWithF(
        stateF(prev, ...process.map((p) => p.v)),
        ...process.map((p) => p.evolve())
      ),
  });
  return statefulWithF;
}

export function take(num: number): <V>(p: Process<V>) => V[] {
  return <V>(p: Process<V>) => {
    const res: V[] = [];
    for (let i = 0; i < num; i++) {
      res.push(p.v);
      p = p.evolve();
    }
    return res;
  };
}

export function sample<A>(frequency: number): (pa: Process<A>) => Process<A> {
  return aggregate(frequency, (...args: A[]) => args[args.length - 1]);
}

export function aggregate<A>(
  frequency: number,
  agg: (...args: A[]) => A
): (pa: Process<A>) => Process<A> {
  if (frequency <= 0) {
    throw new Error(`need positive frequency to sample, got ${frequency}`);
  }
  function skip(pa: Process<A>): [Process<A>, A[]] {
    const args = [];
    for (let i = 0; i < frequency; i++) {
      args.push(pa.v);
      pa = pa.evolve();
    }
    return [pa, args];
  }
  const sampler = (pa: Process<A>) => {
    const [evolvedPA, elementsInbetween] = skip(pa);
    return {
      v: agg(...elementsInbetween),
      evolve: () => sampler(evolvedPA),
    };
  };
  return sampler;
}
