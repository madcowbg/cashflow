import * as _ from "lodash";

export interface Recursive<E> {
  current: E;

  next(): Recursive<E>;
}

export function asArray<T>(evolution: Recursive<T>, takeCnt: number): T[] {
  const result: T[] = [];
  for (let i = 0; i < takeCnt; i++) {
    result.push(evolution.current);
    evolution = evolution.next();
  }
  return result;
}

export function evolvingState<S, T, A>(
  fun: (currentState: S, ...currentArgs: A[]) => [T, S],
  initialState: S,
  ...initialArgs: Recursive<A>[]
): Recursive<T> {
  // TODO is it possible to do static check with varargs?
  if (fun.length - 1 != initialArgs.length) {
    throw new Error(
      `function has ${fun.length - 1} arguments but got passed ${
        initialArgs.length
      } params!`
    );
  }

  function sizesAssumedCorrect(state: S, ...args: Recursive<A>[]) {
    const currentAndState: [T, S] = fun(
      state,
      ..._.map(args, (ar) => ar.current)
    );
    return {
      current: currentAndState[0],
      next: () =>
        sizesAssumedCorrect(
          currentAndState[1],
          ..._.map(args, (ar) => ar.next())
        ),
    };
  }

  return sizesAssumedCorrect(initialState, ...initialArgs);
}

export function map2<S, T, A, B>(
  fun: (currentState: S, a: A, b: B) => [T, S],
  initialState: S,
  a: Recursive<A>,
  b: Recursive<B>
): Recursive<T> {
  return evolvingState<S, T, { a: A; b: B }>(
    (t, val) => fun(t, val.a, val.b),
    initialState,
    join(a, b)
  );
}

export function map3<S, T, A, B, C>(
  fun: (currentState: S, a: A, b: B, c: C) => [T, S],
  initialState: S,
  a: Recursive<A>,
  b: Recursive<B>,
  c: Recursive<C>
): Recursive<T> {
  return map2(
    (currentState, ab, c) => fun(currentState, ab.a, ab.b, c),
    initialState,
    join(a, b),
    c
  );
}

function join<A, B>(
  a: Recursive<A>,
  b: Recursive<B>
): Recursive<{ a: A; b: B }> {
  return {
    current: { a: a.current, b: b.current },
    next: () => join(a.next(), b.next()),
  };
}

export function map<T, A>(
  fun: (currentState: number, a: A) => T,
  initialTime: number,
  a: Recursive<A>
) {
  return evolvingState<number, T, A>(
    (t, a: A) => [fun(t, a), t + 1],
    initialTime,
    a
  );
}

export function constant<T>(val: T): Recursive<T> {
  return {
    current: val,
    next: () => constant(val),
  };
}
