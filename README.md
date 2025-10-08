# Ezé-U Internet Monitor

A modern, real-time internet monitoring application with advanced speed testing capabilities. Monitor your internet connection with live data visualization, automated speed tests, multiple host monitoring, and customizable thresholds.

![React 18](https://img.shields.io/badge/react-18-61dafb)
![Node.js](https://img.shields.io/badge/node.js-express-339933)
![WebSocket](https://img.shields.io/badge/realtime-websocket-orange)
![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)

## 📄 License

Copyright (c) 2025 Format209

This project is licensed under the **ISC License** - see the [LICENSE](LICENSE) file for details.

### What This Means
- ✅ **Free to use** for personal and commercial projects
- ✅ **Modify and distribute** as you wish
- ✅ **No warranty** - use at your own risk
- ✅ **Attribution** - keep the copyright notice

The ISC License is a permissive open-source license similar to MIT and BSD, allowing maximum freedom for users while protecting the author from liability.

---

## ✨ Features

### 📊 Dashboard & Monitoring
- **Real-time Speed Tests**: On-demand and automated speed tests using Ookla Speedtest CLI
- **Live Host Monitoring**: Monitor multiple hosts simultaneously with real-time ping updates via WebSocket
- **6 Performance Charts**: Download Speed, Upload Speed, Ping Latency, Jitter, Download Latency, Upload Latency
- **Time Range Filtering**: View data across 1H, 6H, 24H, 7D, or All time periods
- **Statistics Display**: Min/Max/Average values for all metrics with color-coded badges
- **External IP Display**: View your current public IP address
- **Connection Status**: Real-time WebSocket connection indicator

### ⚙️ Settings & Configuration
- **Tabbed Settings Interface**: Organized sidebar with Monitoring, Live Hosts, Thresholds, Notifications, Reports, and Donate tabs
- **Test Interval**: Configure automatic speed test frequency (minutes)
- **Live Monitoring Interval**: Configure host ping check frequency (seconds, recommended 3-10s)
- **Multiple Host Monitoring**: Add/remove custom hosts to monitor
- **Performance Thresholds**: Set minimum download/upload speeds and maximum ping latency
- **Advanced Notifications**: 7 notification channels (Browser, Discord, Telegram, Slack, Webhook, Email, SMS)
- **8 Notification Events**: Speed test complete, threshold breach, host down/up, connection lost/restored, high latency, packet loss
- **Host History Modal**: Detailed ping history charts for each monitored host
- **Performance Reports**: Generate detailed reports with CSV export and Speedtest.net result links

### 🎨 User Interface
- **Ultra-dark Theme**: Pure black (#000000) background with azure blue accents (#06b6d4, #0ea5e9, #67e8f9)
- **Responsive Design**: Maximum width 1200px for optimal viewing on all screen sizes
- **Angled X-Axis Labels**: Time labels at -45° for better readability
- **Live Data Cards**: Real-time updates with percentage change indicators
- **Custom Network Icon**: Branded favicon with network visualization

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express (port 8745)
- **WebSocket** (ws) for real-time updates
- **Ookla Speedtest CLI** for accurate internet speed testing with result URLs
- **Ping** module for latency monitoring
- **node-schedule** for automated testing
- **SQLite3** for persistent data storage
- **Axios** for webhook notifications (Discord, Telegram, Slack, custom webhooks)
- **Custom Logger** with color-coded timestamps (DEBUG, INFO, WARN, ERROR, SUCCESS)

### Frontend
- **React 18** - Modern UI framework
- **Recharts** - LineChart and AreaChart for data visualization
- **Lucide React** - Beautiful icon library
- **date-fns** - Date formatting and manipulation
- **Axios** - HTTP client for API calls

### Database Schema
- `speed_tests` - Speed test results with download/upload/ping/jitter/latency/server/ISP/result_url
- `settings` - Application configuration including testInterval, monitorInterval, thresholds, notificationSettings
- `live_monitoring` - Current ping state for monitored hosts
- `live_monitoring_history` - Historical ping data for hosts (auto-cleanup after 7 days)

## 📦 Installation

### Prerequisites
- **Node.js** 14 or higher
- **Ookla Speedtest CLI** - See [OOKLA_CLI_SETUP.md](OOKLA_CLI_SETUP.md) for installation instructions

### Quick Start
See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

1. **Install backend dependencies:**
```bash
cd backend
npm install
cd ..
```

2. **Install frontend dependencies:**
```bash
cd frontend
npm install
cd ..
```

### Docker Installation
See [DOCKER_SETUP.md](DOCKER_SETUP.md) for Docker deployment.

```bash
# Build and run with Docker Compose
docker-compose up -d
```

## 🚀 Running the Application

### Development Mode (Separate Servers)

**Run backend and frontend separately (recommended for development)**

Terminal 1 - Backend:
```bash
cd backend
npm start
```

Terminal 2 - Frontend:
```bash
cd frontend
npm start
```

The application will be available at:
- **Frontend**: http://localhost:4280 (with hot reload)
- **Backend API**: http://localhost:8745
- **WebSocket**: ws://localhost:8745

### Production Mode (Single Server)

**Option 1: npm start with built frontend**

1. **Build frontend:**
```bash
cd frontend
npm run build
```

2. **Start backend (serves everything):**
```bash
cd backend
npm start
```

Access at: http://localhost:8745

**Option 2: Docker (recommended)**

```bash
docker-compose build
docker-compose up -d
docker-compose logs -f
```

Access at: http://localhost:8745

> **📘 For detailed production deployment options**, see [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)

## ⚙️ Configuration

### Environment Variables

Create `backend/.env` (optional):
```env
PORT=8745
NODE_ENV=development
```

### Default Settings

The application initializes with these defaults (configurable in Settings tab):

**Monitoring Tab:**
- Test Interval: 30 minutes (automated speed tests)
- Live Monitoring Interval: 5 seconds (host ping checks)

**Live Hosts Tab:**
- Default Hosts: `8.8.8.8` (Google DNS), `1.1.1.1` (Cloudflare DNS), `208.67.222.222` (OpenDNS)
- Add/remove custom hosts for monitoring
- Toggle individual host monitoring on/off

**Performance Thresholds Tab:**
- Min Download Speed: 50 Mbps
- Min Upload Speed: 10 Mbps
- Max Ping Latency: 100 ms

**Notifications Tab:**
- All notification channels disabled by default
- Configure: Browser, Discord, Telegram, Slack, Webhook, Email, SMS
- Customize which events trigger notifications
- Cooldown period: 5 minutes between similar notifications
- Optional quiet hours configuration

**Reports Tab:**
- View all speed test history with sorting
- Time range filters (24H, 7D, 30D, custom dates)
- Export to CSV with all metrics
- Direct links to Speedtest.net results

## 📖 Usage

### Dashboard
1. **Run Speed Test**: Click the blue "Run Speed Test" button for immediate testing
2. **Start Monitoring**: Begin automated scheduled speed tests
3. **View Charts**: Six performance charts with min/avg/max statistics
4. **Time Range Filters**: Select 1H, 6H, 24H, 7D, or All to filter chart data
5. **Live Host Cards**: Click any monitored host to view detailed ping history modal
6. **External IP**: View your current public IP address in the banner

### Settings
1. **Monitoring Tab**: Configure automatic test interval
2. **Live Hosts Tab**: Add/remove hosts to monitor, view status indicators
3. **Thresholds Tab**: Set performance thresholds for alerts
4. **Donate Tab**: Support development via GitHub Sponsors ❤️

### Live Monitoring Modal
- Click any host card to open detailed history
- Time range filters: 15M, 30M, 1H, 6H, 24H, 7D
- Refresh button for latest data
- Area chart with gradient visualization

## 🔌 API Endpoints

### Speed Tests
- `GET /api/history` - Get speed test history
- `POST /api/test` - Run immediate speed test
- `DELETE /api/history` - Clear all speed test history

### Monitoring & Status
- `GET /api/status` - Get current monitoring status
- `POST /api/monitor/start` - Start automated monitoring
- `POST /api/monitor/stop` - Stop automated monitoring

### Live Hosts
- `GET /api/hosts` - Get list of monitored hosts
- `POST /api/hosts` - Add new host to monitor
- `DELETE /api/hosts/:id` - Remove host from monitoring
- `GET /api/hosts/:id/history` - Get ping history for specific host

### Settings
- `GET /api/settings` - Get current settings
- `POST /api/settings` - Update settings

### Network Information
- `GET /api/external-ip` - Get external IP address

## 🔄 WebSocket Events

### Server → Client
- `initial` - Initial data payload on connection (status, hosts, history)
- `speedtest` - New speed test result
- `ping` - Real-time ping update for monitored host
- `status` - Monitoring status change (started/stopped)
- `settings` - Settings updated
- `hosts` - Monitored hosts list updated
- `hostAdded` - New host added to monitoring
- `hostRemoved` - Host removed from monitoring
- `historyCleared` - Speed test history cleared

## 🔔 Notifications

The application supports 7 notification channels for monitoring alerts:

### Notification Channels
1. **Browser Notifications** - Desktop notifications with sound
2. **Discord** - Send alerts to Discord channels via webhooks
3. **Telegram** - Send messages via Telegram bot
4. **Slack** - Post to Slack channels via webhooks
5. **Custom Webhook** - HTTP POST to any webhook URL
6. **Email** - SMTP email notifications (configurable)
7. **SMS** - SMS alerts via Twilio (requires account)

### Notification Events
- ✅ Speed Test Complete
- ⚠️ Threshold Breach (speed or latency)
- 🔴 Host Down
- 🟢 Host Up
- 🔴 Connection Lost (all hosts unreachable)
- 🟢 Connection Restored
- 🟡 High Latency
- 📊 Packet Loss

### Features
- **Cooldown Period**: Prevent notification spam (default: 5 minutes)
- **Quiet Hours**: Disable notifications during specific hours
- **Event Filtering**: Choose which events trigger notifications
- **Test Notifications**: Send test to all enabled channels
- **Per-Channel Configuration**: Individual settings for each notification type

See Settings → Notifications tab to configure.

## 📋 Reports & Analytics

### Performance Reports
- **Comprehensive History**: View all speed test results
- **Time Range Filters**: 24H, 7D, 30D, or custom date ranges
- **Sorting**: Sort by any column (timestamp, download, upload, ping, etc.)
- **Statistics**: Min/Max/Average for all metrics
- **CSV Export**: Download complete data for external analysis
- **Speedtest.net Links**: Direct links to view full test results online

### Data Fields
- Timestamp
- Download Speed (Mbps)
- Upload Speed (Mbps)
- Ping Latency (ms)
- Jitter (ms)
- Download Latency (ms)
- Upload Latency (ms)
- Server Location
- ISP Name
- Result URL

## 🛠️ Advanced Features

### Logger System
The backend includes a comprehensive logging system with:
- **Color-Coded Levels**: DEBUG (cyan), INFO (blue), WARN (yellow), ERROR (red), SUCCESS (green)
- **Timestamps**: YYYY-MM-DD HH:mm:ss.ms format
- **Structured Output**: Easy to read and debug
- **Production Ready**: Minimal performance impact

### Auto-Cleanup
- **Live Monitoring History**: Automatically cleaned after 7 days
- **Prevents Database Bloat**: Keeps database size manageable
- **Configurable**: Can be adjusted in code if needed

### Dynamic URL Configuration
- **Network Accessible**: Frontend automatically connects to backend on same IP
- **Works with any IP/hostname**: localhost, network IP, or custom domain
- **Docker Compatible**: Seamless operation in containers

### Port Configuration
- **Non-Common Ports**: Backend (8745), Frontend (4280)
- **Avoids Conflicts**: Won't clash with other services
- **Configurable**: Can be changed via environment variables
- **Firewall Friendly**: Easy to allow specific ports

## 🌐 Browser Support

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge
- ✅ Any modern browser with WebSocket support

## 📋 Requirements

- **Node.js** 14 or higher
- **Ookla Speedtest CLI** ([installation guide](OOKLA_CLI_SETUP.md))
- **Modern web browser** with WebSocket support
- **Active internet connection** for speed testing

## 📚 Documentation

### Setup & Configuration
- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [QUICKSTART_NEW_PORTS.md](QUICKSTART_NEW_PORTS.md) - Quick start with new ports
- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - **Production deployment options** (Docker, npm, PM2, systemd)
- [DOCKER_SETUP.md](DOCKER_SETUP.md) - Docker deployment instructions
- [DOCKER_FIXES.md](DOCKER_FIXES.md) - Docker production fixes (WebSocket, ping, static serving)
- [OOKLA_CLI_SETUP.md](OOKLA_CLI_SETUP.md) - Speedtest CLI installation
- [PORT_CONFIGURATION.md](PORT_CONFIGURATION.md) - Port configuration guide
- [NETWORK_CONFIGURATION.md](NETWORK_CONFIGURATION.md) - Network setup

### Features & Updates
- [UI_ENHANCEMENTS.md](UI_ENHANCEMENTS.md) - UI features and improvements
- [EXTERNAL_IP_FEATURE.md](EXTERNAL_IP_FEATURE.md) - External IP functionality
- [LATENCY_EXPLANATION.md](LATENCY_EXPLANATION.md) - Understanding latency metrics
- [MONITOR_INTERVAL_FEATURE.md](MONITOR_INTERVAL_FEATURE.md) - Live monitoring interval configuration
- [DATABASE_UPDATE.md](DATABASE_UPDATE.md) - Database schema updates
- [FRONTEND_FIX_SUMMARY.md](FRONTEND_FIX_SUMMARY.md) - Network configuration fixes

### Technical Documentation
- [DOCUMENTATION_UPDATE_SUMMARY.md](DOCUMENTATION_UPDATE_SUMMARY.md) - Recent documentation updates
- [ALL_RECENT_UPDATES.md](ALL_RECENT_UPDATES.md) - Complete change history

## ✨ What's New

### Latest Updates (October 2025)

#### Port Configuration
- ✅ **New Ports**: Backend (8745), Frontend (4280)
- ✅ **Avoids Conflicts**: No more port conflicts with other services
- ✅ **All Documentation Updated**: Consistent across all docs

#### Notifications System
- ✅ **7 Notification Channels**: Browser, Discord, Telegram, Slack, Webhook, Email, SMS
- ✅ **8 Event Types**: Comprehensive monitoring alerts
- ✅ **Advanced Configuration**: Cooldown, quiet hours, event filtering
- ✅ **Test Notifications**: Verify all channels work correctly

#### Logger Implementation
- ✅ **Color-Coded Logs**: Easy to read with 5 log levels
- ✅ **Timestamps**: Millisecond precision for debugging
- ✅ **Production Ready**: ~85% of console.logs migrated

#### Live Monitoring Interval
- ✅ **Configurable Interval**: Set how often to ping hosts (1-60 seconds)
- ✅ **Recommended Range**: 3-10 seconds for optimal balance
- ✅ **Database Persistence**: Settings saved and restored

#### Performance Reports
- ✅ **CSV Export**: Download complete speed test history
- ✅ **Speedtest.net Links**: View detailed results online
- ✅ **Advanced Filtering**: Time ranges, sorting, statistics
- ✅ **Server & ISP Data**: Track which servers tested against

#### Database Enhancements
- ✅ **Extended Schema**: Server, ISP, and result URL fields
- ✅ **Auto-Cleanup**: 7-day retention for monitoring history
- ✅ **Automatic Migration**: Existing databases upgraded seamlessly

#### Network Improvements
- ✅ **Dynamic Backend URL**: Works on any IP/hostname
- ✅ **External IP Display**: View your public IP address
- ✅ **Network Accessible**: Access from any device on network

## 🤝 Contributing

Contributions are welcome! We appreciate your help in making this project better.

### How to Contribute

1. **Fork the Repository**
   ```bash
   git clone https://github.com/Format209/Ez--U-Internet-Monitor.git
   cd Ez--U-Internet-Monitor
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write clean, documented code
   - Follow existing code style
   - Test your changes thoroughly

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "Add: your feature description"
   ```

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Describe your changes clearly

### Ways to Contribute
- 🐛 **Report Bugs**: Open an issue with details and steps to reproduce
- 💡 **Suggest Features**: Share your ideas for new features
- 📝 **Improve Documentation**: Fix typos, add examples, clarify instructions
- 🔧 **Fix Issues**: Browse open issues and submit fixes
- 🎨 **Enhance UI/UX**: Improve design and user experience
- ✅ **Write Tests**: Add unit or integration tests
- 🌍 **Translations**: Add support for more languages

### Code of Conduct
- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help create a welcoming environment for everyone

### Development Setup
See [QUICKSTART.md](QUICKSTART.md) for detailed setup instructions.

### Questions?
Feel free to open an issue for any questions or discussions!

## ❤️ Support

If you find this project helpful, consider supporting development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-red?logo=github)](https://github.com/sponsors/Format209)

## ‍💻 Author

**Format209**
- GitHub: [@Format209](https://github.com/Format209)
- Made with ❤️ for internet monitoring and diagnostics

---

**Ezé-U Internet Monitor** - Real-time internet performance monitoring made beautiful.
