# ✅ Database Schema Update - Server & ISP Fields

## Issue Identified
The `speed_tests` table in the database wa   Invoke-RestMethod -Method POST -Uri http://localhost:8745/api/test missing the `server` and `isp` columns, so these fields from the Ookla CLI results were not being saved.

## Changes Made

### 1. Database Schema Update

**Added two new columns to `speed_tests` table:**
- `server TEXT` - Stores the test server name (e.g., "Active Fibre")
- `isp TEXT` - Stores the Internet Service Provider name (e.g., "Home Connect")

### 2. Database Migration

Added automatic migration code that:
- Checks if columns already exist
- Adds columns to existing databases without data loss
- Handles errors gracefully (ignores "duplicate column" errors)

```javascript
// Add server and isp columns if they don't exist (migration for existing databases)
db.run(`ALTER TABLE speed_tests ADD COLUMN server TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding server column:', err.message);
  }
});

db.run(`ALTER TABLE speed_tests ADD COLUMN isp TEXT`, (err) => {
  if (err && !err.message.includes('duplicate column')) {
    console.error('Error adding isp column:', err.message);
  }
});
```

### 3. Save Function Update

Updated `saveSpeedTest()` function to include the new fields:

**Before:**
```javascript
INSERT INTO speed_tests (timestamp, download, upload, ping, jitter, downloadLatency, uploadLatency)
VALUES (?, ?, ?, ?, ?, ?, ?)
```

**After:**
```javascript
INSERT INTO speed_tests (timestamp, download, upload, ping, jitter, downloadLatency, uploadLatency, server, isp)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
```

## Updated Schema

### Complete `speed_tests` Table Schema
```sql
CREATE TABLE IF NOT EXISTS speed_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  download REAL NOT NULL,
  upload REAL NOT NULL,
  ping REAL NOT NULL,
  jitter REAL,
  downloadLatency REAL,
  uploadLatency REAL,
  server TEXT,           -- NEW
  isp TEXT              -- NEW
)
```

## Files Modified

### `backend/server.js`
- ✅ Updated table creation schema
- ✅ Added migration code for existing databases
- ✅ Updated `saveSpeedTest()` function to save server and isp

## How It Works

### For New Databases
When creating a fresh database, the table will include all 10 columns from the start.

### For Existing Databases
The migration code automatically adds the missing columns when the server starts:
1. Server starts and connects to existing database
2. Migration code runs: `ALTER TABLE speed_tests ADD COLUMN server TEXT`
3. Migration code runs: `ALTER TABLE speed_tests ADD COLUMN isp TEXT`
4. If columns already exist, errors are ignored
5. All new speed tests will save server and isp data

## Testing the Update

### 1. Restart Backend Server

**Option A: Stop and Restart**
```powershell
# Find the backend process
Get-Process node | Where-Object {$_.Path -like "*backend*"}

# Stop it (or press Ctrl+C in the terminal)
# Then restart:
cd backend
npm start
```

**Option B: If using nodemon**
The server should auto-restart when it detects the file change.

### 2. Verify Database Schema

After restart, check the console output. You should see NO errors about duplicate columns (or that's expected on first run).

### 3. Run a Speed Test

```powershell
# Trigger a speed test via API
Invoke-RestMethod -Method POST -Uri http://localhost:5000/api/test
```

### 4. Check Database

The new test should include server and isp data:
```javascript
{
  timestamp: '2025-10-07T06:00:37.749Z',
  download: 10.29,
  upload: 15.01,
  ping: 63.96,
  jitter: 87.53,
  downloadLatency: 358.25,
  uploadLatency: 347.53,
  server: 'Active Fibre',    // ✅ Now saved!
  isp: 'Home Connect'         // ✅ Now saved!
}
```

### 5. View in Report Tab

Open the Report tab in Settings:
- Server and ISP columns should now show data for new tests
- Old tests (before this update) will show "N/A" for server/ISP
- Export CSV will include all fields

## Data Migration Notes

### Existing Data
- **Old test results**: Will have `NULL` values for server and isp
- **New test results**: Will include server and isp data
- **No data loss**: All existing test data is preserved

### Frontend Handling
The frontend already handles missing data gracefully:
- Displays "N/A" for missing server/isp values
- CSV export shows "N/A" for NULL values
- Statistics calculations ignore NULL values

## Expected Behavior

### Before Update (Old Tests)
```
┌────────────────┬──────────┬────────────────────┐
│ Timestamp      │ Download │ Server     │ ISP   │
├────────────────┼──────────┼────────────┼───────┤
│ Oct 6, 15:00   │ 125.50   │ N/A        │ N/A   │
│ Oct 6, 14:30   │ 122.80   │ N/A        │ N/A   │
└────────────────┴──────────┴────────────┴───────┘
```

### After Update (New Tests)
```
┌────────────────┬──────────┬──────────────┬─────────────┐
│ Timestamp      │ Download │ Server       │ ISP         │
├────────────────┼──────────┼──────────────┼─────────────┤
│ Oct 7, 16:00   │ 10.29    │ Active Fibre │ Home Connect│
│ Oct 7, 15:30   │ 12.45    │ Active Fibre │ Home Connect│
└────────────────┴──────────┴──────────────┴─────────────┘
```

## Rollback (If Needed)

If you need to remove the columns (not recommended):
```sql
-- SQLite doesn't support DROP COLUMN easily
-- Best approach: backup data and recreate table
-- Or just leave columns as they are harmless
```

## Next Steps

1. ✅ **Restart Backend Server** - Apply database changes
2. ✅ **Run Speed Test** - Verify server/ISP data is saved
3. ✅ **Check Report Tab** - Confirm data displays correctly
4. ✅ **Export CSV** - Verify export includes all fields

## Status: ✅ READY TO APPLY

**Required Action**: Restart the backend server to apply the database schema changes.

After restart, all new speed tests will automatically save server and ISP information! 🎉

**Date**: October 7, 2025  
**Update**: Database schema migration for server and ISP fields  
**Backward Compatible**: ✅ Yes - Existing data preserved
