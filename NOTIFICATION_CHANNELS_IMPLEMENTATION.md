# 🔔 Notification Channels Implementation

## Issue Fixed

Notifications were configured in settings but **not actually being sent** to external services like Discord, Telegram, Slack, etc. The backend was only broadcasting to the frontend for browser notifications.

---

## Root Cause

The `triggerNotification()` function in `backend/server.js` was only:
1. ✅ Broadcasting to WebSocket (for browser notifications)
2. ❌ NOT sending to Discord webhooks
3. ❌ NOT sending to Telegram
4. ❌ NOT sending to Slack
5. ❌ NOT sending to custom webhooks
6. ❌ NOT sending emails

---

## Solution Implemented

### 1. Added Axios Dependency
```bash
npm install axios
```

### 2. Implemented Notification Channel Functions

Added the following functions to `backend/server.js`:

#### `formatNotificationMessage(eventType, data)`
- Formats notification messages with emojis
- Creates human-readable messages for each event type
- Examples:
  - `🔴 Host Down: Router (192.168.1.1) is unreachable`
  - `✅ Speed Test Complete: ↓95.3 Mbps / ↑11.2 Mbps / 15ms ping`

#### `sendToNotificationChannels(notificationSettings, message, eventType, data)`
- Main dispatcher function
- Checks which channels are enabled
- Calls appropriate send functions for each enabled channel

#### `sendDiscordNotification(webhookUrl, message, eventType, data)`
- Sends rich embed messages to Discord
- Red color for errors (Down, Lost, Breach)
- Green color for success (Up, Restored, Complete)
- Includes timestamp and footer

#### `sendTelegramNotification(telegramConfig, message)`
- Sends messages via Telegram Bot API
- Uses bot token and chat ID
- Supports HTML formatting

#### `sendSlackNotification(webhookUrl, message)`
- Sends simple text messages to Slack
- Uses incoming webhook URL

#### `sendWebhookNotification(webhookConfig, message, eventType, data)`
- Sends to custom webhook URLs
- Configurable HTTP method (POST, PUT, etc.)
- Configurable headers
- Sends JSON payload with event, message, data, timestamp

#### `sendEmailNotification(emailConfig, message, eventType)`
- Placeholder for email notifications
- Requires `nodemailer` to be installed
- Currently logs email would be sent

---

## How It Works Now

### Notification Flow:

```
Event Detected → triggerNotification() → Format Message → Send to Channels
                                                          ├→ Discord ✅
                                                          ├→ Telegram ✅
                                                          ├→ Slack ✅
                                                          ├→ Webhook ✅
                                                          ├→ Email (future)
                                                          └→ Browser (WebSocket) ✅
```

### Example: Host Goes Down

1. **Event Detected**:
   ```javascript
   performQuickMonitor() // Detects host is down
   ```

2. **Trigger Notification**:
   ```javascript
   triggerNotification('onHostDown', {
     host: 'Router',
     address: '192.168.1.1',
     timestamp: '2025-10-07T13:41:40.800Z'
   });
   ```

3. **Format Message**:
   ```
   "🔴 Host Down: Router (192.168.1.1) is unreachable"
   ```

4. **Send to Enabled Channels**:
   - ✅ Discord: Rich embed with red color
   - ✅ Browser: WebSocket notification → Browser API
   - ❌ Telegram: (if disabled)
   - ❌ Email: (if disabled)

---

## Discord Notification Example

### What You'll See in Discord:

```
┌─────────────────────────────────────┐
│ Internet Monitor Alert              │
├─────────────────────────────────────┤
│ 🔴 Host Down: test (192.168.110.12) │
│ is unreachable                       │
│                                      │
│ Oct 7, 2025 1:41 PM                 │
│ Ezé-U Internet Monitor              │
└─────────────────────────────────────┘
```

### Embed Colors:
- 🔴 **Red** (`0xFF0000`): `onHostDown`, `onConnectionLost`, `onThresholdBreach`, `onHighLatency`, `onPacketLoss`
- 🟢 **Green** (`0x00FF00`): `onHostUp`, `onConnectionRestored`, `onSpeedTestComplete`

---

## Console Logs

### When Notification Triggers:

