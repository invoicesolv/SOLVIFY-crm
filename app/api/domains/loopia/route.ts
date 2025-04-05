import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as xmlrpc from 'xmlrpc';
import punycode from 'punycode';

interface LoopiaClient {
  methodCall: (method: string, params: any[], callback: (error: any, value: any) => void) => void;
}

interface LoopiaAccount {
  username: string;
  password: string;
  customer_number: string;
}

interface LoopiaDomainDetails {
  domain: string;
  expiration_date?: string;
  auto_renew?: boolean;
  status?: string;
  error?: string;
  account: string;
  customer_number: string;
}

interface DomainObject {
  domain: string;
  [key: string]: any;
}

const RATE_LIMIT = {
  TOTAL_CALLS_PER_MINUTE: 60,
  DOMAIN_SEARCHES_PER_MINUTE: 15,
  DELAY_BETWEEN_CALLS: 1000,
};

const LOOPIA_ACCOUNTS = [
  {
    username: 'solvify@loopiaapi',
    password: 'Miljonen1.se',
    customer_number: 'FA40-22-85-8581'
  },
  {
    username: 'negash@loopiaapi',
    password: 'Miljonen1.se',
    customer_number: 'FA66-09-30-3801'
  }
];

const clientOptions = {
  host: 'api.loopia.se',
  port: 443,
  path: '/RPCSERV',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'Accept-Charset': 'utf-8'
  }
};

const client = xmlrpc.createSecureClient(clientOptions) as LoopiaClient;

let callCount = 0;
let lastResetTime = Date.now();
let domainSearchCount = 0;

function checkRateLimit(isDomainSearch = false) {
  const now = Date.now();
  const timeElapsed = now - lastResetTime;

  if (timeElapsed >= 60000) {
    callCount = 0;
    domainSearchCount = 0;
    lastResetTime = now;
  }

  if (callCount >= RATE_LIMIT.TOTAL_CALLS_PER_MINUTE) {
    throw new Error('API rate limit exceeded. Please try again in a minute.');
  }

  if (isDomainSearch && domainSearchCount >= RATE_LIMIT.DOMAIN_SEARCHES_PER_MINUTE) {
    throw new Error('Domain search rate limit exceeded. Please try again in a minute.');
  }

  callCount++;
  if (isDomainSearch) domainSearchCount++;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeDomain = (domain: string): { normalized: string; display: string } => {
  try {
    const cleanDomain = domain.replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
    const normalized = cleanDomain.startsWith('xn--') ? cleanDomain : punycode.toASCII(cleanDomain);
    const display = cleanDomain.startsWith('xn--') ? punycode.toUnicode(cleanDomain) : cleanDomain;
    return { normalized, display };
  } catch (error) {
    console.error('Error normalizing domain:', domain, error);
    return { normalized: domain.toLowerCase(), display: domain.toLowerCase() };
  }
};

async function getLoopiaDomainsForAccount(account: typeof LOOPIA_ACCOUNTS[0]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    checkRateLimit(true);
    console.log(`Fetching domains for account ${account.username}`);
    
    const params = [account.username, account.password];
    
    client.methodCall('getDomains', params, (error: any, domains: (string | DomainObject)[]) => {
      if (error && error.faultCode === 623) {
        console.log('Retrying with customer number...');
        params.push(account.customer_number);
        
        client.methodCall('getDomains', params, (error2: any, domains2: (string | DomainObject)[]) => {
          if (error2) {
            console.error(`Error fetching domains for account ${account.username}:`, error2);
            resolve([]);
          } else {
            const domainStrings = Array.isArray(domains2) ? domains2.map(d => 
              typeof d === 'string' ? d : (d as DomainObject).domain
            ).filter((d): d is string => typeof d === 'string' && d.length > 0) : [];
            console.log(`Successfully fetched ${domainStrings.length} domains for account ${account.username}`);
            resolve(domainStrings);
          }
        });
      } else if (error) {
        console.error(`Error fetching domains for account ${account.username}:`, error);
        resolve([]);
      } else {
        const domainStrings = Array.isArray(domains) ? domains.map(d => 
          typeof d === 'string' ? d : (d as DomainObject).domain
        ).filter((d): d is string => typeof d === 'string' && d.length > 0) : [];
        console.log(`Successfully fetched ${domainStrings.length} domains for account ${account.username}`);
        resolve(domainStrings);
      }
    });
  });
}

