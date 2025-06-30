#!/bin/bash

# Bulk update API routes to use global auth
echo "🔄 Starting bulk auth migration..."

# List of API routes to update (critical ones first)
API_ROUTES=(
    "app/api/analytics/overview/route.ts"
    "app/api/analytics/route.ts"
    "app/api/dashboard/stats/route.ts"
    "app/api/gmail/route.ts"
    "app/api/calendar/route.ts"
    "app/api/content/route.ts"
    "app/api/customers/route.ts"
    "app/api/projects/route.ts"
    "app/api/tasks/route.ts"
    "app/api/leads/route.ts"
    "app/api/notifications/route.ts"
    "app/api/workspaces/route.ts"
    "app/api/team-members/route.ts"
)

# Update each file
for route in "${API_ROUTES[@]}"; do
    if [ -f "$route" ]; then
        echo "📝 Updating $route"
        
        # Add withAuth import if not already present
        if ! grep -q "withAuth" "$route"; then
            sed -i '' '1i\
import { withAuth } from "@/lib/global-auth";
' "$route"
        fi
        
        # Replace getServerSession import
        sed -i '' 's/import { getServerSession } from .next-auth./\/\/ import { getServerSession } from "next-auth"/g' "$route"
        sed -i '' 's/getServerSession/\/\/ getServerSession/g' "$route"
        
        echo "✅ Updated $route"
    else
        echo "❌ File not found: $route"
    fi
done

echo "🎉 Bulk auth migration completed!"
