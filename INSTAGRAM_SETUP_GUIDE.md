# Instagram Business Setup Guide

## Current App Details
- **App ID**: 1419856225687613
- **App Name**: CRM Publish
- **Status**: Unpublished (Development Mode)

## Step-by-Step Setup Process

### 1. Add Instagram Product
1. Go to main App Dashboard: https://developers.facebook.com/apps/1419856225687613/
2. Scroll down to find "Instagram" product tile
3. Click "Set up" on Instagram product
4. This adds Instagram API capabilities to your app

### 2. Configure Instagram Business Login
1. After adding Instagram product, go to left sidebar
2. Click "Instagram" → "API Setup with Facebook Login"
3. Find "Set up Instagram business login" section
4. Click "Set up"
5. Add redirect URI: `https://crm.solvify.se/api/oauth/instagram-business/callback`
6. Save configuration

### 3. Required Permissions (Instagram Business)
Your app needs these permissions for Instagram Business:
- `instagram_business_basic`
- `instagram_business_content_publish`
- `instagram_business_manage_comments`
- `instagram_business_manage_insights`
- `instagram_business_manage_messages`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

### 4. Connect Instagram Account to Facebook Page
**CRITICAL STEP**: Your Instagram account must be connected to a Facebook Page

1. Go to Meta Business Suite: https://business.facebook.com
2. Navigate to Settings → Business Assets → Instagram accounts
3. Find your Instagram account "solvifysearch"
4. Click "Connect to Page"
5. Select one of your Facebook Pages:
   - Todo Smash Burgers (634834979708871)
   - Todos Smash Burger (558689663991640)
   - Goallwhite (404693982720803)
   - Solvify AB (109400455228964)
6. Verify connection shows "Connected" status

### 5. Test the Integration
1. Go to your debug page: http://localhost:3000/debug/facebook-config
2. Click "Make Live Instagram API Request"
3. Check if Instagram accounts are now detected

## Troubleshooting

### If Instagram Product is Not Visible
- Make sure your app type is "Business" (not Consumer)
- Check that you have a verified business attached to the app

### If Permissions Are Rejected
- Instagram business permissions require App Review for production
- During development, you can test with your own accounts

### If No Instagram Accounts Found
- Verify the Instagram account is connected to a Facebook Page in Meta Business Suite
- Check that the Facebook Page has proper permissions
- Ensure the Instagram account is a Business or Creator account

## Next Steps After Setup
1. Test OAuth flow with updated permissions
2. Verify Instagram account detection in debug tools
3. Submit for App Review when ready for production

## Important Notes
- App is currently in Development Mode - only you can test it
- Instagram Business accounts must be connected to Facebook Pages
- All Instagram business permissions require App Review for public use
- Keep your app in Development Mode until Instagram connection is working 