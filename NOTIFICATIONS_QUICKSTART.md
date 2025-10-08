# 🚀 Notifications Quick Start Guide

## Step 1: Restart Backend Server

The backend has been updated with full notification support. You need to restart it:

1. **Stop the current backend** (if running):
   - Close the terminal running `node server.js`, OR
   - Press `Ctrl+C` in the backend terminal

2. **Start the backend**:
   ```powershell
   cd backend
   node server.js
   ```

3. **Verify it's running**:
   - Look for: `Server running on port 5000`
   - Look for: `Database loaded successfully`
   - Look for: `Starting monitoring automatically...`

---

## Step 2: Refresh Frontend

Refresh your browser (F5 or Ctrl+R) to load the new notification handler.

---

## Step 3: Enable Notifications

1. Go to **Settings Tab**
2. Click **Notifications Tab**
3. Toggle **Enable Notifications** to ON
4. Ensure **Browser** channel is enabled (should be by default)
5. Check the events you want:
   - ✅ **Host Down** (recommended)
   - ✅ **Host Recovered** (recommended)
   - ✅ **Threshold Breach** (recommended)
   - ✅ **Connection Lost** (recommended)
   - ⬜ **Speed Test Complete** (optional, can be noisy)
6. Click **Save Settings**

---

## Step 4: Grant Browser Permission

1. Click the **"Send Test Notification"** button (bottom of Notifications tab)
2. Your browser will ask for notification permission
3. Click **"Allow"**
4. You should see a test notification appear!

---

## Step 5: Test with Live Monitoring

### Add a Device to Monitor:
1. Go to **Settings → Monitoring Tab**
2. Add a new host:
   - **Address**: Your router IP (e.g., `192.168.1.1`) or any local device
   - **Name**: "My Router" or "My PC"
   - **Enabled**: ✅ ON
3. Click **Add Host**
4. Click **Save Settings**

### Simulate Host Down:
1. **Unplug the device** OR **turn off WiFi** on your phone/laptop
2. Wait **5-10 seconds**
3. **Expected Result**: You should see:
   ```
   🔴 Host Down
   My Router (192.168.1.1) is unreachable
   ```

### Simulate Host Recovery:
1. **Plug the device back in** OR **turn WiFi back on**
2. Wait **5-10 seconds**
3. **Expected Result**: You should see:
   ```
   🟢 Host Recovered
   My Router (192.168.1.1) is back online - 5ms
   ```

---

## Debug Checklist

If notifications aren't working, check:

### 1. Backend Logs
Look in the backend console for:
```
🔔 Notification trigger attempt: onHostDown
   Notification settings: { enabled: true, ... }
   ✅ SENDING NOTIFICATION: onHostDown
```

If you see:
```
   ❌ Notifications disabled in settings
```
→ Go enable notifications in Settings

If you see:
```
   ❌ Event onHostDown is disabled
```
→ Go check the event checkboxes in Notifications tab

### 2. Frontend Console
Open browser DevTools (F12) and look for:
```
🔔 Notification received: onHostDown { ... }
```

If you don't see this, check:
- WebSocket connection status
- Any console errors

### 3. Browser Notifications
Check:
- Browser notification permission granted (not blocked)
- Not in Do Not Disturb mode
- Notifications enabled in OS settings

### 4. Settings Saved
Make sure you clicked **Save Settings** after:
- Enabling notifications
- Checking event checkboxes
- Adding monitoring hosts

---

## What Should Happen

Once everything is set up correctly:

### Every 5 Seconds:
- Backend pings all enabled hosts
- Detects status changes (up/down)
- Logs ping results in console

### When Host Goes Down:
1. Backend detects: `ping === -1`
2. Backend logs: `🔴 HOST DOWN: Router (192.168.1.1)`
3. Backend triggers notification
4. Backend logs: `✅ SENDING NOTIFICATION: onHostDown`
5. Backend broadcasts to frontend via WebSocket
6. Frontend receives notification event
7. Frontend logs: `🔔 Notification received: onHostDown`
8. Frontend shows browser notification
9. You see: **"🔴 Host Down - Router (192.168.1.1) is unreachable"**
10. Sound plays (if enabled)

### When Host Comes Back:
Same flow, but with `onHostUp` event and green notification.

---

## Testing Connection Lost

1. **Disconnect internet completely** (unplug router or disable network adapter)
2. Wait for **all hosts to timeout** (~10-15 seconds)
3. **Expected**: "🔴 Connection Lost - All monitored hosts are unreachable"
4. **Reconnect internet**
5. **Expected**: "🟢 Connection Restored"

---

## Cooldown Behavior

To prevent spam, there's a **5-minute cooldown** between same event types:

```
10:00 → Host goes down → Notification sent ✅
10:02 → Host still down → No notification (cooldown)
10:03 → Host still down → No notification (cooldown)
10:06 → Host still down → Could send notification again (5 min passed)
```

**Different event types don't share cooldowns**:
```
10:00 → Host down → Notification sent ✅
10:01 → Host up → Notification sent ✅ (different event)
```

---

## Need Help?

Check the backend console logs - they'll show you exactly why notifications aren't being sent:
- `❌ Notifications disabled` → Enable in Settings
- `❌ Event onHostDown is disabled` → Check event checkboxes
- `⏰ Notification suppressed (quiet hours)` → Disable quiet hours or wait
- Nothing logged → Backend not detecting status change

---

**Status**: Ready to test! 🎉

**Last Updated**: October 7, 2025
