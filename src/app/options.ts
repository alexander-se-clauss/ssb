import { RULE_LIMITS, type MatchRules } from '../core';

/** A row on the options screen. */
export type RuleField = 'mode' | 'stocks' | 'time';

export interface OptionRow {
  readonly field: RuleField;
  readonly label: string;
}

/** Steps `value` by `delta` within [min, max], wrapping around at both ends. */
const cycle = (value: number, delta: number, min: number, max: number): number => {
  const next = value + delta;
  if (next > max) return min;
  if (next < min) return max;
  return next;
};

/** The rules after pressing left (-1) or right (+1) on one row. */
export const adjustRule = (rules: MatchRules, field: RuleField, delta: 1 | -1): MatchRules => {
  switch (field) {
    case 'mode':
      return { ...rules, mode: rules.mode === 'stock' ? 'time' : 'stock' };
    case 'stocks':
      return {
        ...rules,
        stocks: cycle(rules.stocks, delta, RULE_LIMITS.minStocks, RULE_LIMITS.maxStocks),
      };
    case 'time':
      return {
        ...rules,
        timeLimitSeconds: cycle(
          rules.timeLimitSeconds,
          delta * RULE_LIMITS.timeLimitStepSeconds,
          RULE_LIMITS.minTimeLimitSeconds,
          RULE_LIMITS.maxTimeLimitSeconds,
        ),
      };
  }
};

/** The rows to show: the rule, then only the setting that rule uses. */
export const optionRows = (rules: MatchRules): OptionRow[] => [
  { field: 'mode', label: `Rule: ${rules.mode === 'stock' ? 'Stock' : 'Time'}` },
  rules.mode === 'stock'
    ? { field: 'stocks', label: `Stocks: ${rules.stocks}` }
    : { field: 'time', label: `Time: ${rules.timeLimitSeconds / 60} min` },
];