async function saveDomainDetails(details: LoopiaDomainDetails) {
  try {
    const { normalized, display } = normalizeDomain(details.domain);
    console.log('Saving domain details:', { original: details.domain, normalized, display });

    const { error } = await supabase
      .from('domains')
      .upsert({
        domain: normalized,
        original_domain: details.domain,
        display_domain: display,
        expiry_date: details.expiration_date,
        auto_renew: details.auto_renew,
        status: details.status,
        error: details.error,
        source: 'Loopia' as const,
        loopia_account: details.account,
        customer_number: details.customer_number,
        last_updated: new Date().toISOString(),
        workspace_id: '37f99e9d-a2b6-4900-8cfb-fe1e58afa592'
      }, {
        onConflict: 'domain,workspace_id,source'
      });

    if (error) throw error;

    console.log(`Successfully saved domain: ${details.domain}`);
    return details;
  } catch (error) {
    console.error('Error in saveDomainDetails:', error);
    return {
      ...details,
      error: error instanceof Error ? error.message : 'Unknown error during save'
    };
  }
}

async function getLoopiaDomainsDetails(domains: string[], account: typeof LOOPIA_ACCOUNTS[0], signal: AbortSignal): Promise<LoopiaDomainDetails[]> {
  const domainDetails: LoopiaDomainDetails[] = [];
  let processedCount = 0;

  for (const domain of domains) {
    if (signal.aborted) {
      console.log('Sync cancelled, stopping domain processing');
      break;
    }

    try {
      await delay(RATE_LIMIT.DELAY_BETWEEN_CALLS);
      checkRateLimit();
      
      console.log(`Fetching details for domain "${domain}" (${processedCount + 1}/${domains.length})`);
      
      const details = await new Promise<LoopiaDomainDetails>((resolve) => {
        const params = [account.username, account.password, domain.trim()];
        
        client.methodCall('getDomain', params, async (error: any, result: any) => {
          if (error && error.faultCode === 623) {
            console.log('Retrying with customer number...');
            params.splice(2, 0, account.customer_number);
            
            client.methodCall('getDomain', params, async (error2: any, result2: any) => {
              const domainDetails = error2 ? {
                domain: domain,
                error: `${error2.faultString} (Code: ${error2.faultCode})`,
                account: account.username,
                customer_number: account.customer_number
              } : {
                domain: domain,
                expiration_date: result2?.expiration_date,
                auto_renew: Boolean(result2?.auto_renew),
                status: result2?.status,
                account: account.username,
                customer_number: account.customer_number
              };
              const savedDetails = await saveDomainDetails(domainDetails);
              resolve(savedDetails);
            });
          } else {
            const domainDetails = error ? {
              domain: domain,
              error: `${error.faultString} (Code: ${error.faultCode})`,
              account: account.username,
              customer_number: account.customer_number
            } : {
              domain: domain,
              expiration_date: result?.expiration_date,
              auto_renew: Boolean(result?.auto_renew),
              status: result?.status,
              account: account.username,
              customer_number: account.customer_number
            };
            const savedDetails = await saveDomainDetails(domainDetails);
            resolve(savedDetails);
          }
        });
      });

      domainDetails.push(details);
      processedCount++;
    } catch (error) {
      console.error(`Failed to process domain ${domain}:`, error);
      const errorDetails = {
        domain: domain,
        error: error instanceof Error ? error.message : 'Unknown error',
        account: account.username,
        customer_number: account.customer_number
      };
      const savedDetails = await saveDomainDetails(errorDetails);
      domainDetails.push(savedDetails);
      processedCount++;
    }
  }

  return domainDetails; // Ensure the function returns the array
}

async function checkDomainAvailability(account: typeof LOOPIA_ACCOUNTS[0], domain: string): Promise<boolean> {
  return new Promise((resolve) => {
    checkRateLimit(true);
    console.log(`Checking availability for domain ${domain}`);
    
    const params = [account.username, account.password, domain];
    
    client.methodCall('domainIsFree', params, (error: any, result: any) => {
      if (error) {
        console.error(`Error checking domain availability for ${domain}:`, error);
        resolve(false);
      } else {
        console.log(`Domain ${domain} availability:`, result);
        resolve(!!result);
      }
    });
  });
}

