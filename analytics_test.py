from flask import Flask, redirect, request, jsonify
import requests
import json
from urllib.parse import quote_plus, urlencode
from datetime import datetime, timedelta
import os

app = Flask(__name__)

CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET')
REDIRECT_URI = "http://localhost:3002/api/auth/google-analytics/callback"

def fetch_analytics_data(property_id, start_date=None, end_date=None, access_token=None):
    """
    Fetch analytics data for a specific property.
    
    Args:
        property_id (str): The GA4 property ID
        start_date (str, optional): Start date in YYYY-MM-DD format. Defaults to 30 days ago.
        end_date (str, optional): End date in YYYY-MM-DD format. Defaults to today.
        access_token (str, optional): The access token. If None, will try to load from tokens.json.
        
    Returns:
        dict: Formatted analytics data with the following structure:
        {
            "summary": {
                "total_views": int,
                "total_sessions": int,
                "avg_engagement": str,
                "avg_bounce_rate": str
            },
            "pages": [
                {
                    "path": str,
                    "views": int,
                    "sessions": int,
                    "engagement": str,
                    "bounce_rate": str
                },
                ...
            ],
            "metadata": {
                "timeZone": str,
                "currencyCode": str,
                "dateRange": {
                    "start": str,
                    "end": str
                }
            }
        }
    """
    try:
        # Set default dates if not provided
        if not start_date:
            start_date = (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%d')
        if not end_date:
            end_date = datetime.now().strftime('%Y-%m-%d')
            
        # Get access token if not provided
        if not access_token:
            with open("tokens.json", "r") as f:
                tokens = json.load(f)
                access_token = tokens["access_token"]
        
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        analytics_url = f"https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
        analytics_data = {
            "dateRanges": [{"startDate": start_date, "endDate": end_date}],
            "dimensions": [{"name": "pagePath"}],
            "metrics": [
                {"name": "screenPageViews"},
                {"name": "sessions"},
                {"name": "userEngagementDuration"},
                {"name": "bounceRate"}
            ],
            "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}]
        }
        
        response = requests.post(analytics_url, headers=headers, json=analytics_data)
        data = response.json()
        
        if "error" in data:
            return {"error": data["error"]}, 400
            
        # Format the response
        formatted_data = {
            "summary": {
                "total_views": 0,
                "total_sessions": 0,
                "total_engagement": 0,
                "bounce_rates": []  # For calculating average
            },
            "pages": [],
            "metadata": {
                "timeZone": data.get("metadata", {}).get("timeZone"),
                "currencyCode": data.get("metadata", {}).get("currencyCode"),
                "dateRange": {
                    "start": start_date,
                    "end": end_date
                }
            }
        }
        
        # Get header names
        metric_headers = [h["name"] for h in data.get("metricHeaders", [])]
        
        # Process each row
        for row in data.get("rows", []):
            page_data = {
                "path": row["dimensionValues"][0]["value"],
                "metrics": {}
            }
            
            # Process metrics
            for i, metric_value in enumerate(row["metricValues"]):
                metric_name = metric_headers[i]
                value = metric_value["value"]
                
                # Update summary data
                if metric_name == "screenPageViews":
                    formatted_data["summary"]["total_views"] += int(value)
                    page_data["views"] = int(value)
                elif metric_name == "sessions":
                    formatted_data["summary"]["total_sessions"] += int(value)
                    page_data["sessions"] = int(value)
                elif metric_name == "userEngagementDuration":
                    seconds = int(value)
                    formatted_data["summary"]["total_engagement"] += seconds
                    page_data["engagement"] = f"{seconds}s ({seconds // 60}m {seconds % 60}s)"
                elif metric_name == "bounceRate":
                    bounce_rate = float(value)
                    formatted_data["summary"]["bounce_rates"].append(bounce_rate)
                    page_data["bounce_rate"] = f"{bounce_rate * 100:.1f}%"
            
            formatted_data["pages"].append(page_data)
        
        # Calculate averages for summary
        if formatted_data["pages"]:
            avg_engagement = formatted_data["summary"]["total_engagement"] / len(formatted_data["pages"])
            avg_bounce = sum(formatted_data["summary"]["bounce_rates"]) / len(formatted_data["summary"]["bounce_rates"])
            
            formatted_data["summary"]["avg_engagement"] = f"{int(avg_engagement)}s ({int(avg_engagement) // 60}m {int(avg_engagement) % 60}s)"
            formatted_data["summary"]["avg_bounce_rate"] = f"{avg_bounce * 100:.1f}%"
            
        # Clean up temporary data
        del formatted_data["summary"]["total_engagement"]
        del formatted_data["summary"]["bounce_rates"]
        
        return formatted_data
        
    except Exception as e:
        return {"error": str(e)}, 500

@app.route('/')
def index():
    auth_url = "https://accounts.google.com/o/oauth2/v2/auth"
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/analytics.readonly",
        "access_type": "offline",
        "prompt": "consent"
    }
    full_auth_url = f"{auth_url}?{urlencode(params)}"
    print(f"Auth URL: {full_auth_url}")  # Debug print
    return f'<a href="{full_auth_url}">Click here to authenticate</a>'

@app.route('/api/auth/google-analytics/callback')
def callback():
    print("Callback received with args:", request.args)  # Debug
    code = request.args.get('code')
    if not code:
        return "No code received", 400

    # Exchange code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    
    print("Token request data:", token_data)  # Debug
    
    headers = {
        "Content-Type": "application/x-www-form-urlencoded"
    }
    
    print("Sending token request to:", token_url)  # Debug
    token_response = requests.post(token_url, data=urlencode(token_data), headers=headers)
    print("Token response status:", token_response.status_code)  # Debug
    print("Token response headers:", dict(token_response.headers))  # Debug
    
    try:
        tokens = token_response.json()
    except Exception as e:
        print("Failed to parse token response:", str(e))
        print("Raw response:", token_response.text)
        return "Failed to parse token response", 500
    
    if "error" in tokens:
        print(f"Token error response: {json.dumps(tokens, indent=2)}")  # Debug
        return f"Error getting tokens: {tokens['error']}", 400
    
    # Save tokens
    with open("tokens.json", "w") as f:
        json.dump(tokens, f)
    
    return "Authentication successful! Tokens saved to tokens.json"

@app.route('/analytics')
def get_analytics():
    try:
        property_id = "313420483"  # Solvify's property ID
        return jsonify(fetch_analytics_data(property_id))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='localhost', port=3002) 