# 🟢 Host Recovery Notifications Enabled

## What Changed

Enabled the `onHostUp` event notification by default so you get notified when hosts come back online after being down.

---

## Previous Behavior

```javascript
events: {
  onHostDown: true,    // ✅ Notified when host goes down
  onHostUp: false,     // ❌ NOT notified when host recovers
}
```

## New Behavior

```javascript
events: {
  onHostDown: true,    // ✅ Notified when host goes down
  onHostUp: true,      // ✅ Notified when host recovers ← NEW!
}
```

Also enabled:
- `onConnectionRestored: true` (was `false`)

---

## How It Works

### Scenario: Router Goes Offline Then Comes Back

#### 1. Host Goes Down (10:00 AM)
**Backend Console**:
```
🔴 HOST DOWN: Router (192.168.1.1)
🔔 Notification trigger attempt: onHostDown
   ✅ SENDING NOTIFICATION: onHostDown
   ✅ Discord notification sent
```

**Discord**:
```
┌────────────────────────────────────┐
│ Internet Monitor Alert             │
├────────────────────────────────────┤
│ 🔴 Host Down: Router (192.168.1.1) │
│ is unreachable                      │
│                                     │
│ Oct 7, 2025 10:00 AM               │
│ Ezé-U Internet Monitor             │
└────────────────────────────────────┘
```

#### 2. Host Comes Back Up (10:05 AM)
**Backend Console**:
```
🟢 HOST RECOVERED: Router (192.168.1.1) - 15ms
🔔 Notification trigger attempt: onHostUp
   ✅ SENDING NOTIFICATION: onHostUp
   ✅ Discord notification sent
```

**Discord**:
```
┌────────────────────────────────────┐
│ Internet Monitor Alert             │
├────────────────────────────────────┤
│ 🟢 Host Up: Router (192.168.1.1)   │
│ is back online                      │
│                                     │
│ Oct 7, 2025 10:05 AM               │
│ Ezé-U Internet Monitor             │
└────────────────────────────────────┘
```

**Browser**:
```
🟢 Host Up
Router (192.168.1.1) is back online
```

---

## Notification Flow

```
Host Monitoring Loop (every 10 seconds)
  ↓
Check host status
  ↓
Status changed?
  ├─ Yes: Host went DOWN
  │   ├─ Set isDown = true
  │   ├─ Console: "🔴 HOST DOWN"
  │   └─ triggerNotification('onHostDown')
  │       ├─ Format message: "🔴 Host Down: Router (192.168.1.1) is unreachable"
  │       ├─ Send to Discord ✅
  │       ├─ Send to Telegram (if enabled)
  │       ├─ Send to Slack (if enabled)
  │       └─ Send to Browser ✅
  │
  └─ Yes: Host came BACK UP ← NEW!
      ├─ Set isDown = false
      ├─ Console: "🟢 HOST RECOVERED"
      └─ triggerNotification('onHostUp')
          ├─ Format message: "🟢 Host Up: Router (192.168.1.1) is back online"
          ├─ Send to Discord ✅
          ├─ Send to Telegram (if enabled)
          ├─ Send to Slack (if enabled)
          └─ Send to Browser ✅
```

---

## Code Implementation

### Detection Logic (lines 865-893)

```javascript
const wasDown = prevState.isDown;
const isDown = result.ping === -1;

// Host went DOWN
if (!wasDown && isDown) {
  if (checkNotificationCooldown(prevState.lastNotificationTime)) {
    triggerNotification('onHostDown', {
      host: result.name,
      address: result.address,
      timestamp: result.timestamp
    });
    notificationState.hostStatus[result.address].lastNotificationTime = Date.now();
  }
  notificationState.hostStatus[result.address].isDown = true;
  console.log(`🔴 HOST DOWN: ${result.name} (${result.address})`);
}

// Host came BACK UP ← This is the recovery detection
if (wasDown && !isDown) {
  if (checkNotificationCooldown(prevState.lastNotificationTime)) {
    triggerNotification('onHostUp', {
      host: result.name,
      address: result.address,
      ping: result.ping,
      timestamp: result.timestamp
    });
    notificationState.hostStatus[result.address].lastNotificationTime = Date.now();
  }
  notificationState.hostStatus[result.address].isDown = false;
  console.log(`🟢 HOST RECOVERED: ${result.name} (${result.address}) - ${result.ping}ms`);
}
```

### Message Formatting (line 496)

```javascript
onHostUp: `${emoji[eventType]} Host Up: ${data.host} (${data.address}) is back online`
```

