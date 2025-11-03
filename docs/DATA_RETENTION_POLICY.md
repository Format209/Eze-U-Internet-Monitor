# Data Retention Policy

## Overview
The Ezé-U Internet Monitor implements a selective data retention policy to balance storage efficiency with historical analysis capabilities.

## Speed Test History
**Status: ✅ PERMANENT STORAGE**
- **Retention**: Indefinite (never auto-deleted)
- **Storage**: `speed_tests` table in SQLite database
- **Columns**: timestamp, download, upload, ping, jitter, latency, server, ISP, result_url, downloadBytes, uploadBytes
- **Deletion Only When**: User explicitly clicks "Clear History" button in Dashboard
- **API Fetch Limit**: 1000 results maximum per request
- **Frontend Display**: Filters by time range (1h, 6h, 24h, 7d, all)
- **Purpose**: Permanent performance record for trend analysis and reporting

## Live Monitoring History
**Status: ⏰ AUTO-CLEANUP (7-day retention)**
- **Retention**: Last 7 days only
- **Storage**: `live_monitoring_history` table in SQLite database
- **Columns**: timestamp, address, status (online/offline), latency
- **Auto-Cleanup**: Runs daily at 3:00 AM UTC
- **Cleanup Logic**: Deletes records older than 7 days
- **Purpose**: Real-time host availability monitoring without excessive storage

### Cleanup Implementation
```javascript
// Located in backend/server.js lines 1722-1736
async function cleanupOldMonitoringHistory() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    await dbRun(`
      DELETE FROM live_monitoring_history 
      WHERE datetime(timestamp) < datetime(?)
    `, [sevenDaysAgo]);
    console.log('Cleaned up old monitoring history');
  } catch (error) {
    console.error('Error cleaning up monitoring history:', error);
  }
}

// Schedule: Daily at 3:00 AM
schedule.scheduleJob('0 3 * * *', cleanupOldMonitoringHistory);
```

## Live Monitoring Current State
**Status: ⚡ SESSION DATA ONLY**
- **Retention**: During application lifetime only
- **Storage**: `live_monitoring` table in SQLite database (overwritten)
- **Columns**: address, timestamp, status
- **Purpose**: Current/latest ping status for dashboard display
- **Note**: Not auto-cleaned; updated on each monitoring cycle

## History Fetch Configuration

### Frontend (App.js)
- **Line 79**: `const response = await axios.get('/api/history?limit=1000');`
- **Fetches**: Up to 1000 most recent speed test results
- **Frequency**: On component mount and after each WebSocket update

### Backend API (/api/history)
- **Query Parameter**: `limit` (default: 50, max: 1000)
- **Backend Code (server.js:1444)**: `const limit = Math.min(parseInt(req.query.limit) || 50, 1000);`
- **Response**: Speed tests ordered by timestamp DESC
- **Caching**: 30-second TTL for performance

## Time Range Filtering

The Dashboard filters fetched history by time range (client-side):

| Range | Filter | Purpose |
|-------|--------|---------|
| 1h | Last 60 minutes | Recent trends |
| 6h | Last 6 hours | Short-term performance |
| 24h | Last 24 hours | Daily trends |
| 7d | Last 7 days | Weekly analysis |
| all | All history | Complete history review |

### Example Calculation
- If 1000 speed tests are fetched and you run tests every 30 minutes:
  - **1h view**: ~2 results (depending on recent activity)
  - **6h view**: ~12 results
  - **24h view**: ~48 results
  - **7d view**: ~336 results
  - **all view**: All 1000+ results

## Database Tables Summary

| Table | Auto-Cleanup | Deletion Policy | Purpose |
|-------|--------------|-----------------|---------|
| `speed_tests` | ❌ No | Manual only | Permanent speed test history |
| `live_monitoring_history` | ✅ Yes (7 days) | Automatic daily @ 3 AM | Host availability trends |
| `live_monitoring` | ❌ No | Manual only | Current host status |

## Key Points

✅ **Speed test data is safe**
- Never auto-deleted
- Only deleted when user explicitly clears history
- Up to 1000 results fetched for analysis
- Can grow indefinitely (plan for storage accordingly)

✅ **Live monitoring history is managed**
- Auto-cleaned to keep last 7 days
- Runs daily at 3:00 AM UTC
- Prevents database bloat from frequent ping checks

✅ **Frontend displays all available data**
- Fetches maximum 1000 results
- Filters by user-selected time range
- Shows accurate statistics within time range

## Recommendations

1. **For Long-term Storage**: Consider periodic database backups
2. **For Large Databases**: Monitor database file size if running 24/7 for extended periods
3. **For Export**: Use Settings → Reports → CSV Export to backup speed test history
4. **For Analysis**: Always select appropriate time range to avoid overwhelming charts

## Troubleshooting

### "Only seeing 100 results for 7d"
- ✅ Fixed in frontend/src/App.js line 79 (limit=1000)
- Restart frontend application to apply changes

### "Speed tests disappearing"
- Check backend logs for errors
- Verify clear history wasn't accidentally triggered
- Check server.js for any manual deletion code (there shouldn't be any)

### "Live monitoring data growing too large"
- Verify cleanup is running (check logs at 3:00 AM UTC daily)
- Check `live_monitoring_history` table size with SQLite browser
- Consider manual cleanup if needed: `DELETE FROM live_monitoring_history WHERE datetime(timestamp) < datetime('now', '-7 days');`

## Related Files
- Backend: `backend/server.js` (lines 1720-1736)
- Frontend: `frontend/src/App.js` (line 79)
- Database: `backend/monitoring.db`
