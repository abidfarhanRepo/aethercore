# autonomous.md — agent instructions for aether project

Purpose
- Provide a concise, machine-readable summary of the current task, conventions, and how small agents should behave when working on the aether project.

Conventions
- Each agent should be small and single-purpose (1-3 days of work). Name format: <area>-<task>-<id> (e.g., backend-auth, frontend-pos, tests-api).
- Agents must announce: start time, task name, working directory, and expected outputs. They must also announce completion with outputs and any artifacts (file paths, commits).
- If an agent encounters an error, it must write an error summary to memory/tasks_log.md and notify the orchestrator (main agent).
- Agents should not push secrets to the repo. Use workspace/.env for local secrets.

Task format
- Each task should include: goal, inputs, expected outputs, estimated time, and acceptance criteria.

Example task entry
- goal: implement POST /sales to atomically create sale and decrement inventory
- inputs: DB schema, prisma client
- outputs: API endpoint, unit/integration tests, migration if required
- estimate: 1-2 days
- acceptance: tests pass, manual POS checkout completes

Coordinator
- The main orchestrator (this assistant) spawns agents, records progress to memory/tasks_log.md, and updates memory/autonomous.md with any new conventions.
