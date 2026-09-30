# 0001 Record architecture decisions

- Status: Accepted
- Date: 2026-09-30

## Context

Humans and AI agents both work on this code. Agents start every session without memory, so
the reasons behind the structure must be written down or they get "helpfully" undone.

## Decision

We record decisions that are hard to reverse as short Architecture Decision Records in
`docs/adr/`, using `template.md`. Agents may propose ADRs; only a human accepts them.

## Consequences

A little writing per decision. In return, agents and new contributors can find out why
things are the way they are, and we can see when a decision is being revisited.

## Alternatives considered

- Decisions only in chat or PR descriptions: lost quickly, invisible to agents.
- One big design document: goes stale, hard to tell what was decided when.
