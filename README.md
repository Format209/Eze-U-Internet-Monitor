# Ezé-U Internet Monitor

A modern, real-time internet monitoring application with advanced speed testing capabilities. Monitor your internet connection with live data visualization, automated speed tests, multiple host monitoring, and customizable thresholds.

![Azure Blue Theme](https://img.shields.io/badge/theme-azure%20blue-06b6d4)
![React 18](https://img.shields.io/badge/react-18-61dafb)
![Node.js](https://img.shields.io/badge/node.js-express-339933)
![WebSocket](https://img.shields.io/badge/realtime-websocket-orange)

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
- **Tabbed Settings Interface**: Organized sidebar with Monitoring, Live Hosts, Thresholds, and Donate tabs
- **Test Interval**: Configure automatic speed test frequency
- **Multiple Host Monitoring**: Add/remove custom hosts to monitor
- **Performance Thresholds**: Set minimum download/upload speeds and maximum ping latency
- **Host History Modal**: Detailed ping history charts for each monitored host

### 🎨 User Interface
- **Ultra-dark Theme**: Pure black (#000000) background with azure blue accents (#06b6d4, #0ea5e9, #67e8f9)
- **Responsive Design**: Maximum width 1200px for optimal viewing on all screen sizes
- **Angled X-Axis Labels**: Time labels at -45° for better readability
- **Live Data Cards**: Real-time updates with percentage change indicators
- **Custom Network Icon**: Branded favicon with network visualization

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express (port 5000)
- **WebSocket** (ws) for real-time updates
- **Ookla Speedtest CLI** for accurate internet speed testing
- **Ping** module for latency monitoring
- **node-schedule** for automated testing
- **SQLite3** for persistent data storage

### Frontend
- **React 18** - Modern UI framework
- **Recharts** - LineChart and AreaChart for data visualization
- **Lucide React** - Beautiful icon library
- **date-fns** - Date formatting and manipulation
- **Axios** - HTTP client for API calls

### Database Schema
- `speed_tests` - Speed test results with download/upload/ping/jitter/latency
- `settings` - Application configuration
- `live_monitoring` - Current ping state for monitored hosts
- `live_monitoring_history` - Historical ping data for hosts

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

### Development Mode

**Option 1: Run backend and frontend separately (recommended)**

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
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **WebSocket**: ws://localhost:5000

### Production Mode

1. **Build frontend:**
```bash
cd frontend
npm run build
```

2. **Serve via backend:**
```bash
cd backend
NODE_ENV=production node server.js
```

### Docker Mode

```bash
# Start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

## ⚙️ Configuration

### Environment Variables

Create `backend/.env` (optional):
```env
PORT=5000
NODE_ENV=development
```

### Default Settings

The application initializes with these defaults (configurable in Settings tab):

**Monitoring Tab:**
- Test Interval: 30 minutes (automated speed tests)

**Live Hosts Tab:**
- Default Hosts: `8.8.8.8` (Google DNS), `1.1.1.1` (Cloudflare DNS)
- Add/remove custom hosts for monitoring

**Performance Thresholds Tab:**
- Min Download Speed: 50 Mbps
- Min Upload Speed: 10 Mbps
- Max Ping Latency: 100 ms

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

- [QUICKSTART.md](QUICKSTART.md) - Quick setup guide
- [DOCKER_SETUP.md](DOCKER_SETUP.md) - Docker deployment instructions
- [OOKLA_CLI_SETUP.md](OOKLA_CLI_SETUP.md) - Speedtest CLI installation
- [UI_ENHANCEMENTS.md](UI_ENHANCEMENTS.md) - UI features and improvements
- [EXTERNAL_IP_FEATURE.md](EXTERNAL_IP_FEATURE.md) - External IP functionality
- [LATENCY_EXPLANATION.md](LATENCY_EXPLANATION.md) - Understanding latency metrics

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## ❤️ Support

If you find this project helpful, consider supporting development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤️-red?logo=github)](https://github.com/sponsors/Format209)

## 📄 License

ISC

## 👨‍💻 Author

**Format209**
- GitHub: [@Format209](https://github.com/Format209)
- Made with ❤️ for internet monitoring and diagnostics

---

**Ezé-U Internet Monitor** - Real-time internet performance monitoring made beautiful.
