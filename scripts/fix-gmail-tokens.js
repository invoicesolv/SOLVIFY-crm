const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase admin client
const supabase = supabaseClient;
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixGmailTokens() {
  console.log('🔍 Checking Gmail integrations for problematic scopes...');
  
  try {
    // Get all Gmail integrations
    const { data: integrations, error } = await supabase
      .from('integrations')
      .select('*')
      .eq('service_name', 'google-gmail');

    if (error) {
      console.error('❌ Error fetching integrations:', error);
      return;
    }

    console.log(`📊 Found ${integrations.length} Gmail integrations`);

    let problematicTokens = 0;
    const tokensToDelete = [];

    // Check each integration for problematic scope combination
    for (const integration of integrations) {
      const scopes = integration.scopes || [];
      const hasGmailMetadata = scopes.some(scope => scope.includes('gmail.metadata'));
      const hasFullGmail = scopes.some(scope => scope.includes('mail.google.com'));
      
      if (hasGmailMetadata && hasFullGmail) {
        console.log(`⚠️  Problematic token found for user ${integration.user_id}`);
        console.log(`   Scopes: ${scopes.join(', ')}`);
        problematicTokens++;
        tokensToDelete.push(integration.id);
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   Total Gmail integrations: ${integrations.length}`);
    console.log(`   Problematic tokens: ${problematicTokens}`);
    console.log(`   Clean tokens: ${integrations.length - problematicTokens}`);

    if (problematicTokens === 0) {
      console.log('✅ No problematic tokens found. All Gmail integrations are clean!');
      return;
    }

    // Ask for confirmation
    console.log(`\n🚨 WARNING: This will delete ${problematicTokens} Gmail integrations.`);
    console.log('   Users will need to reconnect their Gmail accounts.');
    console.log('   This will restore full email access (format=full) for affected users.');
    
    // Show what would be deleted
    console.log('\n📋 Integrations that would be deleted:');
    for (const id of tokensToDelete) {
      const integration = integrations.find(i => i.id === id);
      console.log(`   - User: ${integration.user_id}, Updated: ${integration.updated_at}`);
    }

    console.log('\n⚠️  To actually delete these tokens, set DELETE_TOKENS=true as environment variable.');
    console.log('   Example: DELETE_TOKENS=true node scripts/fix-gmail-tokens.js');

    // Only delete if explicitly requested
    if (process.env.DELETE_TOKENS === 'true') {
      console.log('\n🗑️  DELETE_TOKENS=true detected, proceeding with deletion...');
      
      const { error: deleteError } = await supabase
        .from('integrations')
        .delete()
        .in('id', tokensToDelete);

      if (deleteError) {
        console.error('❌ Error deleting integrations:', deleteError);
      } else {
        console.log(`✅ Successfully deleted ${tokensToDelete.length} problematic Gmail integrations`);
        console.log('   Users will be prompted to reconnect Gmail with full access');
        console.log('   The updated Gmail message route will now work with format=full for new tokens');
      }
    } else {
      console.log('\n💡 To proceed with the fix, run:');
      console.log('   DELETE_TOKENS=true node scripts/fix-gmail-tokens.js');
    }

  } catch (error) {
    console.error('💥 Script error:', error);
  }
}

// Run the script
fixGmailTokens().then(() => {
  console.log('\n🏁 Script completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
}); 