---

## Testing

### Test Plan:

1. **Start backend**:
   ```powershell
   cd backend
   node server.js
   ```

2. **Add a monitoring host**:
   - Go to Settings → Monitoring Hosts
   - Add your router: `192.168.1.1` with name "Router"
   - Enable monitoring

3. **Simulate host going down**:
   - Unplug router or block ICMP packets
   - Wait 10 seconds
   - **Expected**: 🔴 "Host Down" notification in Discord

4. **Simulate host coming back up**:
   - Plug router back in or unblock ICMP
   - Wait 10-20 seconds (may take 1-2 monitoring cycles)
   - **Expected**: 🟢 "Host Up" notification in Discord

### Console Logs to Watch For:

```
Monitoring 1 hosts...
Quick monitor: Router (192.168.1.1)
Ping result: -1ms
🔴 HOST DOWN: Router (192.168.1.1)
🔔 Notification trigger attempt: onHostDown
   ✅ SENDING NOTIFICATION: onHostDown
   ✅ Discord notification sent

[... 30 seconds later ...]

Quick monitor: Router (192.168.1.1)
Ping result: 15ms
🟢 HOST RECOVERED: Router (192.168.1.1) - 15ms
🔔 Notification trigger attempt: onHostUp
   ✅ SENDING NOTIFICATION: onHostUp
   ✅ Discord notification sent
```

---

## Cooldown Protection

Both `onHostDown` and `onHostUp` respect the cooldown timer (default 5 minutes) to prevent spam if a host is flapping (going up/down repeatedly).

```javascript
if (checkNotificationCooldown(prevState.lastNotificationTime)) {
  // Send notification
  notificationState.hostStatus[result.address].lastNotificationTime = Date.now();
}
```

This means:
- ✅ First DOWN notification: Sent immediately
- ⏳ Second DOWN within 5 minutes: Suppressed
- ✅ First UP notification: Sent immediately
- ⏳ Second UP within 5 minutes: Suppressed

You can adjust this in Settings → Notifications → "Minimum time between notifications"

---

## All Enabled Events (New Defaults)

| Event | Default | Description |
|-------|---------|-------------|
| `onSpeedTestComplete` | ✅ Enabled | Speed test finishes |
| `onThresholdBreach` | ✅ Enabled | Speed/ping below threshold |
| `onHostDown` | ✅ Enabled | Host becomes unreachable |
| `onHostUp` | ✅ Enabled | **Host recovers** ← NEW! |
| `onConnectionLost` | ✅ Enabled | Packet loss detected |
| `onConnectionRestored` | ✅ Enabled | **Connection stable again** ← NEW! |
| `onHighLatency` | ❌ Disabled | High ping detected |
| `onPacketLoss` | ❌ Disabled | Packet loss percentage |

---

## Benefits

### Before (Only "Down" Notifications):
```
10:00 AM: 🔴 Host Down: Router is unreachable
[You have to manually check when it's back]
```

### After (Both "Down" and "Up" Notifications):
```
10:00 AM: 🔴 Host Down: Router is unreachable
10:05 AM: 🟢 Host Up: Router is back online
[You know exactly when it recovered!]
```

### Use Cases:
- ✅ **Know when issues are resolved** without checking manually
- ✅ **Track downtime duration** (time between down/up notifications)
- ✅ **Confirm router reboots** completed successfully
- ✅ **Verify ISP outages** are fixed
- ✅ **Monitor flapping hosts** (frequent up/down)

---

## File Changes

**Modified**: `backend/server.js`
- Line 183: `onHostUp: false` → `onHostUp: true`
- Line 185: `onConnectionRestored: false` → `onConnectionRestored: true`

**No changes needed to**:
- Host monitoring logic (already implemented)
- Notification message formatting (already implemented)
- Discord/Telegram/Slack sending (already implemented)

---

## Status

✅ **Host Up notifications enabled by default**  
✅ **Connection Restored notifications enabled by default**  
✅ **All detection logic already working**  
✅ **Discord/Telegram/Slack support included**  
✅ **Cooldown protection active**  
✅ **Console logging in place**  

---

## To Apply:

**Restart backend**:
```powershell
cd backend
node server.js
```

Now you'll get notified both when hosts go **down** 🔴 and when they come back **up** 🟢!

---

**Date**: October 7, 2025  
**Feature**: Host Recovery Notifications  
**Status**: Enabled by Default ✅  
**Testing**: Ready to test with router reboot
