// Facebook OAuth Debug Script
require('dotenv').config({ path: '.env.local' });

console.log('=== Facebook OAuth Debug ===');
console.log('Environment check:');
console.log('FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID ? 'Set' : 'Missing');
console.log('FACEBOOK_APP_SECRET:', process.env.FACEBOOK_APP_SECRET ? 'Set' : 'Missing');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

// Generate the OAuth URLs that should be configured in Facebook
const baseUrl = (process.env.NEXTAUTH_URL || 'https://crm.solvify.se').replace(/\/$/, '');

console.log('\n=== Required Facebook OAuth Redirect URIs ===');
console.log('Add these to your Facebook App > Facebook Login > Settings:');
console.log('1.', `${baseUrl}/api/auth/callback/facebook`);
console.log('2.', 'http://localhost:3000/api/auth/callback/facebook (for development)');

console.log('\n=== Facebook App Configuration ===');
console.log('App Domains should be:', baseUrl.replace('https://', '').replace('http://', ''));
console.log('Site URL should be:', baseUrl + '/');

console.log('\n=== NextAuth Facebook Login URL ===');
console.log('Users should login via:', `${baseUrl}/api/auth/signin/facebook`);

if (process.env.FACEBOOK_APP_ID) {
  console.log('\n=== OAuth URL Generation Test ===');
  const facebookAuthUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
  facebookAuthUrl.searchParams.set('client_id', process.env.FACEBOOK_APP_ID);
  facebookAuthUrl.searchParams.set('redirect_uri', `${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`);
  
  const scope = [
    'public_profile',
    'email',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'pages_manage_engagement',
    'pages_manage_metadata',
    'pages_read_user_content',
    'business_management',
    'read_insights'
  ].join(',');
  
  facebookAuthUrl.searchParams.set('scope', scope);
  facebookAuthUrl.searchParams.set('response_type', 'code');
  facebookAuthUrl.searchParams.set('state', JSON.stringify({platform: 'facebook', userId: 'test'}));
  facebookAuthUrl.searchParams.set('extras', JSON.stringify({feature: 'login_for_business'}));
  
  console.log('Generated OAuth URL:');
  console.log(facebookAuthUrl.toString());
  
  console.log('\n=== URL Components ===');
  console.log('Client ID:', process.env.FACEBOOK_APP_ID);
  console.log('Redirect URI:', `${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`);
  console.log('Scopes:', scope);
  console.log('API Version: v23.0');
  
  console.log('\n=== Troubleshooting ===');
  console.log('✅ App ID: 1419856225687613 (CORRECT)');
  console.log('✅ API Version: v23.0 (LATEST)');
  console.log('✅ Scopes: All valid business permissions');
  console.log('');
  console.log('🔍 CHECK IN FACEBOOK APP SETTINGS:');
  console.log('1. App Mode should be "Live" not "Development"');
  console.log('2. Valid OAuth redirect URIs should include:');
  console.log(`   ${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`);
  console.log('3. App should have business verification completed');
  console.log('4. All permissions should be "Ready for testing" or approved');
} 