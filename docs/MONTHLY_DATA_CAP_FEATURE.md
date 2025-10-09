# Monthly Data Cap Feature

## Overview
Added comprehensive monthly data cap tracking and enforcement for speedtest data usage with auto-adapting unit display (KB, MB, GB, TB, PB).

## Features Implemented

### 1. **Auto-Adapting Unit Display**
- Bytes automatically convert to the most appropriate unit (KB, MB, GB, TB, PB)
- Smart decimal formatting (2 decimals for values < 100, 1 decimal for values ≥ 100)
- Works for both time-range data usage and monthly caps

### 2. **Monthly Data Cap Setting**
- Configurable in Settings > Monitoring tab
- Format: "5 GB", "1 TB", "500 MB", etc.
- Optional - leave empty for unlimited usage
- Stored in database and persists across restarts

### 3. **Automatic Speed Test Blocking**
- When monthly cap is reached, all speed tests are automatically blocked
- Applies to both scheduled and manual tests
- Automatically resets at the start of each new month
- Clear error messages explain why tests are blocked

### 4. **Visual Warning System**
Three-tier warning system with color-coded alerts:

#### **Info (0-79% usage)** - Blue
- Shows current monthly usage
- Progress bar with cyan gradient

#### **Warning (80-99% usage)** - Yellow
- "⚠️ Approaching Data Cap" message
- Warns user before hitting the limit
- Progress bar with yellow gradient

#### **Critical (100%+ usage)** - Red
- "🚫 Monthly Data Cap Reached!" message
- Notifies that speed tests are disabled
- Progress bar with red gradient
- Shows when tests will resume

### 5. **Real-Time Usage Tracking**
- Monthly usage display shows:
  - Download data used
  - Upload data used
  - Total data used
  - Percentage of cap used
  - Visual progress bar
- Auto-refreshes every 30 seconds
- Updates immediately after each speed test

## Technical Implementation

### Backend Changes

#### Database Schema (`backend/server.js`)
```sql
-- New column in settings table
ALTER TABLE settings ADD COLUMN monthlyDataCap TEXT DEFAULT NULL;

-- New columns in speed_tests table
ALTER TABLE speed_tests ADD COLUMN downloadBytes INTEGER;
ALTER TABLE speed_tests ADD COLUMN uploadBytes INTEGER;
```

#### New Functions
1. **`parseDataCapToBytes(capString)`**
   - Converts "5 GB", "1 TB" format to bytes
   - Supports KB, MB, GB, TB, PB units

2. **`isMonthlyDataCapReached()`**
   - Checks if current month's usage exceeds cap
   - Queries database for month-to-date usage
   - Returns true/false

3. **`performSpeedTest()` - Enhanced**
   - Checks data cap before running test
   - Throws error if cap reached
   - Includes cap amount in error message

#### New API Endpoint
**GET `/api/monthly-usage`**

Returns:
```json
{
  "downloadBytes": 21058652,
  "uploadBytes": 4316512,
  "totalBytes": 25375164,
  "monthlyDataCap": "5 GB",
  "capInBytes": 5368709120,
  "capReached": false,
  "percentageUsed": 0.47
}
```

### Frontend Changes

#### Dashboard.js
1. **Auto-Adapting `formatBytes()` Function**
   ```javascript
   formatBytes(bytes) => { value: "5.23", unit: "GB" }
   ```

2. **Monthly Usage State**
   - Fetches usage data every 30 seconds
   - Updates after each speed test
   - Displays warning banner when cap configured

3. **Warning Banner Component**
   - Conditional rendering based on usage percentage
   - Color-coded (info/warning/critical)
   - Animated progress bar
   - Clear messaging

#### Settings.js
1. **Monthly Data Cap Input Field**
   - Text input with validation hints
   - Examples: "5 GB", "1 TB", "500 MB"
   - Help text explains format and behavior
   - Optional field (empty = unlimited)

