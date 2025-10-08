# Ookla Speedtest CLI Setup Guide

The application has been updated to use the **official Ookla Speedtest CLI** instead of the `speedtest-net` npm package. This provides more accurate and detailed test results directly from Ookla.

## Installation Instructions

### Windows (PowerShell as Administrator)

#### Option 1: Using Chocolatey (Recommended)
```powershell
choco install speedtest
```

#### Option 2: Using Winget
```powershell
winget install Ookla.Speedtest.CLI
```

#### Option 3: Manual Installation
1. Download from: https://www.speedtest.net/apps/cli
2. Extract `speedtest.exe` to a folder (e.g., `C:\Program Files\Speedtest`)
3. Add the folder to your system PATH environment variable
4. Restart your terminal/IDE

### Verify Installation

After installation, verify it works:
```powershell
speedtest --version
speedtest --accept-license --accept-gdpr --format=json
```

## Changes Made

### 1. **Removed Dependencies**
- ❌ Removed `speedtest-net` npm package
- ✅ Using native `child_process` with `speedtest` CLI command

### 2. **Enhanced Data Collection**
The Ookla CLI provides more detailed JSON output including:
- `download.latency.iqm` - Interquartile mean latency
- `download.latency.low` - Minimum latency
- `download.latency.high` - Maximum latency  
- `download.latency.jitter` - Download jitter
- `upload.latency.*` - Same metrics for upload
- `ping.latency` - Ping latency
- `ping.jitter` - Ping jitter

### 3. **Improved Extraction Logic**
The code now extracts latency in priority order:
1. `iqm` (most accurate - interquartile mean)
2. `high` (maximum latency)
3. `low` (minimum latency)
4. Falls back to `0` if unavailable

### 4. **Better Error Handling**
- Progressive retry delays: 10s, 20s, 30s, 40s
- Detailed error classification
- Comprehensive logging with emojis for clarity

## Expected Behavior

### If Ookla CLI Provides Latency:
```
✅ Speed test details: {
  downloadLatency: 15.23,
  uploadLatency: 12.45,
  note: '✅ Detailed latency data retrieved successfully'
}
```

### If Server Doesn't Provide Latency:
```
⚠️ Speed test details: {
  downloadLatency: 0,
  uploadLatency: 0,
  note: '⚠️ NOTE: Latency values are 0 - Ookla server may not provide detailed latency metrics'
}
```

## Advantages Over speedtest-net

1. **Official Ookla Tool** - Direct from Speedtest.net
2. **More Accurate** - No wrapper overhead
3. **Better JSON Output** - More detailed metrics
4. **Regular Updates** - Maintained by Ookla
5. **Same Servers** - Uses official Speedtest server network

## Troubleshooting

### "speedtest is not recognized as a command"
- Ensure Speedtest CLI is installed
- Verify it's in your system PATH
- Restart VS Code/terminal after installation

### First Run License Acceptance
The CLI automatically accepts licenses with:
```
--accept-license --accept-gdpr
```

### Firewall Issues
If tests fail, ensure your firewall allows:
- Outbound connections to Speedtest servers
- Ports 8080 and 80 for HTTP testing

## Fallback Option

If the Ookla CLI doesn't work, you can revert to `speedtest-net`:

1. Install: `npm install speedtest-net`
2. Restore the old code from git history
3. The npm package will still work but with less detailed output

## Next Steps

1. Install Ookla Speedtest CLI using one of the methods above
2. Verify installation with `speedtest --version`
3. Run the application: `cd backend && npm start`
4. Trigger a manual speed test from the dashboard
5. Check terminal logs to see detailed latency data

The application will now use the official Ookla CLI for more accurate speed testing!
