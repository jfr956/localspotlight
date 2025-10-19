# Supabase Cloud Migration Guide

This guide helps you migrate from local Supabase development to production on Supabase Cloud.

## Overview

LocalSpotlight is designed for a **local-first development workflow** with **seamless cloud migration**. You develop and test everything locally, then push your schema and migrations to the cloud when ready.

## Prerequisites

- [ ] Local Supabase running successfully
- [ ] All migrations tested locally
- [ ] RLS policies verified
- [ ] Application working with local database
- [ ] Docker still running (for final testing)

## Step-by-Step Migration

### 1. Create Supabase Cloud Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Choose your organization (or create one)
4. Fill in project details:
   - **Name**: LocalSpotlight Production
   - **Database Password**: Use a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Plan**: Start with Free tier, upgrade as needed

5. Wait ~2 minutes for provisioning

### 2. Save Cloud Credentials

Once provisioned, go to **Project Settings → API**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Important:** Never commit these to version control!

### 3. Link Local Project to Cloud

```bash
# Login to Supabase CLI
supabase login

# Link your local project to the cloud project
supabase link --project-ref your-project-ref
```

You'll be prompted for your database password.

### 4. Review Migration Diff

Before pushing, review what will change:

```bash
# See what migrations will be applied
supabase db diff --linked

# Or compare schemas
supabase db diff --schema public
```

### 5. Push Migrations to Cloud

```bash
# Push all local migrations to cloud
supabase db push

# Or for more control:
pnpm db:push
```

This will:

1. Connect to your cloud database
2. Apply all migrations in order
3. Create all tables with RLS enabled
4. Set up indexes and triggers
5. Apply security policies

### 6. Verify Cloud Database

```bash
# Check remote database status
supabase db remote status

# Or connect directly
psql "postgresql://postgres:[YOUR-PASSWORD]@db.your-project-ref.supabase.co:5432/postgres"
```

Verify:

- [ ] All tables exist
- [ ] RLS is enabled on all tables
- [ ] Indexes are created
- [ ] Functions and triggers work

### 7. Test Cloud Connection Locally

Update `apps/web/.env.local` temporarily:

```env
# Comment out local
# NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321

# Use cloud
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<cloud-anon-key>
```

Run your app:

```bash
pnpm dev
```

Test:

- [ ] Authentication works
- [ ] Can create an org
- [ ] Can add users to org
- [ ] RLS prevents cross-org access
- [ ] All queries work as expected

### 8. Configure Cloud Settings

#### Enable Google OAuth

In Supabase Dashboard:

1. **Authentication → Providers → Google**
2. Enable Google provider
3. Add your Google Client ID and Secret
4. Set authorized redirect URLs:
   ```
   https://your-project-ref.supabase.co/auth/v1/callback
   ```

#### Configure Storage Buckets

```bash
# Create buckets via CLI
supabase storage create gbp-media --public false
supabase storage create generated-images --public true

# Or via Dashboard: Storage → New Bucket
```

RLS policies for storage:

```sql
-- Allow org members to upload media
create policy "Users can upload to their org's folder"
  on storage.objects for insert
  with check (
    bucket_id = 'gbp-media'
    and (storage.foldername(name))[1] in (
      select org_id::text from org_members where user_id = auth.uid()
    )
  );

-- Apply similar policies for read/update/delete
```

#### Set Environment Variables

In Supabase Dashboard: **Project Settings → Edge Functions → Environment Variables**

Add:

- `OPENAI_API_KEY`
- `RUNWARE_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### 9. Configure Rate Limits

In Supabase Dashboard: **Project Settings → API**

Adjust rate limits based on your needs:

- **Anonymous requests**: 100/minute (default)
- **Authenticated requests**: 1000/minute
- **Storage uploads**: 100MB/minute

### 10. Set Up Database Backups

Supabase Pro and above include automatic daily backups.

For manual backups:

```bash
# Backup cloud database
supabase db dump --linked -f backup-$(date +%Y%m%d).sql

# Schedule this in CI/CD or cron
```

### 11. Deploy Your Application

#### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Add environment variables in Vercel Dashboard:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- All other API keys

#### Option B: Other Platforms

Set the same environment variables in:

- Netlify
- Railway
- Render
- Your own server

### 12. Configure Custom Domain (Optional)

In Supabase Dashboard: **Project Settings → General → Custom Domain**

Set up:

- Database domain: `db.yourdomain.com`
- API domain: `api.yourdomain.com`

### 13. Post-Migration Testing

Run comprehensive tests:

```bash
# Unit tests against cloud
SUPABASE_URL=https://your-project-ref.supabase.co pnpm test

