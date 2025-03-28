import base64
from flask import Flask, redirect, request, jsonify, url_for
import requests
from flask_cors import CORS
import json
from urllib.parse import quote
import os
import time

app = Flask(__name__)
CORS(app, 
     resources={r"/*": {
         "origins": ["http://localhost:3000", "http://localhost:3001"],
         "methods": ["GET", "POST", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": True,
         "expose_headers": ["Content-Type", "Authorization"]
     }},
     supports_credentials=True)

# Fortnox credentials
CLIENT_ID = '4LhJwn68IpdR'
CLIENT_SECRET = 'pude4Qk6dK'
REDIRECT_URI = 'http://localhost:5001/oauth/callback'
AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth'
TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token'
BASE_API_URL = 'https://api.fortnox.se/3/'
TOKEN_FILE = 'fortnox_token.json'

# Supabase settings
SUPABASE_URL = 'https://jbspiufukrifntnwlrts.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impic3BpdWZ1a3JpZm50bndscnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEzNDE3NDIsImV4cCI6MjA1NjkxNzc0Mn0.i27PZ3uZMDofSlVMQntUl6n8LpwPjgThJ4nZghp75BE'

def save_to_supabase(token_data):
    try:
        # Calculate expires_at
        expires_at = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + token_data.get('expires_in', 3600)))
        
        # Prepare the data
        settings_data = {
            'service_name': 'fortnox',
            'access_token': token_data['access_token'],
            'refresh_token': token_data.get('refresh_token'),
            'expires_at': expires_at
        }
        
        # Save to Supabase
        response = requests.post(
            f'{SUPABASE_URL}/rest/v1/settings',
            json=settings_data,
            headers={
                'apikey': SUPABASE_KEY,
                'Authorization': f'Bearer {SUPABASE_KEY}',
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            }
        )
        
        if response.status_code not in [200, 201]:
            print(f"Error saving to Supabase: {response.text}")
            return False
        return True
    except Exception as e:
        print(f"Error saving to Supabase: {str(e)}")
        return False

def load_token():
    print("Attempting to load token...")
    try:
        if os.path.exists(TOKEN_FILE):
            with open(TOKEN_FILE, 'r') as f:
                token_data = json.load(f)
                print(f"Token data loaded: {json.dumps(token_data, indent=2)}")
                return token_data
        print("No token file found")
        return None
    except Exception as e:
        print(f"Error loading token: {str(e)}")
        return None

