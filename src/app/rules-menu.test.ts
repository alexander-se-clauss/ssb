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

  it('raises and lowers the lives between 1 and 99, stopping at the ends', () => {
    expect(RULE_LIMITS).toMatchObject({ minStocks: 1, maxStocks: 99 });
    expect(adjustRule(DEFAULT_RULES, 'stocks', 1).stocks).toBe(DEFAULT_RULES.stocks + 1);
    expect(adjustRule(DEFAULT_RULES, 'stocks', -1).stocks).toBe(DEFAULT_RULES.stocks - 1);
    expect(adjustRule({ ...DEFAULT_RULES, stocks: 99 }, 'stocks', 1).stocks).toBe(99);
    expect(adjustRule({ ...DEFAULT_RULES, stocks: 1 }, 'stocks', -1).stocks).toBe(1);
  });

  it('raises and lowers the time by a minute between 1 and 60 minutes, stopping at the ends', () => {
    expect(RULE_LIMITS).toMatchObject({
      minTimeLimitSeconds: 60,
      maxTimeLimitSeconds: 3600,
      timeLimitStepSeconds: 60,
    });
    expect(adjustRule(DEFAULT_RULES, 'time', 1).timeLimitSeconds).toBe(180);
    expect(adjustRule(DEFAULT_RULES, 'time', -1).timeLimitSeconds).toBe(60);
    const max = { ...DEFAULT_RULES, timeLimitSeconds: 3600 };
    expect(adjustRule(max, 'time', 1).timeLimitSeconds).toBe(3600);
    const min = { ...DEFAULT_RULES, timeLimitSeconds: 60 };
    expect(adjustRule(min, 'time', -1).timeLimitSeconds).toBe(60);
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
