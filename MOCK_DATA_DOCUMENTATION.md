# Mock Data Documentation

## Overview
Mock data generator for Ezé-U Internet Monitor - Creates 3 months of realistic speed test data for testing and demonstration purposes.

## What Was Added

### Database Records
- **Total Records**: 227 speed test entries
- **Time Period**: 90 days (3 months) of historical data
- **Date Range**: August 6, 2025 - November 3, 2025
- **Tests per Day**: 2-3 tests daily (simulating default 30-minute interval)

### Statistics Generated
- **Avg Download**: 189.08 Mbps
- **Avg Upload**: 26.4 Mbps
- **Avg Ping**: 36.95 ms
- **Download Range**: 0-282 Mbps
- **Upload Range**: 0-40 Mbps
- **Ping Range**: 0-240 ms
- **Total Data Used**: 59.6 GB
  - Download: 52.27 GB
  - Upload: 7.33 GB

## How It Works

### Script Location
- **File**: `backend/add-mock-data.js`
- **Language**: Node.js
- **Dependencies**: better-sqlite3

### Data Generation Algorithm

#### Speed Test Simulation
```javascript
// Base speeds (average home broadband)
- Base Download: 150-250 Mbps
- Base Upload: 20-35 Mbps
- Base Ping: 20-50 ms

// Variance applied (85-115%)
- This creates realistic fluctuations

// Byte calculations
- Uses test duration of ~10 seconds
- Mbps ÷ 8 = Bytes per second
- Multiplies by duration × 1024² for MB
```

#### Data Distribution
- **2-3 random tests per day** (varies daily)
- **Random times** throughout the day (0-24 hours)
- **Realistic speeds** with variance
- **Unique ISP servers** (ISP-Server-1 through ISP-Server-10)

### Fields Generated

#### Required Fields
```javascript
{
  timestamp: "2025-11-03T10:27:00.000Z",    // ISO 8601 format
  download: 189.08,                          // Mbps
  upload: 26.4,                              // Mbps
  ping: 36.95,                               // milliseconds
  jitter: 2.5,                               // milliseconds
  downloadLatency: 45.2,                     // milliseconds
  uploadLatency: 47.8,                       // milliseconds
  server: "ISP-Server-5",                    // Random server
  isp: "Local ISP",                          // Fixed ISP name
  result_url: "https://www.speedtest.net/...", // Fake result URL
  downloadBytes: 237568000,                  // Bytes from ~10s test
  uploadBytes: 33177600                      // Bytes from ~10s test
}
```

## Running the Script

### Prerequisites
```bash
# Ensure you're in the project root
cd e:\Coding\Ezé-U Internet Monitor

# Install dependencies (if not already done)
npm install
cd backend
npm install
```

### Execute
```bash
# From the backend directory
node add-mock-data.js

# Or from project root
node backend/add-mock-data.js
```

### Output
```
📊 Starting mock data generation...
🔧 Generating mock speed test data for 3 months...
✅ Generated 218 speed test records
💾 Inserting data into database...
✅ Successfully inserted 218 records
📈 Total speed test records in database: 227
📊 Statistics (Last 90 days):
   Total Tests: 227
   Avg Download: 189.08 Mbps
   ...
✨ Mock data generation complete!
```

## Database Changes

### Table: speed_tests
**New Records**: 218 rows added
**Columns Populated**:
- ✅ timestamp
- ✅ download
- ✅ upload
- ✅ ping
- ✅ jitter
- ✅ downloadLatency
- ✅ uploadLatency
- ✅ server
- ✅ isp
- ✅ result_url
- ✅ downloadBytes *(NEW)*
- ✅ uploadBytes *(NEW)*

## Testing the Mock Data

### 1. Dashboard View
After starting the application:
```bash
npm start
```

**Test Cases**:
- [ ] Load Dashboard - Should show 227 speed test records
- [ ] Time Range 1h - Shows recent tests only
- [ ] Time Range 6h - Shows last 6 hours
- [ ] Time Range 24h - Shows last 24 hours
- [ ] Time Range 7d - Shows last 7 days (should have many records)
- [ ] Time Range all - Shows all 227 records
- [ ] Graphs render properly with all data
- [ ] Data usage box shows calculated totals
- [ ] Monthly usage displays correctly

### 2. Data Verification Queries

#### Count Total Records
```sql
SELECT COUNT(*) as total FROM speed_tests;
-- Expected: 227 (or more if you've run tests since data generation)
```

#### View Recent Tests
```sql
SELECT 
  timestamp, 
  download, 
  upload, 
  ping,
  downloadBytes,
  uploadBytes
FROM speed_tests 
ORDER BY timestamp DESC 
LIMIT 10;
```

