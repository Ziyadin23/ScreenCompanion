# Design

The development guide owns the choice of workflow. For a small bug with clear expected behavior, the GitHub issue owns acceptance and the reviewed PR records the failing and passing test. If scope grows or crosses sessions, use that same issue to start an OpenSpec change. Continue an existing plan when it already owns the work.

Codex runs directly in the Orca worktree. OpenSpec's Codex integration stays under `.agents/skills`. LangGraph users follow the runner's separate instructions. The same review, CI and applicable platform or beta checks apply on either contributor route.
