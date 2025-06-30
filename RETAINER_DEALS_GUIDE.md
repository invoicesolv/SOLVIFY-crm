# Retainer Deals Guide

## Overview

The sales system now supports both **one-time deals** and **monthly retainer deals**, allowing you to calculate revenue on both a total annual basis and month-by-month basis for recurring revenue.

## Deal Types

### One-Time Deals
- Traditional deals with a single payment
- Example: $10,000 website development project
- Contributes to total pipeline value as-is

### Retainer Deals
- Monthly recurring revenue (MRR) deals
- Example: $2,000/month marketing retainer for 12 months
- Contributes $24,000 to total pipeline value
- Contributes $2,000 to Monthly Recurring Revenue

## Key Metrics

### 1. Total Pipeline Value
- **One-time deals**: Full deal value
- **Retainer deals**: Monthly amount × duration in months
- Example: $2,000/mo × 12 months = $24,000

### 2. Monthly Recurring Revenue (MRR)
- Only includes active retainer deals (not closed_lost)
- Sum of all monthly retainer amounts
- Example: 5 retainers at $2,000/mo each = $10,000 MRR

### 3. Annualized Revenue
- Total pipeline value + (MRR × 12 months)
- Gives a yearly projection including both one-time and recurring revenue

## How to Create Retainer Deals

1. **Go to Sales page** → Click "New Deal"
2. **Select Deal Type**: Choose "Monthly Retainer"
3. **Set Monthly Amount**: Enter the monthly retainer fee (e.g., $2,000)
4. **Set Duration**: Enter number of months (e.g., 12)
5. **Set Start Date**: When the retainer begins
6. **Save**: The system automatically calculates:
   - Total deal value: $2,000 × 12 = $24,000
   - Monthly contribution to MRR: $2,000

## Deal Board Features

### Visual Indicators
- Retainer deals show an "MRR" badge
- Monthly amount is displayed with "/mo" suffix
- Total value is shown below: "($24,000 total, 12mo)"

### Stage Calculations
- Each stage shows total value including calculated retainer values
- Won retainer deals contribute to MRR
- Lost retainer deals don't contribute to MRR

## Examples

### Example 1: Marketing Agency
```
Deal: Digital Marketing Retainer
Type: Retainer
Monthly Amount: $3,000
Duration: 18 months
Total Value: $54,000
MRR Contribution: $3,000
```

### Example 2: Web Development
```
Deal: Website Development
Type: One-time
Total Value: $15,000
MRR Contribution: $0
```

### Combined Metrics
- Total Pipeline: $69,000 ($54,000 + $15,000)
- MRR: $3,000 (only from retainer)
- Annualized Revenue: $105,000 ($69,000 + $3,000 × 12)

## Database Schema

The system adds these fields to the `deals` table:

```sql
deal_type VARCHAR(20) NOT NULL DEFAULT 'one_time'
retainer_duration_months INTEGER
retainer_start_date DATE
```

## Migration

Run the migration to add retainer support:

```sql
-- See migrations/add_retainer_fields_to_deals.sql
ALTER TABLE deals ADD COLUMN deal_type VARCHAR(20) DEFAULT 'one_time';
-- ... (see full migration file)
```

## Benefits

1. **Better Revenue Tracking**: Separate one-time from recurring revenue
2. **MRR Visibility**: Clear view of monthly recurring revenue
3. **Accurate Projections**: Annualized revenue includes recurring components
4. **Month-by-Month Planning**: Track retainer performance over time
5. **Mixed Deal Types**: Handle both consulting projects and retainer clients

## API Usage

When creating deals programmatically:

```javascript
// One-time deal
const oneTimeDeal = {
  deal_type: 'one_time',
  value: 15000,
  // retainer fields should be null
}

// Retainer deal
const retainerDeal = {
  deal_type: 'retainer',
  value: 2000, // monthly amount
  retainer_duration_months: 12,
  retainer_start_date: '2024-01-01'
}
```

This enhancement allows you to properly track and calculate both total deal values per year and month-by-month recurring revenue for retainer-based business models. 