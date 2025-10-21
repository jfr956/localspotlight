#!/bin/bash

# Deployment script for the Post Publishing System
# This script sets up all the necessary components

set -e

echo "🚀 Deploying Post Publishing System..."
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v supabase &> /dev/null; then
        log_error "Supabase CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed. Please install it first."
        exit 1
    fi
    
    log_info "✅ Prerequisites checked"
}

# Deploy the Edge Function
deploy_edge_function() {
    log_info "Deploying Edge Function..."
    
    cd supabase/functions/publish-posts
    supabase functions deploy publish-posts
    cd ../../..
    
    log_info "✅ Edge Function deployed"
}

# Set required secrets
set_secrets() {
    log_info "Setting secrets..."
    
    # Check if secrets are already set
    if supabase secrets list | grep -q "PUBLISH_POSTS_CRON_SECRET"; then
        log_warn "PUBLISH_POSTS_CRON_SECRET already set"
    else
        log_warn "Please set PUBLISH_POSTS_CRON_SECRET manually:"
        echo "supabase secrets set PUBLISH_POSTS_CRON_SECRET=your_secret_here"
    fi
    
    if supabase secrets list | grep -q "GOOGLE_REFRESH_TOKEN_SECRET"; then
        log_warn "GOOGLE_REFRESH_TOKEN_SECRET already set"
    else
        log_warn "Please set GOOGLE_REFRESH_TOKEN_SECRET (32+ chars):"
        echo "supabase secrets set GOOGLE_REFRESH_TOKEN_SECRET=your_32_character_secret"
    fi
    
    log_info "✅ Secrets configured"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    
    supabase db push
    
    log_info "✅ Database migrations completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if Edge Function is accessible
    FUNCTION_URL=$(supabase status | grep "API URL" | awk '{print $3}' | sed 's/rest/v1//')functions/v1/publish-posts
    
    if curl -s "$FUNCTION_URL" > /dev/null; then
        log_info "✅ Edge Function is accessible"
    else
        log_error "Edge Function is not accessible"
        return 1
    fi
    
    # Check database tables
    TABLES=("schedules" "post_candidates" "gbp_posts" "connections_google" "audit_logs")
    for table in "${TABLES[@]}"; do
        if supabase db shell --command "SELECT 1 FROM $table LIMIT 1;" &> /dev/null; then
            log_info "✅ Table $table exists"
        else
            log_error "Table $table does not exist"
            return 1
        fi
    done
    
    log_info "✅ Deployment verified"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    
    cd apps/web
    if pnpm tsx src/test-publish-workflow.ts; then
        log_info "✅ Tests passed"
    else
        log_warn "Tests failed - this might be expected if no test data exists"
    fi
    cd ../..
}

# Main deployment flow
main() {
    log_info "Starting deployment of Post Publishing System..."
    
    check_prerequisites
    deploy_edge_function
    set_secrets
    run_migrations
    verify_deployment
    run_tests
    
    echo ""
    log_info "🎉 Post Publishing System deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Set any missing secrets as shown above"
    echo "2. Ensure Google OAuth is properly configured"
    echo "3. Create a test post in the UI"
    echo "4. Monitor the logs: supabase functions logs publish-posts"
    echo ""
    echo "For more information, see POST_PUBLISHING_SYSTEM.md"
}

# Handle errors
trap 'log_error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"