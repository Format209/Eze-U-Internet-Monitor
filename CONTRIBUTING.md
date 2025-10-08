# Contributing to Ezé-U Internet Monitor

First off, thank you for considering contributing to Ezé-U Internet Monitor! 🎉

This document provides guidelines for contributing to the project. Following these guidelines helps maintain code quality and makes the contribution process smooth for everyone.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background or identity.

### Our Standards

**Examples of behavior that contributes to a positive environment:**
- ✅ Using welcoming and inclusive language
- ✅ Being respectful of differing viewpoints and experiences
- ✅ Gracefully accepting constructive criticism
- ✅ Focusing on what is best for the community
- ✅ Showing empathy towards other community members

**Examples of unacceptable behavior:**
- ❌ Trolling, insulting/derogatory comments, and personal attacks
- ❌ Public or private harassment
- ❌ Publishing others' private information without explicit permission
- ❌ Other conduct which could reasonably be considered inappropriate

## 🤝 How Can I Contribute?

### Reporting Bugs 🐛

Before creating a bug report:
1. **Check existing issues** to avoid duplicates
2. **Verify the bug** by testing with the latest version
3. **Gather information** about your environment

When reporting a bug, include:
- **Clear title** describing the issue
- **Detailed description** of the problem
- **Steps to reproduce** the bug
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details**: OS, Node.js version, browser
- **Error messages** and stack traces

**Example Bug Report:**
```markdown
## Bug: Speed test fails on Windows 11

**Description:**
Speed test returns error when run on Windows 11 with Ookla CLI 1.2.0

**Steps to Reproduce:**
1. Install on Windows 11
2. Click "Run Speed Test"
3. Wait 5 seconds

**Expected:** Speed test completes successfully
**Actual:** Error: "Speedtest CLI not found"

**Environment:**
- OS: Windows 11 Pro
- Node.js: v18.17.0
- Backend Port: 8745

**Error Log:**
```
Error: Speedtest CLI not found in PATH
```
```

### Suggesting Features 💡

Before suggesting a feature:
1. **Check if it already exists** in the app or documentation
2. **Search existing feature requests** to avoid duplicates
3. **Consider if it fits** the project's scope and goals

When suggesting a feature, include:
- **Clear title** describing the feature
- **Detailed description** of what you want
- **Use case** - why is this feature needed?
- **Proposed solution** - how should it work?
- **Alternatives considered** - what other approaches did you think of?
- **Mockups/sketches** if applicable

### Improving Documentation 📝

Documentation improvements are always welcome!
- Fix typos and grammatical errors
- Clarify confusing sections
- Add missing information
- Create examples and tutorials
- Update outdated content
- Improve code comments

### Fixing Issues 🔧