# E2E tests against cloud
SUPABASE_URL=https://your-project-ref.supabase.co pnpm test:e2e
```

Test checklist:

- [ ] User authentication
- [ ] Org creation and management
- [ ] Google OAuth connection
- [ ] GBP data sync
- [ ] AI generation
- [ ] Post scheduling
- [ ] Review replies
- [ ] Q&A management
- [ ] Media uploads
- [ ] RLS enforcement
- [ ] Background jobs (if using Supabase Cron)

### 14. Set Up Monitoring

#### Database Monitoring

In Supabase Dashboard: **Database → Performance**

- Monitor query performance
- Set up alerts for slow queries
- Track connection pool usage

#### Error Tracking

Install Sentry or similar:

```bash
pnpm add @sentry/nextjs
```

Configure in `apps/web/next.config.ts`

#### Logging

View logs in Supabase Dashboard:

- **Database → Logs** - Query logs
- **Edge Functions → Logs** - Function logs
- **Authentication → Logs** - Auth events

### 15. Configure Database Maintenance

In Supabase Dashboard: **Database → Extensions**

Enable useful extensions:

- `pg_stat_statements` (query performance)
- `pg_cron` (scheduled jobs)
- `pg_net` (HTTP requests from Postgres)

Set up maintenance tasks:

```sql
-- Clean old audit logs (keep 90 days)
select cron.schedule(
  'cleanup-old-audit-logs',
  '0 2 * * *', -- Daily at 2am
  $$delete from audit_logs where created_at < now() - interval '90 days'$$
);
```

## Rollback Plan

If something goes wrong:

```bash
# Revert to local
# In apps/web/.env.local:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321

# Roll back cloud database
supabase db reset --linked
```

## Ongoing Development

After migration, continue developing locally:

```bash
# Make changes locally
pnpm db:start
supabase migration new add_feature

# Test locally
pnpm dev

# When ready, push to cloud
pnpm db:push
```

## Cost Considerations

### Supabase Cloud Pricing

**Free Tier** (Great for development/MVP):

- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users
- Paused after 1 week of inactivity

**Pro Tier** ($25/month):

- 8 GB database (+ $0.125/GB)
- 100 GB storage (+ $0.021/GB)
- 250 GB bandwidth (+ $0.09/GB)
- Daily backups
- No inactivity pausing
- Advanced monitoring

**Recommendations:**

- Start with Free tier
- Upgrade to Pro when you have 5+ active customers
- Monitor usage in Dashboard

## Security Checklist

Before going live:

- [ ] RLS enabled on ALL tables
- [ ] RLS policies tested and verified
- [ ] Service role key never exposed to client
- [ ] Environment variables secured
- [ ] Google OAuth configured with correct redirect URLs
- [ ] Storage RLS policies in place
- [ ] Rate limiting configured
- [ ] SSL/TLS enforced (automatic with Supabase)
- [ ] Database backups enabled
- [ ] Audit logging active
- [ ] API keys rotated from defaults
- [ ] CORS configured properly
- [ ] JWT expiry set appropriately (default 1 hour)

## Common Issues

### Issue: Migration fails with "relation already exists"

**Solution:** The cloud database may have some tables. Reset it:

```bash
supabase db reset --linked
```

### Issue: RLS blocks all queries

**Solution:** Check if user is authenticated and belongs to an org:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
// Ensure user.id exists in org_members table
```

### Issue: Functions not found

**Solution:** Redeploy functions:

```bash
supabase functions deploy
```

### Issue: Storage uploads fail

**Solution:** Check bucket policies and CORS:

```bash
supabase storage update gbp-media --public false
```

## Support & Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase Discord:** https://discord.supabase.com
- **Status Page:** https://status.supabase.com
- **Project Spec:** `.cursor/plans/local-928c70a6.plan.md`

## Success! 🎉

Once complete, you have:

- ✅ Production database in the cloud
- ✅ All migrations applied
- ✅ RLS enforcing data isolation
- ✅ Application deployed and connected
- ✅ Monitoring and backups configured
- ✅ Local development still working

Your local Supabase instance remains for development, and you can continue the local-first workflow while pushing changes to production when ready.
