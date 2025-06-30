// Centralized OAuth scope configuration
// This is the SINGLE source of truth for all Google OAuth scopes

export const GOOGLE_SCOPES = {
  // Gmail - CRITICAL: Only use https://mail.google.com/ to avoid Google's metadata restriction
  // When individual Gmail scopes are requested, Google automatically adds gmail.metadata which breaks full format access
  'https://mail.google.com/': 'google-gmail',
  
  // Analytics scopes
  'https://www.googleapis.com/auth/analytics.readonly': 'google-analytics',
  'https://www.googleapis.com/auth/analytics': 'google-analytics',
  'https://www.googleapis.com/auth/analytics.edit': 'google-analytics',
  'https://www.googleapis.com/auth/analytics.manage.users': 'google-analytics',
  'https://www.googleapis.com/auth/analytics.manage.users.readonly': 'google-analytics',
  'https://www.googleapis.com/auth/analytics.provision': 'google-analytics',
  'https://www.googleapis.com/auth/analytics.user.deletion': 'google-analytics',
  
  // Search Console scopes
  'https://www.googleapis.com/auth/webmasters.readonly': 'google-searchconsole',
  'https://www.googleapis.com/auth/webmasters': 'google-searchconsole',
  
  // Calendar scopes
  'https://www.googleapis.com/auth/calendar.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.events': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.events.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.events.owned': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.events.owned.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.acls': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.acls.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.calendarlist': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.app.created': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.addons.execute': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.freebusy': 'google-calendar',
  'https://www.googleapis.com/auth/calendar.settings.readonly': 'google-calendar',
  
  // Drive scopes
  'https://www.googleapis.com/auth/drive.file': 'google-drive',
  'https://www.googleapis.com/auth/drive.appdata': 'google-drive',
  'https://www.googleapis.com/auth/drive.readonly': 'google-drive',
  'https://www.googleapis.com/auth/drive': 'google-drive',
  'https://www.googleapis.com/auth/drive.metadata': 'google-drive',
  'https://www.googleapis.com/auth/drive.photos.readonly': 'google-drive',
  
  // YouTube scopes
  'https://www.googleapis.com/auth/youtube': 'youtube',
  'https://www.googleapis.com/auth/youtube.upload': 'youtube',
  'https://www.googleapis.com/auth/youtube.readonly': 'youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl': 'youtube'
} as const;

// Service configurations for the frontend
export const SERVICE_CONFIGS = {
  'google-analytics': {
    name: 'Google Analytics',
    description: 'Track website analytics and performance',
    scopes: [
      'https://www.googleapis.com/auth/analytics.readonly',
      'https://www.googleapis.com/auth/analytics',
      'https://www.googleapis.com/auth/analytics.edit',
      'https://www.googleapis.com/auth/analytics.manage.users',
      'https://www.googleapis.com/auth/analytics.manage.users.readonly'
    ]
  },
  'google-searchconsole': {
    name: 'Google Search Console',
    description: 'Monitor website search performance',
    scopes: [
      'https://www.googleapis.com/auth/webmasters.readonly',
      'https://www.googleapis.com/auth/webmasters'
    ]
  },
  'google-calendar': {
    name: 'Google Calendar',
    description: 'Manage calendar events and scheduling',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar'
    ]
  },
  'google-drive': {
    name: 'Google Drive',
    description: 'Access and manage files in Google Drive',
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.appdata',
      'https://www.googleapis.com/auth/drive.readonly'
    ]
  },
  'google-gmail': {
    name: 'Gmail Lead Hub',
    description: 'Connect Gmail to pull potential leads',
    scopes: [
      'https://mail.google.com/' // CRITICAL: Only this scope to avoid metadata restriction
    ]
  },
  'youtube': {
    name: 'YouTube',
    description: 'Manage YouTube channel and videos',
    scopes: [
      'https://www.googleapis.com/auth/youtube',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.force-ssl'
    ]
  }
} as const;

export type ServiceId = keyof typeof SERVICE_CONFIGS;
export type GoogleScope = keyof typeof GOOGLE_SCOPES; 