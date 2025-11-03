# Speedtest Data Usage - Code Reference

## Quick Lookup Guide

### Frontend Components

#### Dashboard.js
```
Lines 29:        monthlyUsage state
Lines 135-149:   Monthly usage fetch with 30s refresh
Lines 322-335:   formatBytes() function (auto-adapting units)
Lines 340-350:   calculateDataUsage() function
Lines 353:       dataUsage calculation call
Lines 380-403:   Monthly data cap warning banner (3-tier alerts)
Lines 580-623:   Data usage summary box (4-stat cards)
```

#### Settings.js
```
Line 21:         monthlyDataCap in initial state
Lines 59-68:     parseDataCap() helper function
Lines 70-71:     dataCapValue and dataCapUnit states
Lines 103-120:   handleSave() combines value+unit
Lines 122-127:   handleReset() parses cap
Line 176:        eslint-disable for dependency
Lines 507-541:   Data cap split input UI (number + dropdown + preview)
```

### CSS Styling

#### Dashboard.css
```
Lines 73-185:    Data cap warning banner styles (.info/.warning/.critical)
Lines 186-205:   Cap progress bar with gradients
Lines 683-714:   Data usage summary box container
Lines 715-743:   Usage stat cards with hover effects
Line 897:        Responsive 2-column mobile layout
```

#### Settings.css
```
Lines 203-219:   data-cap-input-group flex layout
Lines 221-243:   data-cap-preview with color coding
```

### Backend Integration

#### API Endpoints
```
GET /api/monthly-usage
  Returns: {
    totalDownload,      // bytes
    totalUpload,        // bytes
    totalBytes,         // bytes
    monthlyDataCap,     // "5 GB" format
    percentageUsed,     // 0-100
    capReached          // boolean
  }

GET /api/history?limit=1000
  Returns: [{
    timestamp,
    download,
    upload,
    downloadBytes,      // NEW: exact bytes
    uploadBytes,        // NEW: exact bytes
    ...
  }]

POST /api/settings
  Accepts: {
    monthlyDataCap: "5 GB"
    ...
  }
```

#### Database Fields
```
speed_tests table:
  - downloadBytes     (INTEGER)
  - uploadBytes       (INTEGER)

settings table:
  - monthlyDataCap    (TEXT) - format: "5 GB"
```

## Feature Flows

### Display Monthly Data Cap Warning

**Trigger**: Component mount + history update
```
fetchMonthlyUsage() 
  → GET /api/monthly-usage 
  → setMonthlyUsage(data)
  → Render data-cap-warning banner
     - Color: capReached ? 'critical' : percentageUsed >= 80 ? 'warning' : 'info'
     - Show: percentageUsed.toFixed(1)%
     - Bar: width = Math.min(100, percentageUsed)%
```

### Display Data Usage Summary

**Trigger**: Time range change
```
timeRange changed
  → filterHistoryByTimeRange()
  → calculateDataUsage()
    - Sum downloadBytes from filteredHistory
    - Sum uploadBytes from filteredHistory
    - Format with formatBytes()
  → Render data-usage-summary box
     - Download: formatBytes(totalDownloadBytes)
     - Upload: formatBytes(totalUploadBytes)
     - Total: formatBytes(totalDownloadBytes + totalUploadBytes)
     - Tests: filteredHistory.length
```

### Configure Monthly Data Cap

**Trigger**: User input in Settings
```
User changes dataCapValue or dataCapUnit
  → Live preview updates
  → User clicks Save
  → handleSave()
    - Combine: `${dataCapValue} ${dataCapUnit}`
    - POST /api/settings { monthlyDataCap }
    - Backend validates and saves
  → Frontend receives update via WebSocket
  → Dashboard re-fetches monthly usage
```

### Auto-Format Bytes to Units

**Flow**:
```
formatBytes(bytes)
  → Calculate: i = Math.floor(Math.log(bytes) / Math.log(1024))
  → Convert: value = bytes / Math.pow(1024, i)
  → Format decimals:
     - If value >= 100: toFixed(1)
     - If value < 100: toFixed(2)
  → Return: { value, unit: units[i] }

Example:
  5368709120 bytes
    → i = 3 (GB)
    → value = 5.0
    → Return { value: "5.0", unit: "GB" }
```

## State Management

### Component State

**Dashboard.js**:
- `monthlyUsage` - Latest monthly statistics from backend
- `timeRange` - Selected time range filter (1h/6h/24h/7d/all)
- `history` - Speed test history (up to 1000 results)

**Settings.js**:
- `dataCapValue` - Numeric input (e.g., "5")
- `dataCapUnit` - Unit dropdown selection (e.g., "GB")
- `monthlyDataCap` - Combined format stored in server state (e.g., "5 GB")

### Props Flow

```
App.js
  ├─ currentSpeed → Dashboard
  ├─ history → Dashboard (used for filtering by timeRange)
  ├─ settings → Dashboard (displays current monthlyDataCap)
  ├─ settings → Settings (loaded from database)
```

## Refresh Intervals

### Auto-Refresh Timers

**Dashboard.js**:
- Monthly usage: 30 seconds (line 148)
- External IP: 30 seconds (line 67)
- Next test time: 30 seconds (line 72)

**On Events**:
- WebSocket `speedtest` event → `fetchHistory()` → data usage updates
- WebSocket `settings` event → Settings reloaded

## Performance Considerations

✅ **Optimized**:
- Data usage calculations only on filtered data (not full history)
- Monthly usage cached server-side (30s TTL)
- formatBytes() uses Math.log for efficiency
- No unnecessary re-renders (memoized calculations)

⚠️ **Monitor**:
- Large history (1000+ items) might cause slow calculations
  - Solution: Pre-calculate on backend if needed
- Monthly usage fetches every 30 seconds
  - Could be reduced if server load becomes issue

## Troubleshooting

### Data not showing
1. Check `history` has `downloadBytes`/`uploadBytes`
2. Verify `/api/monthly-usage` returning data
3. Check console for fetch errors
4. Restart backend to refresh database

### Wrong units displayed
1. Verify `formatBytes()` is being called
2. Check Math.log calculation
3. Ensure bytes are non-zero numbers

### Monthly cap not enforcing
1. Verify backend `/api/monthly-usage` returning `capReached: true`
2. Check backend speed test blocking logic
3. Verify settings saved correctly

### Live updates not working
1. Check WebSocket connection in browser dev tools
2. Verify `fetchMonthlyUsage` interval is active
3. Check for console errors

## Related Files

- Documentation: `MONTHLY_DATA_CAP_FEATURE.md`
- Documentation: `DATA_CAP_UI_IMPROVEMENTS.md`
- Verification: `PERFORMANCE_HISTORY_FIX.md`
- Status: `SPEEDTEST_DATA_USAGE_STATUS.md` (this file)
