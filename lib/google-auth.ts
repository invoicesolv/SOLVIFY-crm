import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Function to create a new OAuth2 client using the credentials
export function getGoogleOAuth2Client(refreshToken?: string): OAuth2Client {
  const redirectUri = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:3000/api/oauth/google/callback'
    : 'https://crm.solvify.se/api/oauth/google/callback';

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  // If a refresh token is provided, set it on the client
  if (refreshToken) {
    client.setCredentials({
      refresh_token: refreshToken
    });
  }

  return client;
}

// Create authorized Google APIs
export function getGoogleApis(refreshToken: string) {
  const oauth2Client = getGoogleOAuth2Client(refreshToken);
  
  return {
    analytics: google.analytics({
      version: 'v3',
      auth: oauth2Client
    }),
    analyticsData: google.analyticsdata({
      version: 'v1beta',
      auth: oauth2Client
    }),
    analyticsAdmin: google.analyticsadmin({
      version: 'v1beta',
      auth: oauth2Client
    }),
    calendar: google.calendar({
      version: 'v3',
      auth: oauth2Client
    }),
    webmasters: google.searchconsole({
      version: 'v1',
      auth: oauth2Client
    }),
    gmail: google.gmail({
      version: 'v1',
      auth: oauth2Client
    }),
    drive: google.drive({
      version: 'v3',
      auth: oauth2Client
    }),
    youtube: google.youtube({
      version: 'v3',
      auth: oauth2Client
    })
  };
} 