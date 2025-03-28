#!/bin/bash

# Ensure the script stops on first error
set -e

echo "Starting project migration from old CRM..."

# Run the migration script
npx ts-node scripts/migrate-old-crm.ts

echo "Migration completed successfully!" 