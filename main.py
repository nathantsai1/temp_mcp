from flask import Flask, redirect, request, session, url_for
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SLACK_SECRET_ID")  # Replace with a secure key in production

# Slack app credentials
SLACK_CLIENT_ID = os.getenv("SLACK_CLIENT_ID")
SLACK_CLIENT_SECRET = os.getenv("SLACK_CLIENT_SECRET")
SLACK_REDIRECT_URI = os.getenv("SLACK_REDIRECT_URI")  # Update with your redirect URI

@app.route('/slack/auth')
def slack_auth():
    try:
        # Redirect user to Slack's OAuth authorization page
        slack_auth_url = (
            f"https://slack.com/oauth/v2/authorize?client_id={SLACK_CLIENT_ID}"
            f"&scope=channels:read,chat:write&redirect_uri={SLACK_REDIRECT_URI}"
        )
        print(f"Redirecting to Slack auth URL: {slack_auth_url}")
        return redirect(slack_auth_url)
    except Exception as e:
        print(f"Error during Slack authentication: {e}")
        return "Error during Slack authentication. Please try again.", 500

@app.route('/slack/callback')
def slack_callback():
    # Handle the callback from Slack
    print(1)
    code = request.args.get('code')
    print(code)
    if not code:
        return "Authorization failed. No code provided.", 400

    # Exchange the code for an access token
    token_url = "https://slack.com/api/oauth.v2.access"
    response = requests.post(token_url, data={
        'client_id': SLACK_CLIENT_ID,
        'client_secret': SLACK_CLIENT_SECRET,
        'code': code,
        'redirect_uri': SLACK_REDIRECT_URI
    })

    if response.status_code != 200 or not response.json().get('ok'):
        return "Failed to retrieve access token from Slack.", 400

    # Store the access token in the session
    session['slack_token'] = response.json()['access_token']
    return "Slack authentication successful!"

@app.route('/slack/use')
def slack_use():
    print('working')
    # Example endpoint to demonstrate token usage
    if not session.get('slack_token'):
        return "User not authenticated with Slack. Please authenticate first.", 401

    # Use the token to interact with Slack API
    slack_token = session['slack_token']
    headers = {"Authorization": f"Bearer {slack_token}"}
    response = requests.get("https://slack.com/api/auth.test", headers=headers)

    if response.status_code == 200 and response.json().get('ok'):
        return f"Slack API call successful! User: {response.json()['user']}"
    else:
        return "Failed to interact with Slack API.", 400

if __name__ == '__main__':
    app.run(debug=True)