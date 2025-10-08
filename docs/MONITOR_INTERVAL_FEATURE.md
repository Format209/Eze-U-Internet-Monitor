# Live Monitoring Interval Configuration

## Overview
Added a configurable setting to control how often the live monitoring checks host connectivity, replacing the previously hardcoded 5-second interval.

## Changes Made

### Backend Changes (`backend/server.js`)

1. **Database Schema Update**
   - Added `monitorInterval` column to `settings` table (default: 5 seconds)
   - Added migration code to add the column to existing databases

2. **Settings Functions**
   - Updated `loadSettings()` to include `monitorInterval` with default value of 5
   - Updated `saveSettings()` to persist `monitorInterval` value
   - Settings are now properly saved and loaded from database

3. **Monitoring Logic**
   - Updated `startMonitoring()` function to use configurable interval
   - Changed from hardcoded `5000ms` to `(settings.monitorInterval || 5) * 1000`
   - Interval is now dynamically set based on user configuration

### Frontend Changes

1. **App.js**
   - Added `monitorInterval: 5` to default settings state
   - Ensures proper initialization when app loads

2. **Settings.js**
   - Added new input field: "Live Monitoring Interval (seconds)"
   - Input validation: min 1 second, max 60 seconds
   - Help text: "How often to check host connectivity (recommended: 3-10 seconds)"
   - Added default value fallback `settings.monitorInterval || 5`

## User Interface

### Settings Page - Monitoring Configuration Tab

```
┌─────────────────────────────────────────────┐
│ Monitoring Configuration                    │
├─────────────────────────────────────────────┤
│                                             │
│ Test Interval (minutes)                     │
│ How often to run automatic speed tests      │
│ [    30    ]                                │
│                                             │
│ Live Monitoring Interval (seconds)          │
│ How often to check host connectivity        │
│ (recommended: 3-10 seconds)                 │
│ [    5     ]                                │
│                                             │
└─────────────────────────────────────────────┘
```

## Technical Details

### Database Schema
```sql
CREATE TABLE settings (
  ...
  monitorInterval INTEGER DEFAULT 5,
  ...
);
```

### Settings Object Structure
```javascript
{
  testInterval: 30,        // Speed test interval in minutes
  monitorInterval: 5,      // Live monitoring interval in seconds
  pingHost: '8.8.8.8',
  monitoringHosts: [...],
  ...
}
```

### Monitoring Logic
```javascript
// Calculate interval in milliseconds
const checkInterval = (monitoringData.settings.monitorInterval || 5) * 1000;

// Set up monitoring interval
monitoringInterval = setInterval(async () => {
  await performQuickMonitor();
}, checkInterval);
```

## Usage

1. **Navigate to Settings** → Monitoring Configuration tab
2. **Adjust "Live Monitoring Interval"** field
3. **Valid Range**: 1-60 seconds
4. **Recommended Range**: 3-10 seconds
5. **Click Save** to apply changes
6. Monitoring will automatically restart with the new interval

## Performance Considerations

### Interval Recommendations:
- **1-2 seconds**: Very responsive, higher CPU/network usage, best for critical monitoring
- **3-5 seconds**: Good balance (default: 5 seconds)
- **6-10 seconds**: Lower resource usage, still responsive
- **10+ seconds**: Minimal resources, slower detection of issues

### Impact:
- **Lower intervals** = More frequent checks = Faster problem detection + Higher resource usage
- **Higher intervals** = Less frequent checks = Slower problem detection + Lower resource usage

## Default Values
- **Default**: 5 seconds
- **Minimum**: 1 second
- **Maximum**: 60 seconds (1 minute)

## Migration
- Existing databases will automatically get the `monitorInterval` column added
- Default value of 5 seconds will be applied to existing installations
- No data loss or manual migration required

## Testing
To test the feature:
1. Open Settings → Monitoring Configuration
2. Change "Live Monitoring Interval" to 10 seconds
3. Save settings
4. Watch the Dashboard - live monitoring updates should now occur every 10 seconds
5. Change back to 3 seconds to see faster updates

## Backward Compatibility
- ✅ Existing databases are automatically migrated
- ✅ Missing values default to 5 seconds
- ✅ Frontend gracefully handles undefined values
- ✅ No breaking changes to existing functionality
