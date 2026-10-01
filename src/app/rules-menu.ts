import { RULE_LIMITS, type MatchRules } from '../core';

/** A row in the rules overlay on character select. */
export type RuleField = 'mode' | 'stocks' | 'time';

export interface RuleRow {
  readonly field: RuleField;
  readonly label: string;
}

/** Steps `value` by `delta`, staying within [min, max]. */
const step = (value: number, delta: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value + delta));

/** The rules after pressing left (-1) or right (+1) on one row. */
export const adjustRule = (rules: MatchRules, field: RuleField, delta: 1 | -1): MatchRules => {
  switch (field) {
    case 'mode':
      return { ...rules, mode: rules.mode === 'stock' ? 'time' : 'stock' };
    case 'stocks':
      return {
        ...rules,
        stocks: step(rules.stocks, delta, RULE_LIMITS.minStocks, RULE_LIMITS.maxStocks),
      };
    case 'time':
      return {
        ...rules,
        timeLimitSeconds: step(
          rules.timeLimitSeconds,
          delta * RULE_LIMITS.timeLimitStepSeconds,
          RULE_LIMITS.minTimeLimitSeconds,
          RULE_LIMITS.maxTimeLimitSeconds,
        ),
      };
  }
};

/** The rows to show: the rule, then only the setting that rule uses. */
export const ruleRows = (rules: MatchRules): RuleRow[] => [
  { field: 'mode', label: `Rule: ${rules.mode === 'stock' ? 'Stock' : 'Time'}` },
  rules.mode === 'stock'
    ? { field: 'stocks', label: `Stocks: ${rules.stocks}` }
    : { field: 'time', label: `Time: ${rules.timeLimitSeconds / 60} min` },
];

/** One line for the top bar of character select, e.g. "Stock · 3 lives". */
export const ruleSummary = (rules: MatchRules): string =>
  rules.mode === 'stock'
    ? `Stock · ${rules.stocks} ${rules.stocks === 1 ? 'life' : 'lives'}`
    : `Time · ${rules.timeLimitSeconds / 60} min`;
