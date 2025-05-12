# Calendar Sharing for Workspace Teams

This document explains how calendar sharing works in our application, allowing team members within the same workspace to view each other's calendar events.

## Overview

The calendar sharing feature enables team members to save their calendar events to the workspace database, making them visible to other members of the same workspace. This creates a shared team calendar where everyone can see upcoming meetings, deadlines, and events.

## Features

1. **Save Events to Database**: Users can save their calendar events to the workspace database.
2. **Google Calendar Integration**: Events can be synced directly from Google Calendar.
3. **Shared Visibility**: All events saved to a workspace are visible to all members of that workspace.
4. **Team Coordination**: Helps teams coordinate schedules and avoid conflicts.

## How to Use

### Dashboard Calendar Widget

1. On the dashboard, locate the "Upcoming Events" widget.
2. Two buttons are available:
   - **Save to DB**: Saves your current calendar events to the workspace database for sharing.
   - **Sync Calendar**: (If Google Calendar is connected) Fetches events from Google Calendar and saves them to the workspace.

### Calendar Page

1. Navigate to the Calendar page from the sidebar.
2. Click the "Save to Database" button in the top right to save your events to the workspace database.

## Technical Details

### Database Structure

Events are stored in the `calendar_events` table with the following key fields:

- `id`: Unique identifier for the event
- `user_id`: The user who created the event
- `workspace_id`: The workspace the event belongs to
- `title`: Event title
- `start_time`: Event start time
- `end_time`: Event end time
- `description`: Event description
- `location`: Event location
- `is_synced`: Whether the event was synced from Google Calendar
- `google_calendar_id`: The ID of the event in Google Calendar (if synced)

### API Endpoints

1. **`/api/calendar/sync-workspace`**: Syncs Google Calendar events to the workspace database.
2. **`/api/calendar/save-to-database`**: Saves user's calendar events to the workspace database.
3. **`/api/calendar/workspace-events`**: Fetches all events for a specific workspace.

### Implementation Notes

- Events are saved with the original creator's `user_id` to track ownership.
- When viewing events in the calendar, all events for the current workspace are displayed.
- Events sync is done in batches to handle large calendars efficiently.
- Cache busting is implemented to ensure the calendar always shows the most up-to-date events.

## Privacy Considerations

- Events are only shared within the workspace they are saved to.
- Users should be mindful about what events they choose to sync to the workspace database.
- Private events should be kept in personal calendars and not synced to the workspace.

## Troubleshooting

If events aren't appearing in the shared calendar:

1. Ensure you've clicked "Save to Database" to share your events.
2. Verify you're a member of the workspace you're trying to view events for.
3. Try refreshing the calendar using the refresh button.
4. Check that your Google Calendar integration is properly configured (if using sync from Google). 