#### Calculate Monthly Usage
```sql
SELECT 
  COUNT(*) as tests,
  AVG(download) as avg_mbps,
  SUM(downloadBytes) as total_bytes
FROM speed_tests
WHERE datetime(timestamp) >= datetime('now', '-30 days');
```

#### Check Data Distribution
```sql
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as tests_per_day,
  AVG(download) as avg_download
FROM speed_tests
GROUP BY DATE(timestamp)
ORDER BY date DESC
LIMIT 10;
```

### 3. Performance Tests

#### CSV Export
- [ ] Settings → Reports → Export CSV
- Should export all 227+ records
- Verify downloadBytes/uploadBytes included

#### Data Usage Statistics
- [ ] Select 7d time range
- [ ] Should show data usage for that period
- [ ] Total should be reasonable (not 0, not infinite)

#### Monthly Data Cap
- [ ] Set monthly cap in Settings
- [ ] Should show usage % correctly
- [ ] Cap reached status should display

## Realistic Data Characteristics

### Daily Patterns
- Tests scattered throughout the day (not all at same time)
- 2-3 tests per day average
- This matches ISP testing schedule

### Speed Variations
- Download: 150-250 Mbps ± variance
- Upload: 20-35 Mbps ± variance
- Ping: 20-50 ms ± variance
- Reflects real internet fluctuations

### Byte Calculations
- Based on actual test duration (10 seconds)
- Follows formula: (Mbps ÷ 8 × 10 × 1024²) × variance
- Creates realistic data usage amounts

### ISP Distribution
- 10 different ISP servers
- Randomly selected for each test
- More realistic than single server

## FAQ

### Q: Can I run the script multiple times?
**A**: Yes, it will add more records each time. Use to create even more historical data:
```bash
# Run multiple times to create more data
for i in {1..3}; do node add-mock-data.js; done
```

### Q: How do I clear the mock data?
**A**: Use the Dashboard's "Clear History" button, or:
```bash
# Manual SQL reset
sqlite3 monitoring.db "DELETE FROM speed_tests WHERE timestamp > '2025-07-01';"
```

### Q: Can I modify the generated data?
**A**: Edit `add-mock-data.js` to customize:
- `generateSpeedTestData()` function: Change speed ranges
- `for (let daysAgo = 89; daysAgo >= 0; daysAgo--)`: Adjust number of days
- `testsPerDay` calculation: Change tests per day
- ISP servers, names, or other fields

### Q: Does this affect real speed tests?
**A**: No. Mock data is only in the database. Running actual speed tests will add new records alongside mock data.

### Q: Can I use this data for production testing?
**A**: Yes! This data is useful for:
- UI/UX testing with realistic volumes
- Performance testing (large datasets)
- CSV export validation
- Graph rendering stress tests
- Data analysis algorithm verification

### Q: What if I have errors?
**A**: Common issues:
```
Error: Cannot find module 'better-sqlite3'
→ Run: npm install in backend directory

Error: SQLITE_CANTOPEN
→ Check file permissions on monitoring.db

Error: SQLITE_READONLY
→ Close any other database connections
```

## Byte Calculation Details

### Why These Byte Values?
The mock data calculates bytes realistically based on speeds:

```javascript
// Example: 189 Mbps download for 10 seconds
downloadBytes = (189 / 8) * 10 * 1024 * 1024
             = 23.625 MB × 1024 KB/MB × 1024 B/KB
             = 247,726,080 bytes (~236 MB)

// Variance applied (0.8-1.2 multiplier)
Final: 237,568,000 bytes
```

### Total Data Calculation
```
Over 3 months with 227 tests:
- Total Download: 52.27 GB
- Total Upload: 7.33 GB
- Combined: 59.6 GB

Average per test:
- Download: 52.27 GB ÷ 227 = 230 MB
- Upload: 7.33 GB ÷ 227 = 32 MB
- Total: ~262 MB per test
```

## Files Modified

| File | Action | Details |
|------|--------|---------|
| `backend/add-mock-data.js` | Created | New mock data generator script |
| `backend/monitoring.db` | Modified | 218 new speed test records added |

## Next Steps

1. **Start the application**:
   ```bash
   npm start
   ```

2. **Open in browser**:
   - Backend: http://localhost:8745
   - Frontend: http://localhost:4280

3. **Explore the Dashboard**:
   - View 3 months of historical data
   - Test all time range filters
   - Try the CSV export with mock data

4. **Run actual speed tests**:
   - New tests will be added to the same database
   - Mock data will remain alongside real tests

5. **Test features**:
   - Monthly data cap with real usage calculations
   - Data usage statistics across time ranges
   - Performance with larger dataset (227+ records)

## Version History

- **Nov 3, 2025**: Initial mock data generation
  - 227 records across 3 months
  - 59.6 GB total data usage
  - Realistic speed variations
  - Complete byte tracking

---

**For more information**: See `SPEEDTEST_DATA_USAGE_STATUS.md`