```
🔔 Notification trigger attempt: onHostDown
   Notification settings: {...}
   ✅ SENDING NOTIFICATION: onHostDown {...}
📡 Broadcasting to 1 connected clients: notification
   ✅ Sent to 1 clients
   ✅ Discord notification sent
```

### If Discord Fails:

```
   ❌ Discord notification failed: Request failed with status code 404
```

Common failures:
- **404**: Invalid webhook URL
- **401**: Webhook was deleted
- **Network error**: No internet connection
- **Timeout**: Discord API is slow/down

---

## Notification Message Formats

### Event: `onHostDown`
```
🔴 Host Down: Router (192.168.1.1) is unreachable
```

### Event: `onHostUp`
```
🟢 Host Up: Router (192.168.1.1) is back online
```

### Event: `onConnectionLost`
```
⚠️ Connection Lost: Router (192.168.1.1) - 5 packets lost
```

### Event: `onConnectionRestored`
```
✅ Connection Restored: Router (192.168.1.1) is stable again
```

### Event: `onHighLatency`
```
🐌 High Latency: Router (192.168.1.1) - 250ms (threshold: 100ms)
```

### Event: `onPacketLoss`
```
📉 Packet Loss: Router (192.168.1.1) - 25% packet loss
```

### Event: `onSpeedTestComplete`
```
✅ Speed Test Complete: ↓95.3 Mbps / ↑11.2 Mbps / 15ms ping
```

### Event: `onThresholdBreach`
```
⚠️ Threshold Breach: Download 45.2 Mbps (min: 50), Upload 8.5 Mbps (min: 10), Ping 85ms (max: 50)
```

---

## Testing Notifications

### 1. Verify Settings in Database

```powershell
cd backend
sqlite3 monitoring.db "SELECT notificationSettings FROM settings WHERE id = 1" | jq .
```

Should show:
```json
{
  "enabled": true,
  "types": {
    "discord": {
      "enabled": true,
      "webhookUrl": "https://discord.com/api/webhooks/..."
    }
  },
  "events": {
    "onHostDown": true,
    "onHostUp": true
  }
}
```

### 2. Test Discord Webhook Manually

```powershell
$webhook = "https://discord.com/api/webhooks/1425114948299915264/sK318Hexu-cA-QxzgyuAcck563Yc5y8qUpT6YUXe1_CaQO-1oQFglo_0okrdjDvq2r_B"

$body = @{
  embeds = @(
    @{
      title = "Test Notification"
      description = "🔔 This is a test from PowerShell"
      color = 16711680
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri $webhook -Method Post -Body $body -ContentType "application/json"
```

### 3. Trigger Real Notification

1. **Add a monitoring host**:
   - Go to Settings → Monitoring Hosts
   - Add host with address that will fail (e.g., `192.168.110.12`)
   - Enable monitoring

2. **Wait for monitoring cycle** (~10 seconds)

3. **Check backend console**:
   ```
   🔔 Notification trigger attempt: onHostDown
   ✅ SENDING NOTIFICATION: onHostDown
   ✅ Discord notification sent
   ```

4. **Check Discord channel** for the message

---

## Troubleshooting

### No Discord Message Received

#### Check 1: Verify Webhook URL
```javascript
// In Settings, Discord webhook should look like:
https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN
```

#### Check 2: Check Console Logs
```
   ✅ Discord notification sent  ← Success
   ❌ Discord notification failed: [error]  ← Failed
```

#### Check 3: Test Webhook Manually
Use PowerShell command above or curl:
```bash
curl -X POST "YOUR_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test message"}'
```

#### Check 4: Verify Event is Enabled
```
   ❌ Event onHostDown is disabled  ← Event toggled off
```

#### Check 5: Check Quiet Hours
```
   ⏰ Notification suppressed (quiet hours)  ← In quiet hours
```

### Discord Webhook Returns 404

**Cause**: Webhook was deleted or URL is wrong

**Solution**:
1. Go to Discord Server Settings → Integrations → Webhooks
2. Create new webhook or copy existing one
3. Update URL in settings
4. Save settings

### Discord Webhook Returns 401

**Cause**: Webhook token is invalid

**Solution**: Same as 404 - create new webhook

### No Browser Notification

