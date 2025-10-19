#!/bin/bash

# LocalSpotlight Supabase Setup Script
# This script automates the initial Supabase setup process

set -e  # Exit on error

echo "🚀 LocalSpotlight - Supabase Setup"
echo "===================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker is running"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI is installed"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ Error: pnpm is not installed"
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

echo "✅ pnpm is installed"

# Navigate to project root
cd "$(dirname "$0")/.."

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🗄️  Starting Supabase..."
supabase start

echo ""
echo "✅ Supabase is running!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Copy the keys from the output above to apps/web/.env.local:"
echo "   cp env.example.txt apps/web/.env.local"
echo ""
echo "2. Edit apps/web/.env.local and paste your keys"
echo ""
echo "3. Generate TypeScript types:"
echo "   pnpm db:types"
echo ""
echo "4. Start the development server:"
echo "   pnpm dev"
echo ""
echo "5. Open Supabase Studio:"
echo "   http://127.0.0.1:54323"
echo ""
echo "For more information, see QUICK_START.md"
echo ""