async function orderDomain(account: typeof LOOPIA_ACCOUNTS[0], domain: string): Promise<{ success: boolean; error?: string }> {
  try {
    // First check if the domain is available
    const isAvailable = await checkDomainAvailability(account, domain);
    if (!isAvailable) {
      return { 
        success: false, 
        error: 'Domain is not available for registration'
      };
    }

    return new Promise((resolve) => {
      checkRateLimit();
      console.log(`Ordering domain ${domain} for account ${account.username}`);
      
      // Parameters: username, password, domain, has_accepted_terms_and_conditions, customer_number
      const params = [
        account.username, 
        account.password,
        domain,
        1, // has_accepted_terms_and_conditions = true
        account.customer_number
      ];
      
      client.methodCall('orderDomain', params, async (error: any, result: any) => {
        if (error) {
          console.error(`Error ordering domain ${domain}:`, error);
          resolve({ 
            success: false, 
            error: `${error.faultString || 'Unknown error'} (Code: ${error.faultCode || 'unknown'})`
          });
        } else {
          console.log(`Successfully ordered domain ${domain}`);
          resolve({ success: true });
        }
      });
    });
  } catch (error) {
    console.error(`Error in orderDomain for ${domain}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

async function renewDomain(account: typeof LOOPIA_ACCOUNTS[0], domain: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    checkRateLimit();
    console.log(`Renewing domain ${domain} for account ${account.username}`);
    
    // First check if the domain exists in the account
    const params = [account.username, account.password, domain];
    
    client.methodCall('getDomain', params, async (error: any, result: any) => {
      if (error) {
        console.error(`Error checking domain ${domain}:`, error);
        resolve({ 
          success: false, 
          error: `${error.faultString || 'Unknown error'} (Code: ${error.faultCode || 'unknown'})`
        });
        return;
      }

      // If domain exists, proceed with renewal using orderDomain
      const orderParams = [
        account.username,
        account.password,
        domain,
        account.customer_number
      ];

      client.methodCall('orderDomain', orderParams, async (orderError: any, orderResult: any) => {
        if (orderError) {
          console.error(`Error renewing domain ${domain}:`, orderError);
          resolve({ 
            success: false, 
            error: `${orderError.faultString || 'Unknown error'} (Code: ${orderError.faultCode || 'unknown'})`
          });
        } else {
          console.log(`Successfully renewed domain ${domain}`);
          resolve({ success: true });
        }
      });
    });
  });
}

export async function GET(request: NextRequest) {
  const signal = request.signal;
  
  try {
    console.log('Starting Loopia domain sync for all accounts');
    const allDomainDetails: LoopiaDomainDetails[] = [];
    let totalProcessed = 0;
    let totalDomains = 0;
    let hasErrors = false;

    for (const account of LOOPIA_ACCOUNTS) {
      if (signal.aborted) {
        console.log('Sync cancelled by user');
        break;
      }

      console.log(`Processing account ${account.username}`);
      
      const domains = await getLoopiaDomainsForAccount(account);
      totalDomains += domains.length;
      
      if (domains.length > 0) {
        const details = await getLoopiaDomainsDetails(domains, account, signal);
        allDomainDetails.push(...details);
        totalProcessed += details.length;
        hasErrors = hasErrors || details.some(d => d.error);
      }
    }

    const wasAborted = signal.aborted;
    return NextResponse.json({
      success: true,
      message: wasAborted 
        ? `Sync cancelled. Processed ${totalProcessed} out of ${totalDomains} domains${hasErrors ? ' (with some errors)' : ''}`
        : `Successfully synced ${totalProcessed} domains from ${LOOPIA_ACCOUNTS.length} accounts${hasErrors ? ' (with some errors)' : ''}`,
      domains: allDomainDetails,
      completed: !wasAborted,
      hasErrors
    });
  } catch (error) {
    console.error('Error in Loopia sync:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync with Loopia',
        completed: false,
        hasErrors: true
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, domain, accountUsername } = body;

    if (!action || !domain) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Find the specified account or use the first one
    const account = accountUsername 
      ? LOOPIA_ACCOUNTS.find(a => a.username === accountUsername) 
      : LOOPIA_ACCOUNTS[0];

    if (!account) {
      return NextResponse.json(
        { error: 'Invalid account specified' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'renew') {
      result = await renewDomain(account, domain);
    } else if (action === 'order') {
      result = await orderDomain(account, domain);
    } else {
      return NextResponse.json(
        { error: 'Invalid action specified. Must be either "order" or "renew".' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Operation failed' },
        { status: 400 }
      );
    }

    // Wait a moment for the changes to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Fetch updated domain details
    const details = await getLoopiaDomainsDetails([domain], account, request.signal);
    
    return NextResponse.json({
      success: true,
      message: `Successfully ${action === 'renew' ? 'renewed' : 'ordered'} domain ${domain}`,
      domain: details[0]
    });

  } catch (error) {
    console.error('Error in Loopia domain operation:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Operation failed',
        completed: false
      },
      { status: 500 }
    );
  }
}