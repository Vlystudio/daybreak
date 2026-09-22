# Database evidence

`fresh-and-upgrade-test.json` is generated only after the complete local or
isolated-remote database suite passes. Schema version 3 records the exact commit,
selected mode, sanitized database identity, two clean initializations, the full
upgrade matrix, two complete pgTAP executions, and explicit Auth/Storage/staging
verification boundaries. Credentials, connection strings, hostnames, and raw
remote project refs are forbidden.

Provisioning and execution: `docs/database-runtime-testing.md`.
