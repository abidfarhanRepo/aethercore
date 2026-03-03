# MEMORY — persistent assistant memory (aether project)

- Project name: aether
- Created: 2026-03-02
- Stack: React + TypeScript, Fastify, Prisma, PostgreSQL (Neon), Redis placeholder
- Current DB: Neon Postgres provided by user (connection stored in workspace/.env)
- Initial admin: admin@aether.dev (seeded)

Notes:
- The assistant will append to memory/tasks_log.md for agent events.
- autonomous.md contains agent conventions and should be consulted by spawned agents.
