# Quick Reference: Data Retention & History Limits

## Problem Solved ✅
Performance history was limited to 100 results for "7d" and "all" views.

## Solution ✅
Updated `frontend/src/App.js` line 79:
```javascript
// Changed from: limit=100
// Changed to:  limit=1000
const response = await axios.get('/api/history?limit=1000');
```

## Data Retention Summary

### Speed Tests 📊
| Property | Value |
|----------|-------|
| Storage | `speed_tests` table |
| Auto-Delete | ❌ NO |
| Manual Delete | Yes (Clear History button) |
| Max Fetch | 1000 results |
| Retention | **Permanent** |

### Live Monitoring History 📡
| Property | Value |
|----------|-------|
| Storage | `live_monitoring_history` table |
| Auto-Delete | ✅ YES (7 days) |
| Schedule | Daily @ 3:00 AM UTC |
| Retention | **Last 7 days** |
| Location | backend/server.js line 1736 |

### Live Monitoring Current 🔄
| Property | Value |
|----------|-------|
| Storage | `live_monitoring` table |
| Auto-Delete | ❌ NO |
| Manual Delete | Yes (Clear History button) |
| Purpose | Current host status |
| Retention | **Session lifetime** |

## Key Facts ✅

✅ Speed test data **NEVER** auto-deletes
✅ Only **live monitoring history** auto-cleans (7 days)
✅ Dashboard now shows up to **1000** results
✅ No background process deletes speed tests
✅ All scheduled jobs verified as safe

## Verification Command

Check backend logs at 3:00 AM UTC daily for:
```
Cleaned up old monitoring history
```

This confirms only monitoring data is being cleaned, not speed tests.

## Related Documentation
- `DATA_RETENTION_POLICY.md` - Full retention policy details
- `PERFORMANCE_HISTORY_FIX.md` - Complete verification report
- Backend: `backend/server.js` lines 1720-1736 (cleanup function)
- Frontend: `frontend/src/App.js` line 79 (fetch limit)