#### Dashboard.css
1. **Warning Banner Styles**
   - Three color themes (blue/yellow/red)
   - Smooth animations (slideDown)
   - Responsive progress bar with gradients
   - Proper spacing and typography

## Usage Examples

### Setting Data Caps
| Input | Result |
|-------|--------|
| `5 GB` | 5 gigabytes monthly limit |
| `1 TB` | 1 terabyte monthly limit |
| `500 MB` | 500 megabytes monthly limit |
| `10 GB` | 10 gigabytes monthly limit |
| (empty) | Unlimited - no cap |

### Display Examples
| Bytes | Auto-Display |
|-------|--------------|
| 1024 | 1.00 KB |
| 1048576 | 1.00 MB |
| 5368709120 | 5.00 GB |
| 1099511627776 | 1.00 TB |
| 21058652 | 20.08 MB |

## User Experience Flow

### Normal Operation (Under Cap)
1. User runs speed test
2. Data usage increases
3. Blue info banner shows current usage
4. Speed tests continue normally

### Approaching Cap (80-99%)
1. Yellow warning banner appears
2. Shows percentage and remaining capacity
3. User can adjust cap or reduce testing frequency
4. Speed tests still allowed

### Cap Reached (100%+)
1. Red critical banner appears
2. All speed tests blocked automatically
3. Error message: "Monthly data cap of X reached"
4. Tests automatically resume next month

## Database Migration Notes

### On First Startup After Update
1. `monthlyDataCap` column added to `settings` table (default: NULL)
2. `downloadBytes` and `uploadBytes` columns added to `speed_tests` table
3. Existing speed test records will have NULL bytes (shows as 0 MB)
4. New speed tests will capture byte data automatically

## Configuration

### Default Settings
- **Monthly Data Cap**: `null` (unlimited)
- **Warning Threshold**: 80% of cap
- **Critical Threshold**: 100% of cap
- **Check Frequency**: Before each speed test
- **Display Refresh**: Every 30 seconds

### Customization
Users can set any cap from 1 KB to multiple PB by entering:
- Value (number)
- Unit (KB, MB, GB, TB, or PB)
- Format: `"<number> <UNIT>"` (e.g., "5 GB")

## Benefits

1. **Cost Control** - Prevents unexpected data charges
2. **Bandwidth Management** - Limits speedtest bandwidth consumption
3. **Automatic Enforcement** - No manual intervention needed
4. **Clear Communication** - Visual warnings before hitting limit
5. **Flexible Configuration** - Any size cap or unlimited
6. **Smart Display** - Units auto-adapt for readability
7. **Monthly Reset** - Automatically resets each month

## Testing Checklist

- [ ] Set a low cap (e.g., "1 MB")
- [ ] Run speed test and verify blocking when cap reached
- [ ] Check warning banner appears at 80%
- [ ] Check critical banner appears at 100%
- [ ] Verify progress bar accuracy
- [ ] Test with different units (MB, GB, TB)
- [ ] Verify monthly reset (change system date to next month)
- [ ] Test unlimited mode (empty cap field)
- [ ] Verify bytes data captured in database
- [ ] Check API endpoint returns correct data

## Files Modified

### Backend
- `backend/server.js` - Database migrations, cap checking, API endpoint

### Frontend
- `frontend/src/components/Dashboard.js` - Usage display, warning banner
- `frontend/src/components/Dashboard.css` - Warning banner styles
- `frontend/src/components/Settings.js` - Data cap input field
- `frontend/src/components/Settings.css` - Dropdown styles (already updated)

## Future Enhancements (Optional)

1. **Email Notifications** - Alert when approaching/reaching cap
2. **Cap History** - Track monthly usage over time
3. **Per-Host Caps** - Different caps for different test servers
4. **Grace Period** - Allow X tests after cap reached
5. **Scheduled Cap Reset** - Custom reset day (not just 1st of month)
6. **Data Export** - Export monthly usage reports
