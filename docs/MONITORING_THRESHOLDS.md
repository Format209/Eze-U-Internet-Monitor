# Monitoring Thresholds Configuration

## Overview
Added configurable monitoring thresholds to the Settings page, allowing users to customize when alerts are triggered.

## New Settings (Settings > Monitoring Tab)

### 1. **Max Latency/Ping Threshold** (Default: 100ms)
- **Purpose**: Triggers "High Latency" notification when ping exceeds this value
- **Range**: 10ms - 5000ms
- **Recommended**: 100-200ms for good connections, 300-500ms for slower networks

### 2. **Consecutive Failures Before Alert** (Default: 3)
- **Purpose**: Number of failed pings required before marking a host as DOWN
- **Range**: 1-10 attempts
- **Why it matters**: Prevents false positives from temporary network blips
- **Example**: With 1-second monitoring + 3 failures = 3 seconds of downtime before alert

### 3. **Consecutive Successes Before Recovery** (Default: 2)
- **Purpose**: Number of successful pings required before marking a host as UP
- **Range**: 1-10 attempts
- **Why it matters**: Ensures host is stable before clearing the down state
- **Example**: With 1-second monitoring + 2 successes = 2 seconds of uptime before recovery

### 4. **Packet Loss Threshold** (Default: 10%)
- **Purpose**: Triggers "Packet Loss" notification when loss exceeds this percentage
- **Range**: 1% - 100%
- **Recommended**: 5-10% for critical hosts, 15-20% for less critical

## Configuration Examples

### Ultra-Sensitive Monitoring (Detect issues immediately)
```
Max Latency: 50ms
Consecutive Failures: 1
Consecutive Successes: 1
Packet Loss: 5%
Monitor Interval: 1 second
```
⚠️ **Warning**: May cause false positives on unstable networks

### Balanced Monitoring (Recommended for most users)
```
Max Latency: 100ms
Consecutive Failures: 3
Consecutive Successes: 2
Packet Loss: 10%
Monitor Interval: 5 seconds
```
✅ **Best for**: Home/office networks, reliable detection

### Conservative Monitoring (Avoid false alarms)
```
Max Latency: 200ms
Consecutive Failures: 5
Consecutive Successes: 3
Packet Loss: 20%
Monitor Interval: 10 seconds
```
✅ **Best for**: High-latency connections, noisy networks

### 1-Second Interval Monitoring (Your Setup)
```
Max Latency: 100ms
Consecutive Failures: 3 (= 3 seconds before alert)
Consecutive Successes: 2 (= 2 seconds before recovery)
Packet Loss: 10%
Monitor Interval: 1 second
```
✅ **Result**: Fast detection with protection against false positives

## How It Works

### Host Down Detection
```
Monitor Cycle 1: Ping fails → failureCount = 1
Monitor Cycle 2: Ping fails → failureCount = 2
Monitor Cycle 3: Ping fails → failureCount = 3 → 🔴 HOST DOWN ALERT
```

### Host Recovery Detection
```
Monitor Cycle 1: Ping succeeds → successCount = 1
Monitor Cycle 2: Ping succeeds → successCount = 2 → 🟢 HOST RECOVERED
```

### High Latency Detection
```
Monitor Cycle: Ping = 150ms (threshold = 100ms) → ⚠️ HIGH LATENCY ALERT
```

## Technical Details

### Backend Changes
- Added `monitoringThresholds` to settings schema
- Updated `performQuickMonitor()` to use configurable thresholds
- Defaults ensure backward compatibility

### Frontend Changes
- Added 4 new input fields in Settings > Monitoring tab
- Real-time updates when saved
- Values persist across restarts

### Database
- Settings stored in SQLite `settings` table
- Automatically migrated on first save

## Benefits

✅ **Flexibility**: Adjust thresholds to match your network conditions
✅ **Reliability**: Prevent false positives with consecutive failure counts
✅ **Control**: Fine-tune when notifications trigger
✅ **Performance**: No performance impact, just threshold checks

## Recommended Workflow

1. **Start with defaults** (3 failures, 2 successes, 100ms latency)
2. **Monitor for a day** to see if you get false alerts
3. **Adjust based on results**:
   - Too many false alerts? → Increase consecutive failures
   - Missing real outages? → Decrease consecutive failures
   - Too many latency alerts? → Increase max latency threshold

## Future Enhancements

Possible additions:
- Per-host custom thresholds
- Time-of-day threshold profiles
- Adaptive thresholds based on historical data
- Threshold presets (strict/balanced/lenient)

---

**Last Updated**: October 9, 2025
**Status**: ✅ Implemented and ready to use
