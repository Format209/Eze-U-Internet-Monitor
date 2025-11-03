# Performance History Fix & Data Retention Verification

## Issue Report
User reported that performance history was limited to 100 results when viewing "7d" and "all" time ranges in the Dashboard.

## Root Cause
The frontend `App.js` was fetching only 100 speed test results:
```javascript
// BEFORE (Line 79)
const response = await axios.get('/api/history?limit=100');
```

While the backend supported up to 1000 results:
```javascript
// backend/server.js line 1444
const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
```

## Solution Implemented

### 1. Increased History Fetch Limit ✅
**File**: `frontend/src/App.js` (Line 79)
```javascript
// AFTER
const response = await axios.get('/api/history?limit=1000');
```

**Impact**:
- Dashboard can now show up to 1000 speed test results
- Time range filters (1h, 6h, 24h, 7d, all) work with full dataset
- Reports export now has access to more complete history

### 2. Data Retention Verification ✅

#### Speed Test Data (speed_tests table)
- **Auto-purge**: ❌ NO - Never auto-deleted
- **Manual deletion**: Only when user clicks "Clear History"
- **Location**: `backend/server.js` line 1641 (in `/api/history` DELETE endpoint)
- **Status**: 🟢 SAFE - Data persists indefinitely

#### Live Monitoring History (live_monitoring_history table)
- **Auto-purge**: ✅ YES - Daily at 3:00 AM UTC
- **Retention**: Last 7 days only
- **Location**: `backend/server.js` lines 1722-1736
- **Schedule**: `schedule.scheduleJob('0 3 * * *', cleanupOldMonitoringHistory);`
- **Status**: 🟢 WORKING AS DESIGNED

#### Live Monitoring Current (live_monitoring table)
- **Auto-purge**: ❌ NO
- **Manual deletion**: Only when user clicks "Clear History"
- **Purpose**: Current/latest host status (overwritten on each check)
- **Status**: 🟢 SAFE - No unexpected deletions

## Scheduled Jobs Summary

### setInterval (Line 1376)
- **Purpose**: Quick monitoring (ping checks)
- **Function**: `performQuickMonitor()`
- **Action**: Does NOT delete anything
- **Status**: 🟢 SAFE

### schedule.scheduleJob (Line 1392)
- **Purpose**: Speed test scheduling
- **Frequency**: Every N minutes (configurable in settings)
- **Function**: `performSpeedTest()`
- **Action**: Does NOT delete anything
- **Status**: 🟢 SAFE

### schedule.scheduleJob (Line 1736)
- **Purpose**: Cleanup old monitoring history
- **Frequency**: Daily at 3:00 AM UTC
- **Function**: `cleanupOldMonitoringHistory()`
- **Action**: **ONLY deletes live_monitoring_history older than 7 days**
- **Status**: 🟢 CORRECT - Specifically excludes speed_tests

## Verification Checklist ✅

- [x] Speed test fetch limit increased from 100 to 1000
- [x] Speed test data never auto-deleted (only on explicit clear)
- [x] Live monitoring history auto-cleans (7-day retention)
- [x] No other scheduled jobs delete speed tests
- [x] No background processes purge speed tests
- [x] Database schema verified for retention policies
- [x] Backend API endpoints verified

## Expected Behavior After Fix

### Dashboard Performance History
| Time Range | Before | After |
|----------|--------|-------|
| 1h | Limited by 100 | Shows all within 1h |
| 6h | Limited by 100 | Shows all within 6h |
| 24h | Limited by 100 | Shows all within 24h |
| 7d | **Limited by 100** ✅ **Fixed** | Shows all within 7d (up to 1000) |
| all | **Limited by 100** ✅ **Fixed** | Shows all history (up to 1000) |

### Live Monitoring
- Live monitoring history: Keeps last 7 days (auto-cleans daily @ 3 AM)
- Live monitoring current: Shows latest status for each host
- Speed test history: Kept permanently (never auto-deleted)

## Files Modified
1. `frontend/src/App.js` (line 79) - Updated limit from 100 to 1000
2. `DATA_RETENTION_POLICY.md` (created) - Documentation

## Files Verified (No Changes Needed)
1. `backend/server.js` - Cleanup logic is correct
2. `frontend/src/components/Dashboard.js` - Time range filtering working correctly
3. `frontend/src/components/Settings.js` - Already uses limit=1000 for reports

## Testing Recommendations

1. **Verify Increased Limit**
   - Run several speed tests (or wait for scheduled tests)
   - Switch to "7d" view - should show all tests from last 7 days
   - Switch to "all" view - should show up to 1000 tests total
   - Console should not show warnings about truncated data

2. **Verify No Unintended Deletions**
   - Watch backend logs at 3:00 AM UTC daily
   - Should see: "Cleaned up old monitoring history"
   - Speed tests should NOT be mentioned in cleanup logs
   - Check database size is stable or growing (not shrinking due to deletions)

3. **Verify Manual Clear Still Works**
   - Click "Clear History" in Dashboard
   - All speed tests should be deleted
   - All live monitoring data should be cleared
   - Confirm this was user-initiated

## Database Queries for Verification

To manually check retention status:
```sql
-- Count speed tests (should grow over time)
SELECT COUNT(*) as speed_test_count FROM speed_tests;

-- Count live monitoring history (should stay under 7 days worth)
SELECT COUNT(*) as monitoring_history_count FROM live_monitoring_history;

-- Check oldest speed test
SELECT MIN(timestamp) as oldest_speed_test FROM speed_tests;

-- Check oldest monitoring history
SELECT MIN(timestamp) as oldest_monitoring_history FROM live_monitoring_history;

-- Calculate days of monitoring history retained
SELECT 
  COUNT(*) as record_count,
  MIN(datetime(timestamp)) as oldest,
  MAX(datetime(timestamp)) as newest,
  CAST((julianday(MAX(timestamp)) - julianday(MIN(timestamp))) as INTEGER) as days_span
FROM live_monitoring_history;
```

## Conclusion

✅ **Issue Resolved**: Performance history now shows up to 1000 results instead of 100
✅ **Data Safety Verified**: Speed test data is never auto-purged
✅ **Retention Policies Confirmed**: Only live monitoring history auto-cleans (7 days)
✅ **No Regressions**: All other scheduled jobs verified as working correctly

The application is now configured correctly to:
- **Keep speed test history forever** (manual deletion only)
- **Keep live monitoring for 7 days** (auto-cleanup daily)
- **Display up to 1000 historical results** (frontend and backend aligned)
