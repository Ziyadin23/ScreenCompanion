# Proposal

## Why

A small bug with an agreed expected result currently needs an OpenSpec plan before a contributor can write its regression test. SC also ships skills for three coding clients while maintainers use Codex in Orca.

## What Changes

Use the GitHub issue, a failing then passing regression test, and an independently reviewed PR for a small, well-understood fix. Use OpenSpec for larger or multi-session changes and continue work already owned by an active plan. Keep the six Codex skills and remove the Claude Code and OpenCode copies.

## Capabilities

This changes contributor guidance and agent integrations. The change declares `skip_specs: true`.

## Impact

Contributor and agent entry points, OpenSpec configuration and client skill files. The optional LangGraph runner keeps its own execution workflow. [Issue #87](https://github.com/Ziyadin23/ScreenCompanion/issues/87)
