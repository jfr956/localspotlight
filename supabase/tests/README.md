# Supabase Tests

This directory contains tests for the Supabase database, RLS policies, and integration tests.

## Test Files

### `rls_test.sql`

Row-Level Security tests to ensure:

- Complete data isolation between organizations
- Role-based access control works correctly
- Cross-org queries are blocked
- Cascade deletes respect org boundaries

## Running Tests

### Manual SQL Tests

```bash
# Connect to local database
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Run test file
\i supabase/tests/rls_test.sql
```

### Automated Tests with Playwright

Create E2E tests that verify RLS policies:

```bash
pnpm test:e2e
```

## Writing RLS Tests

When writing RLS tests, you need to:

1. **Set up test data** in different organizations
2. **Authenticate as different users** using Supabase Auth
3. **Attempt cross-org access** and verify it's blocked
4. **Test role permissions** (viewer, editor, admin, owner)

### Example Test Pattern

```typescript
import { createClient } from "@supabase/supabase-js";

describe("RLS Policies", () => {
  it("should prevent cross-org data access", async () => {
    // Create client for User A (in Org A)
    const clientA = createClient(supabaseUrl, supabaseAnonKey);
    await clientA.auth.signIn({ email: "user-a@test.com" });

    // Try to access Org B's data
    const { data, error } = await clientA.from("gbp_reviews").select("*").eq("org_id", "org-b-id");

    // Should return empty (RLS blocks it)
    expect(data).toEqual([]);
  });
});
```

## Test Checklist

- [ ] Users can only see their own org's data
- [ ] Cross-org queries return empty results (not errors)
- [ ] Viewers can read but not write
- [ ] Editors can read and write but not manage members
- [ ] Admins can manage org settings and members
- [ ] Owners can do everything including delete org
- [ ] Service role bypasses RLS (for system operations)
- [ ] Cascade deletes work correctly
- [ ] RLS works for all tables with org_id
- [ ] Performance is acceptable (indexes help RLS queries)

## Testing Against Cloud

Before migrating to production:

```bash
# Link to cloud project
supabase link --project-ref your-project-ref

# Run tests against cloud
SUPABASE_URL=https://your-project.supabase.co pnpm test:e2e
```

## Security Verification

Run these queries to verify RLS is enabled:

```sql
-- Check RLS is enabled on all tables
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;

-- Should return no rows (all tables have RLS)

-- Check policies exist
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Should show policies for all tables
```

## Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Testing RLS Policies](https://supabase.com/docs/guides/database/testing)
- [Security Best Practices](https://supabase.com/docs/guides/database/securing-your-data)
