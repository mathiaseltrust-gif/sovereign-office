# Sovereign Office Security Invariants

These rules are architectural boundaries. AI prompts, dashboards, connectors, MCP clients, and service integrations do not override them.

## Enforced in this change

1. **Service identities are not Office officers.** Machine integrations authenticate as service principals with named capabilities and receive no human Office role.
2. **Machine operations are capability-scoped.** M365 intake and fact extraction each require the specific service capability or an authenticated human session.
3. **Private object access is record-scoped.** Generic private-object downloads do not grant blanket access based on trustee/officer/admin-style role titles.
4. **Missing object ACL metadata defaults to deny.**
5. **Public MCP remains public-only.** Its tools and resources must remain in the public namespace and sensitive capabilities remain denied.
6. **Tracked credentials block deployment.** CI scans tracked source/configuration files for committed credentials.
7. **Identity administration is explicit, not inherited.** A trustee role alone cannot change another user's role, authentication requirement, trust privilege, or password.
8. **Security boundary tests block deployment.** CI runs the API security test suite before production builds.

## Required before internal MCP expansion

- Action-bound, single-use human approvals for external or irreversible actions.
- A capability resolver shared by UI, API, MCP, listeners, and automation.
- A generalized document association ledger with authorization-aware projections.
- Explicit policy-change authority separated from the policy being enforced.
- Production-safe post-deploy authorization probes and an internal verification-status view.
- Rotation of any credential that has previously appeared in repository history.

## Verification rule

A boundary is not considered verified merely because a UI hides an action. The backend/API path must reject unauthorized requests and the test suite must exercise that denial.
