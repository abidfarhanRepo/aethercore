# Deploy Scripts

This folder contains organization provisioning and disaster-recovery helper scripts.

## Backup and Restore

- scripts/backup-org.sh <ORG_NAME>
  - Creates a timestamped Postgres SQL gzip backup and Redis dump snapshot for one org.
- scripts/backup-all.sh
  - Runs org backups for all folders in deploy/orgs and produces a pass/fail summary.
- scripts/restore-org.sh <ORG_NAME> <backup-file>
  - Restores an org database from a backup and reapplies Prisma migrations.
- scripts/simulate-restore-drill.sh
  - Validates latest backups per org by restoring into temporary drill stacks and running smoke checks.

## Update Workflows

- scripts/update-org.sh <ORG_NAME>
  - Runs backup, pre-gates, image pull, rolling restart, migrations, health polling, rollback-on-failure, and post-gate evidence.
- scripts/update-all.sh [--continue-on-error]
  - Iterates org updates using update-org.sh, stops on first failure by default, or continues and summarizes failures.

## Cron Example

Use this example to run full backups every day at 02:00:

0 2 * * * /path/to/backup-all.sh
