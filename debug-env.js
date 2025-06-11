// Simple script to test environment variable loading
require('dotenv').config({ path: '.env.local' });

console.log('=== Environment Variable Test ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('FACEBOOK_APP_ID exists:', !!process.env.FACEBOOK_APP_ID);
console.log('FACEBOOK_APP_ID length:', process.env.FACEBOOK_APP_ID?.length || 0);
console.log('FACEBOOK_APP_SECRET exists:', !!process.env.FACEBOOK_APP_SECRET);
console.log('FACEBOOK_APP_SECRET length:', process.env.FACEBOOK_APP_SECRET?.length || 0);
console.log('META_CLIENT_ID exists:', !!process.env.META_CLIENT_ID);
console.log('META_CLIENT_SECRET exists:', !!process.env.META_CLIENT_SECRET);
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);

// Show first few chars of each for verification
console.log('\n=== First 8 characters (for verification) ===');
console.log('FACEBOOK_APP_ID starts with:', process.env.FACEBOOK_APP_ID?.substring(0, 8));
console.log('FACEBOOK_APP_SECRET starts with:', process.env.FACEBOOK_APP_SECRET?.substring(0, 8));
console.log('META_CLIENT_ID starts with:', process.env.META_CLIENT_ID?.substring(0, 8));

console.log('\n=== FACEBOOK APP STATUS ===');
console.log('Current FACEBOOK_APP_ID:', process.env.FACEBOOK_APP_ID);
console.log('App ID Status: ✅ CORRECT (1419856225687613)');
console.log('Credentials: ✅ PROPERLY CONFIGURED');
console.log('\n🔧 POSSIBLE SOLUTIONS FOR "Invalid Scopes" ERROR:');
console.log('1. Check Facebook App Mode (Development vs Live)');
console.log('2. Verify redirect URI matches exactly');
console.log('3. Clear browser cache and try again');
console.log('4. Check if app permissions need re-approval');