def verify_token(token):
    print(f"Verifying token: {token[:30]}...")
    if not token:
        print("No token provided for verification")
        return False
    try:
        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        print("Making verification request to Fortnox API...")
        response = requests.get(f'{BASE_API_URL}companyinformation', headers=headers)
        print(f"Token verification response: {response.status_code}")
        print(f"Response body: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        return False

def refresh_token():
    try:
        token_data = load_token()
        if not token_data or 'refresh_token' not in token_data:
            return None
            
        response = requests.post(
            'https://apps5.fortnox.se/oauth-v1/token',
            data={
                'grant_type': 'refresh_token',
                'refresh_token': token_data['refresh_token'],
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET
            }
        )
        
        if response.status_code == 200:
            new_token_data = response.json()
            save_token(new_token_data)
            return new_token_data
        return None
    except Exception as e:
        print(f"Error refreshing token: {e}")
        return None

@app.route('/fortnox/status')
def check_status():
    print("\n=== Flask Status Check Started ===")
    print("1. Loading token from file...")
    
    token_data = load_token()
    if not token_data or 'access_token' not in token_data:
        return jsonify({'connected': False})
        
    print(f"2. Token loaded: {token_data['access_token'][:50]}...")
    
    headers = {
        'Authorization': f"Bearer {token_data['access_token']}",
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    print("Making request to Fortnox API...")
    try:
        response = requests.get(
            'https://api.fortnox.se/3/companyinformation',
            headers=headers
        )
        
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Headers: {response.headers}")
        
        if response.status_code == 401:
            # Token expired, try to refresh
            new_token_data = refresh_token()
            if new_token_data:
                # Retry with new token
                headers['Authorization'] = f"Bearer {new_token_data['access_token']}"
                response = requests.get(
                    'https://api.fortnox.se/3/companyinformation',
                    headers=headers
                )
        
        if response.status_code == 200:
            company_info = response.json()['CompanyInformation']
            return jsonify({
                'connected': True,
                'company_info': company_info
            })
            
    except Exception as e:
        print(f"Error checking status: {e}")
    
    return jsonify({'connected': False})

@app.route('/oauth/callback')
def oauth_callback():
    code = request.args.get('code')
    state = request.args.get('state')
    print(f"Received callback with code: {code}")

    if not code:
        return "Error: Authorization code not provided", 400

    if state != 'somestate123':
        return "Error: Invalid state parameter", 400

    try:
        base64_credentials = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
        headers = {
            'Authorization': f'Basic {base64_credentials}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        # Request all necessary scopes for invoices
        scopes = ['companyinformation', 'invoice', 'bookkeeping']
        scope_str = ' '.join(scopes)
        
        data = {
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': REDIRECT_URI,
            'scope': scope_str
        }
        
        print("Requesting access token from Fortnox...")
        print(f"Request data: {data}")
        response = requests.post(TOKEN_URL, headers=headers, data=data)
        print(f"Token response status: {response.status_code}")
        print(f"Token response body: {response.text}")
        
        token_data = response.json()
        
        if 'access_token' in token_data:
            print("Access token received")
            print(f"Saving token data: {json.dumps(token_data, indent=2)}")
            
            # Save to both file and Supabase
            with open(TOKEN_FILE, 'w') as f:
                json.dump(token_data, f, indent=2)
            print("Token saved to file")
            
            # Also save to Supabase
            save_to_supabase(token_data)
            print("Token saved to Supabase")
            
            return redirect('http://localhost:3000/fortnox')
        else:
            print(f"Token request failed: {token_data}")
            return jsonify(token_data), response.status_code
    except Exception as e:
        print(f"Error in callback: {str(e)}")
        return str(e), 500

@app.route('/fortnox/auth')
def fortnox_auth():
    scopes = ['companyinformation', 'invoice', 'bookkeeping']
    scope_str = ' '.join(scopes)
    
    auth_params = {
        'client_id': CLIENT_ID,
        'scope': scope_str,
        'state': 'somestate123',
        'access_type': 'offline',
        'response_type': 'code',
        'redirect_uri': REDIRECT_URI
    }
    
    auth_url = f"{AUTH_URL}?{'&'.join(f'{k}={quote(v)}' for k, v in auth_params.items())}"
    return redirect(auth_url)

@app.route('/fortnox/disconnect', methods=['POST'])
def disconnect():
    print("Disconnect requested")
    try:
        if os.path.exists(TOKEN_FILE):
            os.remove(TOKEN_FILE)
            print("Token file removed")
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error disconnecting: {str(e)}")
        return jsonify({'success': False})

@app.route('/dates')
def get_dates():
    print("\n=== Starting Date Analysis ===")
    try:
        token = load_token()
        if not token:
            print("No token found")
            return jsonify({'error': 'Not authenticated'}), 401

        headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        all_dates = {
            'invoice_dates': set(),
            'due_dates': set(),
            'final_pay_dates': set()
        }
        
        page = 1
        limit = 500
        
        while True:
            params = {
                'limit': limit,
                'page': page,
                'sortby': 'invoicedate',
                'sortorder': 'descending'
            }
            
            print(f"\nFetching page {page}...")
            print(f"Request URL: {BASE_API_URL}invoices")
            print(f"Request Headers: {headers}")
            print(f"Request Params: {params}")
            
            response = requests.get(f'{BASE_API_URL}invoices', headers=headers, params=params)
            
            print(f"Response Status Code: {response.status_code}")
            print(f"Response Headers: {dict(response.headers)}")
            
            try:
                response_data = response.json()
                print(f"Response Body: {json.dumps(response_data, indent=2)}")
            except json.JSONDecodeError:
                print(f"Raw Response Body: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                if 'Invoices' in data and data['Invoices']:
                    for inv in data['Invoices']:
                        # Only add non-null dates
                        invoice_date = inv.get('InvoiceDate')
                        due_date = inv.get('DueDate')
                        final_pay_date = inv.get('FinalPayDate')
                        
                        if invoice_date:
                            all_dates['invoice_dates'].add(invoice_date)
                        if due_date:
                            all_dates['due_dates'].add(due_date)
                        if final_pay_date:
                            all_dates['final_pay_dates'].add(final_pay_date)
                    
                    total_pages = (int(data.get('MetaInformation', {}).get('@TotalResources', 0)) + limit - 1) // limit
                    print(f"Progress: Page {page} of {total_pages}")
                    
                    if page >= total_pages:
                        break
                    page += 1
                else:
                    break
            else:
                error_msg = f"Failed to fetch dates. Status: {response.status_code}"
                try:
                    error_details = response.json()
                    error_msg += f", Details: {json.dumps(error_details)}"
                except:
                    error_msg += f", Raw response: {response.text}"
                print(error_msg)
                return jsonify({'error': error_msg}), response.status_code
        
        # Convert sets to sorted lists, handling empty sets
        result = {
            'dates': {
                'invoice_dates': sorted(list(all_dates['invoice_dates']), reverse=True) if all_dates['invoice_dates'] else [],
                'due_dates': sorted(list(all_dates['due_dates']), reverse=True) if all_dates['due_dates'] else [],
                'final_pay_dates': sorted(list(all_dates['final_pay_dates']), reverse=True) if all_dates['final_pay_dates'] else []
            },
            'analysis': {
                'invoice_dates': {
                    'earliest': min(all_dates['invoice_dates']) if all_dates['invoice_dates'] else None,
                    'latest': max(all_dates['invoice_dates']) if all_dates['invoice_dates'] else None,
                    'total_count': len(all_dates['invoice_dates'])
                },
                'due_dates': {
                    'earliest': min(all_dates['due_dates']) if all_dates['due_dates'] else None,
                    'latest': max(all_dates['due_dates']) if all_dates['due_dates'] else None,
                    'total_count': len(all_dates['due_dates'])
                },
                'final_pay_dates': {
                    'earliest': min(all_dates['final_pay_dates']) if all_dates['final_pay_dates'] else None,
                    'latest': max(all_dates['final_pay_dates']) if all_dates['final_pay_dates'] else None,
                    'total_count': len(all_dates['final_pay_dates'])
                }
            }
        }
        
        print("\n=== Date Analysis Results ===")
        print(json.dumps(result, indent=2))
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in get_dates: {str(e)}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e)}), 500

@app.route('/fortnox/invoices', methods=['GET', 'POST'])
def get_fortnox_invoices():
    print("\n=== Fetching Invoices ===")
    
    # Load token
    token_data = load_token()
    if not token_data or 'access_token' not in token_data:
        print("No valid token found")
        return jsonify({'error': 'Not authenticated'}), 401
        
    headers = {
        'Authorization': f"Bearer {token_data['access_token']}",
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    
    try:
        all_invoices = []
        
        # First fetch 2024 invoices
        print("\n=== Fetching 2024 Invoices ===")
        url_2024 = f"{BASE_API_URL}invoices?fromdate=2024-01-01&todate=2024-12-31"
        print(f"Making request to: {url_2024}")
        response_2024 = requests.get(url_2024, headers=headers)
        print(f"2024 Response status: {response_2024.status_code}")
        
        if response_2024.status_code == 401:
            print("Token expired, attempting refresh...")
            new_token_data = refresh_token()
            if new_token_data:
                headers['Authorization'] = f"Bearer {new_token_data['access_token']}"
                response_2024 = requests.get(url_2024, headers=headers)
                print(f"2024 Retry response status: {response_2024.status_code}")
        
        if response_2024.status_code == 200:
            data_2024 = response_2024.json()
            if 'Invoices' in data_2024:
                print(f"Found {len(data_2024['Invoices'])} invoices from 2024")
                all_invoices.extend(data_2024['Invoices'])
        
        # Then fetch 2023 and earlier invoices
        print("\n=== Fetching 2023 and Earlier Invoices ===")
        url_past = f"{BASE_API_URL}invoices?todate=2023-12-31"
        print(f"Making request to: {url_past}")
        response_past = requests.get(url_past, headers=headers)
        print(f"Past Response status: {response_past.status_code}")
        
        if response_past.status_code == 200:
            data_past = response_past.json()
            if 'Invoices' in data_past:
                print(f"Found {len(data_past['Invoices'])} invoices from 2023 and earlier")
                all_invoices.extend(data_past['Invoices'])
        
        # Sort all invoices by date (newest first)
        all_invoices.sort(key=lambda x: x['InvoiceDate'], reverse=True)
        
        print(f"\nTotal invoices fetched: {len(all_invoices)}")
        return jsonify({'Invoices': all_invoices})
            
    except Exception as e:
        error_message = f"Error fetching invoices: {str(e)}"
        print(error_message)
        return jsonify({'error': error_message}), 500

if __name__ == '__main__':
    app.run(host='localhost', port=5001, debug=True)