#### Check 1: Permission Granted?
```javascript
// In browser console:
Notification.permission  // Should be "granted"
```

#### Check 2: WebSocket Connected?
```
📨 WebSocket message received: notification  ← Should see this
🔔 Notification received: onHostDown  ← And this
```

#### Check 3: Browser Supports Notifications?
```javascript
// In browser console:
"Notification" in window  // Should be true
```

---

## Notification Channels Status

| Channel | Status | Requirements |
|---------|--------|--------------|
| **Browser** | ✅ Working | Browser permission granted |
| **Discord** | ✅ Working | Valid webhook URL |
| **Telegram** | ✅ Implemented | Bot token + Chat ID |
| **Slack** | ✅ Implemented | Incoming webhook URL |
| **Webhook** | ✅ Implemented | Custom URL + method |
| **Email** | ⚠️ Partial | Requires nodemailer |
| **SMS** | ❌ Not implemented | Requires Twilio SDK |

---

## Code Changes

### Files Modified:

1. **`backend/server.js`**:
   - Added `const axios = require('axios');`
   - Added `formatNotificationMessage()` function
   - Added `sendToNotificationChannels()` function
   - Added `sendDiscordNotification()` function
   - Added `sendTelegramNotification()` function
   - Added `sendSlackNotification()` function
   - Added `sendWebhookNotification()` function
   - Added `sendEmailNotification()` function (placeholder)
   - Updated `triggerNotification()` to call channel functions

2. **`backend/package.json`**:
   - Added `axios` dependency

3. **`frontend/src/App.js`**:
   - Added debug logging to WebSocket message handler
   - Shows all incoming WebSocket messages in console

---

## Next Steps

### To Enable Email Notifications:

1. **Install nodemailer**:
   ```bash
   cd backend
   npm install nodemailer
   ```

2. **Implement email function**:
   ```javascript
   const nodemailer = require('nodemailer');
   
   async function sendEmailNotification(emailConfig, message, eventType) {
     const transporter = nodemailer.createTransport({
       host: emailConfig.smtp.host,
       port: emailConfig.smtp.port,
       secure: emailConfig.smtp.port === 465,
       auth: {
         user: emailConfig.smtp.user,
         pass: emailConfig.smtp.password
       }
     });
     
     await transporter.sendMail({
       from: emailConfig.smtp.user,
       to: emailConfig.address,
       subject: `Internet Monitor Alert: ${eventType}`,
       text: message,
       html: `<p>${message}</p>`
     });
   }
   ```

### To Enable SMS Notifications (Twilio):

1. **Install Twilio SDK**:
   ```bash
   npm install twilio
   ```

2. **Implement SMS function**:
   ```javascript
   const twilio = require('twilio');
   
   async function sendSMSNotification(smsConfig, message) {
     const client = twilio(smsConfig.accountSid, smsConfig.authToken);
     
     await client.messages.create({
       body: message,
       from: smsConfig.fromNumber,
       to: smsConfig.toNumber
     });
   }
   ```

---

## Testing Checklist

- [x] Axios installed
- [x] Discord webhook sending implemented
- [x] Telegram sending implemented
- [x] Slack sending implemented
- [x] Custom webhook sending implemented
- [x] Browser notifications working via WebSocket
- [x] Debug logging added
- [x] Error handling implemented
- [ ] Email notifications (requires nodemailer)
- [ ] SMS notifications (requires Twilio)

---

## Status

✅ **Backend Notification Channels Implemented**  
✅ **Discord Notifications Working**  
✅ **Telegram Notifications Ready**  
✅ **Slack Notifications Ready**  
✅ **Webhook Notifications Ready**  
✅ **Debug Logging Enhanced**  
✅ **Error Handling Added**  
⚠️  **Email Notifications Require nodemailer**  
❌ **SMS Notifications Not Yet Implemented**  

---

## To Apply Changes:

1. **Restart backend server**:
   ```powershell
   cd backend
   node server.js
   ```

2. **Refresh browser** (F5)

3. **Test Discord notifications**:
   - Add a host that will fail
   - Wait 10 seconds
   - Check Discord for message
   - Check backend console for logs

---

**Date**: October 7, 2025  
**Feature**: External Notification Channels  
**Status**: Implemented ✅  
**Testing**: Ready for verification
