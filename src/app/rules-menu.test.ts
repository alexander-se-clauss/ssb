import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, RULE_LIMITS } from '../core';
import { adjustRule, ruleRows, ruleSummary } from './rules-menu';

describe('rules overlay on character select', () => {
  it('switches between stock and time', () => {
    const time = adjustRule(DEFAULT_RULES, 'mode', 1);
    expect(time.mode).toBe('time');
    expect(adjustRule(time, 'mode', 1).mode).toBe('stock');
    expect(adjustRule(DEFAULT_RULES, 'mode', -1).mode).toBe('time');
  });

  it('changes the stock count within its limits, wrapping around', () => {
    expect(adjustRule(DEFAULT_RULES, 'stocks', 1).stocks).toBe(DEFAULT_RULES.stocks + 1);
    const max = { ...DEFAULT_RULES, stocks: RULE_LIMITS.maxStocks };
    expect(adjustRule(max, 'stocks', 1).stocks).toBe(RULE_LIMITS.minStocks);
    const min = { ...DEFAULT_RULES, stocks: RULE_LIMITS.minStocks };
    expect(adjustRule(min, 'stocks', -1).stocks).toBe(RULE_LIMITS.maxStocks);
  });

  it('changes the time limit in steps, wrapping around', () => {
    const next = adjustRule(DEFAULT_RULES, 'time', 1);
    expect(next.timeLimitSeconds).toBe(
      DEFAULT_RULES.timeLimitSeconds + RULE_LIMITS.timeLimitStepSeconds,
    );
    const max = { ...DEFAULT_RULES, timeLimitSeconds: RULE_LIMITS.maxTimeLimitSeconds };
    expect(adjustRule(max, 'time', 1).timeLimitSeconds).toBe(RULE_LIMITS.minTimeLimitSeconds);
  });

  it('shows only the setting that matters for the rule', () => {
    expect(ruleRows(DEFAULT_RULES)).toEqual([
      { field: 'mode', label: 'Rule: Stock' },
      { field: 'stocks', label: 'Stocks: 3' },
    ]);
    expect(ruleRows({ ...DEFAULT_RULES, mode: 'time' })).toEqual([
      { field: 'mode', label: 'Rule: Time' },
      { field: 'time', label: 'Time: 2 min' },
    ]);
  });

  it('sums the rules up in one line for the character select top bar', () => {
    expect(ruleSummary(DEFAULT_RULES)).toBe('Stock · 3 lives');
    expect(ruleSummary({ ...DEFAULT_RULES, stocks: 1 })).toBe('Stock · 1 life');
    expect(ruleSummary({ ...DEFAULT_RULES, mode: 'time' })).toBe('Time · 2 min');
  });
});