Browse [open issues](https://github.com/Format209/Ez--U-Internet-Monitor/issues) and look for:
- Issues labeled `good first issue` - great for beginners
- Issues labeled `help wanted` - community help needed
- Issues labeled `bug` - confirmed bugs needing fixes

## 🚀 Development Setup

### Prerequisites
- Node.js 14 or higher
- Ookla Speedtest CLI ([installation guide](OOKLA_CLI_SETUP.md))
- Git

### Setup Steps

1. **Fork the repository** on GitHub

2. **Clone your fork:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Ez--U-Internet-Monitor.git
   cd Ez--U-Internet-Monitor
   ```

3. **Add upstream remote:**
   ```bash
   git remote add upstream https://github.com/Format209/Ez--U-Internet-Monitor.git
   ```

4. **Install dependencies:**
   ```bash
   # Root dependencies
   npm install
   
   # Backend dependencies
   cd backend
   npm install
   cd ..
   
   # Frontend dependencies
   cd frontend
   npm install
   cd ..
   ```

5. **Start development servers:**
   ```bash
   # Terminal 1 - Backend (Port 8745)
   cd backend
   npm start
   
   # Terminal 2 - Frontend (Port 4280)
   cd frontend
   npm start
   ```

6. **Verify setup:**
   - Frontend: http://localhost:4280
   - Backend API: http://localhost:8745/api/settings

### Project Structure
```
Ez--U-Internet-Monitor/
├── backend/               # Node.js backend
│   ├── server.js         # Main server file
│   ├── logger.js         # Custom logger
│   ├── monitoring.db     # SQLite database
│   └── package.json      # Backend dependencies
├── frontend/             # React frontend
│   ├── src/
│   │   ├── App.js        # Main app component
│   │   ├── components/   # React components
│   │   └── index.js      # Entry point
│   └── package.json      # Frontend dependencies
├── docs/                 # Documentation files
├── LICENSE               # ISC License
└── README.md            # Main documentation
```

## 🔀 Pull Request Process

### Before Submitting

1. **Update from upstream:**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/bug-description
   ```

3. **Make your changes:**
   - Write clean, documented code
   - Follow existing code style
   - Add comments for complex logic
   - Update relevant documentation

4. **Test your changes:**
   - Test all affected functionality
   - Test in different scenarios
   - Verify no existing features broke

5. **Commit your changes:**
   ```bash
   git add .
   git commit -m "Type: Brief description"
   ```

### Submitting the Pull Request

1. **Push to your fork:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create Pull Request:**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill out the PR template

3. **PR Description should include:**
   - **What** changed
   - **Why** it changed
   - **How** to test it
   - **Screenshots** if UI changed
   - **Related issues** (e.g., "Fixes #123")

### PR Review Process

- Maintainers will review your PR
- Respond to feedback promptly
- Make requested changes if needed
- Keep discussions focused and professional
- Be patient - reviews take time

### After Approval

Once approved and merged:
- Delete your feature branch
- Update your fork's main branch
- Celebrate! 🎉

## 💻 Coding Standards

### JavaScript Style

**General Guidelines:**
- Use ES6+ features (const, let, arrow functions)
- 2 spaces for indentation
- Semicolons required
- Single quotes for strings
- Meaningful variable names

**Example:**
```javascript
// Good
const getUserData = async (userId) => {
  const response = await fetch(`/api/users/${userId}`);
  return response.json();
};

// Avoid
var x = function(id) {
  return fetch("/api/users/" + id).then(r => r.json())
}
```

### React Components

- Use functional components with hooks
- Props destructuring for clarity
- PropTypes or TypeScript for type safety
- Keep components focused and reusable

**Example:**
```javascript
// Good
const SpeedCard = ({ download, upload, ping }) => {
  return (
    <div className="speed-card">
      <div>Download: {download} Mbps</div>
      <div>Upload: {upload} Mbps</div>
      <div>Ping: {ping} ms</div>
    </div>
  );
};

export default SpeedCard;
```

### Backend Code

- Use async/await for asynchronous operations
- Proper error handling with try/catch
- Use logger instead of console.log
- Validate input data
- Comment complex business logic

**Example:**
```javascript
// Good
app.post('/api/test', async (req, res) => {
  try {
    logger.info('Starting speed test...');
    const result = await performSpeedTest();
    logger.success('Speed test completed');
    res.json(result);
  } catch (error) {
    logger.error('Speed test failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});
```

### CSS/Styling

- Use CSS classes, not inline styles
- Follow existing naming conventions
- Mobile-responsive design
- Maintain dark theme consistency

## 📝 Commit Message Guidelines

### Format
```
Type: Brief description (max 72 characters)

Optional detailed description explaining:
- What changed
- Why it changed
- Any breaking changes

Fixes #123
```

### Types
- **Add**: New feature or functionality
- **Fix**: Bug fix
- **Update**: Changes to existing features
- **Refactor**: Code restructuring without behavior change
- **Docs**: Documentation changes
- **Style**: Code formatting (no functional changes)
- **Test**: Adding or updating tests
- **Chore**: Maintenance tasks

### Examples
```
Add: Live monitoring interval configuration

- Added monitorInterval field to settings
- Added UI control in Settings page
- Updated backend to use configurable interval
- Default: 5 seconds, range: 1-60 seconds

Fixes #45
```

```
Fix: WebSocket connection not reconnecting

- Added reconnection logic with exponential backoff
- Improved error handling for connection failures
- Added connection status indicator in UI

Fixes #78
```

## 🧪 Testing

### Manual Testing

Before submitting:
1. **Test the feature** you added/modified
2. **Test related features** that might be affected
3. **Test edge cases** and error scenarios
4. **Test on different browsers** if UI changed
5. **Test both development and production builds**

### Test Scenarios

- ✅ Backend starts without errors
- ✅ Frontend loads and displays correctly
- ✅ Speed test runs successfully
- ✅ Live monitoring updates in real-time
- ✅ Settings save and persist
- ✅ Notifications send correctly
- ✅ Reports generate and export
- ✅ WebSocket reconnects after disconnect
- ✅ Works on localhost and network IP
- ✅ Docker build succeeds

### Automated Testing (Future)

We plan to add:
- Unit tests for backend functions
- Integration tests for API endpoints
- Component tests for React components
- End-to-end tests for critical flows

## 📚 Documentation

### When to Update Docs

Update documentation when:
- Adding new features
- Changing existing behavior
- Fixing bugs that affect user experience
- Adding new API endpoints
- Changing configuration options
- Adding new dependencies

### Documentation Files

- **README.md** - Overview and quick start
- **QUICKSTART.md** - Detailed setup guide
- **CONTRIBUTING.md** - This file
- **Feature docs** - Specific feature documentation
- **Code comments** - Inline documentation

### Documentation Style

- Use clear, concise language
- Include code examples
- Add screenshots for UI changes
- Keep formatting consistent
- Use proper markdown syntax

## ❓ Questions?

- **General questions**: Open a [Discussion](https://github.com/Format209/Ez--U-Internet-Monitor/discussions)
- **Bug reports**: Open an [Issue](https://github.com/Format209/Ez--U-Internet-Monitor/issues)
- **Feature requests**: Open an [Issue](https://github.com/Format209/Ez--U-Internet-Monitor/issues) with `enhancement` label
- **Security issues**: Email directly (don't open public issues)

## 🙏 Thank You!

Thank you for contributing to Ezé-U Internet Monitor! Your efforts help make this project better for everyone.

### Recognition

All contributors will be recognized in:
- GitHub's contributor page
- Release notes (for significant contributions)
- A future CONTRIBUTORS.md file

---

**Happy Contributing!** 🎉

Made with ❤️ by the Ezé-U Internet Monitor community
