# Mock Data - Quick Start Guide

## ✅ Mock Data Successfully Added!

Your database now contains **227 speed test records** spanning **3 months** (August 6 - November 3, 2025).

### 📊 What You Got

| Metric | Value |
|--------|-------|
| Total Records | 227 speed tests |
| Time Period | 90 days (3 months) |
| Avg Download | 189.08 Mbps |
| Avg Upload | 26.4 Mbps |
| Avg Ping | 36.95 ms |
| Total Data Used | 59.6 GB |
| Last 7 Days | 18 tests |
| Last 30 Days | 81 tests |

## 🚀 Quick Start

### 1. Start the Application
```bash
cd 'e:\Coding\Ezé-U Internet Monitor'
npm start
```

### 2. Open in Browser
- **Backend**: http://localhost:8745
- **Frontend**: http://localhost:4280

### 3. View the Dashboard
You should see:
- ✅ 227 speed test records
- ✅ Complete 3-month history
- ✅ Download/upload graphs with data
- ✅ Data usage statistics
- ✅ 59.6 GB total data tracked

## 🧪 Test Cases to Try

### Time Range Filtering
- [ ] Click **1h** - Shows recent tests only
- [ ] Click **6h** - Shows tests from last 6 hours
- [ ] Click **24h** - Shows tests from last 24 hours
- [ ] Click **7d** - Shows 18 tests from last 7 days
- [ ] Click **all** - Shows all 227 tests

### Data Usage Box
Select different time ranges and verify:
- Download bytes are calculated correctly
- Upload bytes are calculated correctly
- Total data is sum of download + upload
- Test count shows number of tests in range

### Graph Visualization
- Line charts display data correctly
- X-axis shows timestamps
- Y-axis shows speeds (Mbps)
- No console errors
- Graphs load within 2 seconds

### Export Features
- [ ] Go to Settings → Reports
- [ ] Click "Export CSV"
- [ ] Verify file contains all 227+ records
- [ ] Check downloadBytes and uploadBytes columns

### Monthly Data Cap
- [ ] Go to Settings → Performance Thresholds
- [ ] Set monthly cap to "50 GB"
- [ ] Dashboard should show: ~60% usage (59.6 GB of 50 GB cap)
- [ ] Change to "10 GB" → Should show 596% (over cap)

## 📈 Verify Mock Data

### Using the Verification Script
```bash
cd backend
node verify-mock-data.js
```

**Expected Output**:
- ✅ 227 total records
- ✅ 59.6 GB data usage
- ✅ 189 Mbps average download
- ✅ 98% data quality (minimal zeros)
- ✅ Good distribution across months
- ✅ Random distribution across ISP servers

### Using Database Browser
```bash
# Open with SQLite viewer
sqlite3 backend/monitoring.db

# Run queries
SELECT COUNT(*) FROM speed_tests;
SELECT AVG(download) FROM speed_tests;
SELECT SUM(downloadBytes) FROM speed_tests;
```

## 🎯 What to Test

### 1. Dashboard Rendering
- [ ] Dashboard loads without errors
- [ ] All graphs display correctly
- [ ] Data usage box shows numbers
- [ ] No "Loading..." messages stuck

### 2. Time Range Filters
- [ ] Each time range shows different data
- [ ] Graph updates when time range changes
- [ ] Data usage box recalculates
- [ ] Correct record count for each range

### 3. Performance
- [ ] Dashboard loads in < 2 seconds
- [ ] Time range change in < 1 second
- [ ] No freezing or lag
- [ ] Browser dev tools show no errors

### 4. Data Accuracy
- [ ] Download speeds around 150-250 Mbps range
- [ ] Upload speeds around 20-35 Mbps range
- [ ] Ping speeds around 20-50 ms range
- [ ] Bytes calculated from speeds (not random)

### 5. Monthly Data Cap Feature
- [ ] Set a 100 GB cap
- [ ] Dashboard shows warning (59.6 GB / 100 GB = 59.6%)
- [ ] Warning banner is blue (< 80%)
- [ ] Set 50 GB cap
- [ ] Warning turns yellow/red (> 80%)
- [ ] Shows correct percentage

### 6. CSV Export
- [ ] Export all records
- [ ] Verify 227+ rows in CSV
- [ ] Check downloadBytes column exists
- [ ] Check uploadBytes column exists
- [ ] Can open in Excel/Sheets

## 📋 Sample Queries

### View Recent 10 Tests
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

### Calculate Monthly Usage
```sql
SELECT 
  strftime('%Y-%m', timestamp) as month,
  COUNT(*) as tests,
  ROUND(AVG(download), 1) as avg_mbps,
  ROUND(SUM(downloadBytes + uploadBytes) / 1024 / 1024 / 1024, 2) as data_gb
FROM speed_tests
GROUP BY strftime('%Y-%m', timestamp)
ORDER BY month DESC;
```

### Check Data Quality
```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN downloadBytes > 0 THEN 1 END) as with_bytes,
  COUNT(CASE WHEN download > 0 THEN 1 END) as with_speeds
FROM speed_tests;
```

## 🛠️ Troubleshooting

### Mock data not showing?
1. Refresh the browser page
2. Check browser console for errors
3. Verify backend is running:
   ```bash
   curl http://localhost:8745/api/history?limit=10
   ```
4. Restart the application

### Graphs showing wrong data?
1. Verify time range filter is selected
2. Check if data range matches filter (e.g., "7d" includes data from 7 days ago)
3. Open browser dev tools → Network tab
4. Check `/api/history` response

### Export showing only recent data?
1. Select **all** time range first
2. Then export
3. Verify frontend is fetching limit=1000 (not 100)

### Monthly cap not calculating correctly?
1. Verify total bytes: 59.6 GB ÷ cap = percentage
2. Check if calculation formula is correct
3. Verify API endpoint `/api/monthly-usage`

## 📚 Related Documentation

- [MOCK_DATA_DOCUMENTATION.md](MOCK_DATA_DOCUMENTATION.md) - Complete details
- [SPEEDTEST_DATA_USAGE_STATUS.md](SPEEDTEST_DATA_USAGE_STATUS.md) - Feature status
- [DATA_RETENTION_POLICY.md](DATA_RETENTION_POLICY.md) - How data is stored

## 🔄 Next Steps

### Add More Data
```bash
# Run the generator again to create more records
cd backend
node add-mock-data.js
```

### Run Actual Speed Tests
Once you're happy with the mock data:
1. Open Settings → Monitoring tab
2. Set test interval (e.g., 30 minutes)
3. Click "Start Monitoring"
4. New tests will be added to the same database

### Clear and Restart
To remove mock data and start fresh:
1. Dashboard → Clear History button
2. OR manually: `DELETE FROM speed_tests;`

## 💡 Tips

✅ **Tip 1**: Mock data will be mixed with real tests - that's fine!

✅ **Tip 2**: Each time you run `add-mock-data.js`, it adds MORE data (doesn't replace)

✅ **Tip 3**: Try setting different monthly caps to see warning colors change

✅ **Tip 4**: Export the CSV to verify all data fields are present

✅ **Tip 5**: Use the verification script to spot-check data quality

## 📞 Support

If you encounter issues:
1. Check the backend logs for errors
2. Verify database file exists: `backend/monitoring.db`
3. Check file permissions on `monitoring.db`
4. Try restarting the application
5. Check browser console (F12) for frontend errors

---

**Status**: ✅ Ready to test!  
**Records**: 227 speed tests  
**Data Span**: 90 days (3 months)  
**Last Updated**: November 3, 2025
