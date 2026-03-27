#!/usr/bin/env bash
# ============================================================
#  Ezé-U Internet Monitor — Installer
#  https://github.com/Format209/Eze-U-Internet-Monitor
#
#  Usage:
#    curl -sSL https://raw.githubusercontent.com/Format209/Eze-U-Internet-Monitor/main/install.sh | sudo bash
#    sudo bash install.sh
#    sudo bash install.sh --reconfigure
#    sudo bash install.sh --unattended
# ============================================================

set -euo pipefail

# Suppress all interactive prompts from apt/dpkg/gpg for the duration of the install
export DEBIAN_FRONTEND=noninteractive
export GIT_TERMINAL_PROMPT=0

# ── Constants ────────────────────────────────────────────────
readonly GITHUB_OWNER="Format209"
readonly GITHUB_REPO_NAME="Eze-U-Internet-Monitor"
readonly GITHUB_REPO="${GITHUB_OWNER}/${GITHUB_REPO_NAME}"
readonly GITHUB_URL="https://github.com/${GITHUB_REPO}.git"
readonly GITHUB_RAW="https://raw.githubusercontent.com/${GITHUB_REPO}/main"
readonly INSTALL_DIR="/opt/ezeu-internet-monitor"
readonly SERVICE_NAME="ezeu-monitor"
readonly SERVICE_USER="ezeu"
readonly CLI_PATH="/usr/local/bin/ezeu"
readonly LOG_DIR="/var/log/ezeu"
readonly DEFAULT_PORT=8745
readonly NODE_MIN_VERSION=18

# ── Colours & Symbols ────────────────────────────────────────
readonly COL_NC='\e[0m'
readonly COL_RED='\e[0;31m'
readonly COL_GREEN='\e[0;32m'
readonly COL_YELLOW='\e[1;33m'
readonly COL_BLUE='\e[0;34m'
readonly COL_MAGENTA='\e[0;35m'
readonly COL_CYAN='\e[0;36m'
readonly COL_BOLD='\e[1m'

TICK="  [${COL_GREEN}✓${COL_NC}]"
CROSS="  [${COL_RED}✗${COL_NC}]"
INFO="  [${COL_CYAN}i${COL_NC}]"
WARN="  [${COL_YELLOW}!${COL_NC}]"
QST="  [${COL_MAGENTA}?${COL_NC}]"

# ── Flags (set by parse_args) ────────────────────────────────
RECONFIGURE=false
UNATTENDED=false

# ── Detected values ──────────────────────────────────────────
PKG_INSTALL=""
PKG_UPDATE=""

# ────────────────────────────────────────────────────────────
# Helper functions
# ────────────────────────────────────────────────────────────

print_banner() {
    echo -e ""
    echo -e "${COL_CYAN}${COL_BOLD}  ╔═══════════════════════════════════════════╗${COL_NC}"
    echo -e "${COL_CYAN}${COL_BOLD}  ║        Ezé-U Internet Monitor             ║${COL_NC}"
    echo -e "${COL_CYAN}${COL_BOLD}  ║           Installer  v1.0                 ║${COL_NC}"
    echo -e "${COL_CYAN}${COL_BOLD}  ╚═══════════════════════════════════════════╝${COL_NC}"
    echo -e ""
}

print_section() {
    echo -e ""
    echo -e "${COL_BOLD}${COL_BLUE}  ──── $1 ────${COL_NC}"
    echo -e ""
}

print_info()    { echo -e "${INFO}  $1"; }
print_success() { echo -e "${TICK}  $1"; }
print_warn()    { echo -e "${WARN}  $1"; }
print_error()   { echo -e "${CROSS}  ${COL_RED}$1${COL_NC}"; }

# Run a command, printing a spinner and pass/fail result
run_cmd() {
    local description="$1"
    shift
    printf "        %s..." "$description"
    if "$@" > /tmp/ezeu_install_out 2>&1; then
        echo -e "\r${TICK}  $description"
    else
        echo -e "\r${CROSS}  ${COL_RED}$description${COL_NC}"
        print_error "Command failed: $*"
        echo -e "  --- Output ---"
        cat /tmp/ezeu_install_out | head -30
        echo -e "  --- End ---"
        return 1
    fi
}

# Ask a yes/no question; respects --unattended (defaults to yes)
confirm() {
    local prompt="$1"
    local default="${2:-y}"
    if [[ "${UNATTENDED}" == "true" ]]; then
        return 0
    fi
    local reply
    if [[ "${default}" == "y" ]]; then
        read -r -p "$(echo -e "${QST}  ${prompt} [Y/n]: ")" reply
        reply="${reply:-y}"
    else
        read -r -p "$(echo -e "${QST}  ${prompt} [y/N]: ")" reply
        reply="${reply:-n}"
    fi
    [[ "${reply,,}" =~ ^y(es)?$ ]]
}

# ────────────────────────────────────────────────────────────
# Pre-flight checks
# ────────────────────────────────────────────────────────────

check_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        print_error "The installer must be run as root."
        echo -e "${INFO}  Run:  ${COL_BOLD}sudo bash install.sh${COL_NC}"
        echo -e "${INFO}  Or:   ${COL_BOLD}curl -sSL ${GITHUB_RAW}/install.sh | sudo bash${COL_NC}"
        exit 1
    fi
    print_success "Running as root"
}

# ────────────────────────────────────────────────────────────
# OS Detection
# ────────────────────────────────────────────────────────────

detect_os() {
    print_section "Detecting Operating System"

    if [[ ! -f /etc/os-release ]]; then
        print_error "Cannot detect OS — /etc/os-release not found."
        exit 1
    fi

    # shellcheck source=/dev/null
    source /etc/os-release
    local os_id="${ID:-unknown}"
    local os_id_like="${ID_LIKE:-}"
    local os_name="${PRETTY_NAME:-${NAME:-unknown}}"

    case "${os_id}" in
        ubuntu|debian|raspbian|linuxmint|pop)
            PKG_INSTALL="apt-get install -y"
            PKG_UPDATE="apt-get update -qq"
            ;;
        fedora)
            PKG_INSTALL="dnf install -y"
            PKG_UPDATE="dnf check-update -q; true"
            ;;
        rhel|centos|rocky|almalinux|ol)
            if command -v dnf &>/dev/null; then
                PKG_INSTALL="dnf install -y"
                PKG_UPDATE="dnf check-update -q; true"
            else
                PKG_INSTALL="yum install -y"
                PKG_UPDATE="yum check-update -q; true"
            fi
            ;;
        arch|manjaro|endeavouros|garuda)
            PKG_INSTALL="pacman -S --noconfirm --needed"
            PKG_UPDATE="pacman -Sy --noconfirm"
            ;;
        opensuse*|sles)
            PKG_INSTALL="zypper install -y"
            PKG_UPDATE="zypper refresh -q"
            ;;
        *)
            # Fallback: try ID_LIKE
            if [[ "${os_id_like}" == *"debian"* ]] || [[ "${os_id_like}" == *"ubuntu"* ]]; then
                PKG_INSTALL="apt-get install -y"
                PKG_UPDATE="apt-get update -qq"
            elif [[ "${os_id_like}" == *"rhel"* ]] || [[ "${os_id_like}" == *"fedora"* ]]; then
                PKG_INSTALL="dnf install -y"
                PKG_UPDATE="dnf check-update -q; true"
            else
                print_error "Unsupported OS: ${os_name} (ID=${os_id})"
                print_info "Supported: Debian/Ubuntu, RHEL/Fedora/Rocky, Arch, openSUSE"
                exit 1
            fi
            ;;
    esac

    print_success "OS: ${os_name}"
}

# ────────────────────────────────────────────────────────────
# System dependency installation
# ────────────────────────────────────────────────────────────

install_system_deps() {
    print_section "System Dependencies"

    print_info "Refreshing package lists..."
    eval "${PKG_UPDATE}" > /dev/null 2>&1 || true

    local packages=()
    # build tools needed for better-sqlite3 native compilation
    if [[ "${PKG_INSTALL}" == apt-get* ]]; then
        packages=(git curl ca-certificates gnupg build-essential python3)
    elif [[ "${PKG_INSTALL}" == dnf* ]] || [[ "${PKG_INSTALL}" == yum* ]]; then
        packages=(git curl ca-certificates gnupg2 gcc-c++ make python3)
    elif [[ "${PKG_INSTALL}" == pacman* ]]; then
        packages=(git curl ca-certificates gnupg base-devel python)
    elif [[ "${PKG_INSTALL}" == zypper* ]]; then
        packages=(git curl ca-certificates gpg2 gcc-c++ make python3)
    fi

    # Only install what is missing
    local missing=()
    for pkg in "${packages[@]}"; do
        if ! command -v "${pkg}" &>/dev/null; then
            missing+=("${pkg}")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        print_success "All system dependencies already satisfied"
    else
        print_info "Installing: ${missing[*]}"
        run_cmd "System packages" bash -c "${PKG_INSTALL} ${packages[*]}"
    fi
}

# ────────────────────────────────────────────────────────────
# Node.js installation
# ────────────────────────────────────────────────────────────

install_nodejs() {
    print_section "Node.js (≥ v${NODE_MIN_VERSION})"

    local current_version=0
    if command -v node &>/dev/null; then
        current_version=$(node -e "process.stdout.write(process.version.replace('v','').split('.')[0])" 2>/dev/null || echo 0)
    fi

    if [[ "${current_version}" -ge "${NODE_MIN_VERSION}" ]]; then
        print_success "Node.js $(node --version) already installed"
        return 0
    fi

    print_info "Installing Node.js v${NODE_MIN_VERSION} via NodeSource..."

    if [[ "${PKG_INSTALL}" == apt-get* ]]; then
        run_cmd "Fetching NodeSource setup" \
            bash -c "curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x -o /tmp/ns_setup.sh"
        run_cmd "Running NodeSource setup" bash /tmp/ns_setup.sh
        run_cmd "Installing nodejs" apt-get install -y nodejs
        rm -f /tmp/ns_setup.sh

    elif [[ "${PKG_INSTALL}" == dnf* ]] || [[ "${PKG_INSTALL}" == yum* ]]; then
        run_cmd "Fetching NodeSource setup" \
            bash -c "curl -fsSL https://rpm.nodesource.com/setup_${NODE_MIN_VERSION}.x -o /tmp/ns_setup.sh"
        run_cmd "Running NodeSource setup" bash /tmp/ns_setup.sh
        run_cmd "Installing nodejs" bash -c "${PKG_INSTALL} nodejs"
        rm -f /tmp/ns_setup.sh

    elif [[ "${PKG_INSTALL}" == pacman* ]]; then
        run_cmd "Installing nodejs npm" pacman -S --noconfirm nodejs npm

    elif [[ "${PKG_INSTALL}" == zypper* ]]; then
        run_cmd "Installing nodejs" zypper install -y "nodejs${NODE_MIN_VERSION}"
    fi

    if command -v node &>/dev/null; then
        print_success "Node.js $(node --version) installed"
    else
        print_error "Node.js installation failed. Install v${NODE_MIN_VERSION}+ manually then re-run."
        exit 1
    fi
}

# ────────────────────────────────────────────────────────────
# Ookla Speedtest CLI (optional)
# ────────────────────────────────────────────────────────────

install_speedtest_cli() {
    print_section "Ookla Speedtest CLI (Optional)"

    if command -v speedtest &>/dev/null; then
        local ver
        ver=$(speedtest --version 2>/dev/null | head -1 || echo "unknown")
        print_success "Speedtest CLI already installed: ${ver}"
        return 0
    fi

    print_info "The Ookla Speedtest CLI is required for accurate speed tests."
    if ! confirm "Install Ookla Speedtest CLI?" "y"; then
        print_warn "Skipping Speedtest CLI — speed tests will use fallback method."
        return 0
    fi

    if [[ "${PKG_INSTALL}" == apt-get* ]]; then
        # Use Ookla's official packagecloud script — handles Ubuntu AND Debian correctly
        # os_type forces non-interactive mode in the packagecloud script
        run_cmd "Adding Ookla repository (deb)" \
            bash -c 'curl -fsSL https://packagecloud.io/ookla/speedtest-cli/script.deb.sh | DEBIAN_FRONTEND=noninteractive bash'
        run_cmd "Installing speedtest" apt-get install -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" speedtest

    elif [[ "${PKG_INSTALL}" == dnf* ]] || [[ "${PKG_INSTALL}" == yum* ]]; then
        # Use Ookla's official packagecloud script — handles RHEL/Fedora/Rocky correctly
        run_cmd "Adding Ookla repository (rpm)" \
            bash -c 'curl -fsSL https://packagecloud.io/ookla/speedtest-cli/script.rpm.sh | bash'
        run_cmd "Installing speedtest" bash -c "${PKG_INSTALL} speedtest"

    else
        print_warn "Cannot auto-install Speedtest CLI for this package manager."
        print_info "Follow manual instructions: https://www.speedtest.net/apps/cli"
        return 0
    fi

    if command -v speedtest &>/dev/null; then
        # Accept the license non-interactively on first run
        speedtest --accept-license --accept-gdpr > /dev/null 2>&1 || true
        print_success "Ookla Speedtest CLI installed"
    else
        print_warn "Speedtest CLI installation may have failed. Speed tests might not work."
    fi
}

# ────────────────────────────────────────────────────────────
# Service user
# ────────────────────────────────────────────────────────────

create_service_user() {
    print_section "Service User"

    if id -u "${SERVICE_USER}" &>/dev/null; then
        print_success "Service user '${SERVICE_USER}' already exists"
        return 0
    fi

    run_cmd "Creating system user '${SERVICE_USER}'" \
        useradd --system --no-create-home --shell /sbin/nologin "${SERVICE_USER}"
}

# ────────────────────────────────────────────────────────────
# Application installation
# ────────────────────────────────────────────────────────────

install_app() {
    print_section "Application"

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        print_success "Existing installation found at ${INSTALL_DIR}"
        print_info "Run 'sudo ezeu -up' to update, or 'sudo bash install.sh --reconfigure' to reconfigure."
        return 0
    fi

    if [[ -d "${INSTALL_DIR}" ]]; then
        print_warn "${INSTALL_DIR} exists but is not a git repository."
        if confirm "Remove and reinstall?" "n"; then
            run_cmd "Removing existing directory" rm -rf "${INSTALL_DIR}"
        else
            print_error "Cannot install. Remove ${INSTALL_DIR} manually and re-run."
            exit 1
        fi
    fi

    run_cmd "Cloning repository" \
        git clone --depth 1 "${GITHUB_URL}" "${INSTALL_DIR}"
    print_success "Cloned to ${INSTALL_DIR}"
}

install_npm_packages() {
    print_section "Node.js Packages"

    run_cmd "Backend dependencies (npm install)" \
        bash -c "cd '${INSTALL_DIR}/backend' && npm install --omit=dev --no-fund --no-audit 2>&1"

    print_info "Installing frontend build dependencies (this may take a minute)..."
    run_cmd "Frontend dependencies (npm install)" \
        bash -c "cd '${INSTALL_DIR}/frontend' && npm install --no-fund --no-audit 2>&1"

    print_info "Building production frontend bundle..."
    run_cmd "Frontend production build (npm run build)" \
        bash -c "cd '${INSTALL_DIR}/frontend' && npm run build 2>&1"

    print_success "Frontend built — served as static files by backend"
}

# ────────────────────────────────────────────────────────────
# Configuration (.env)
# ────────────────────────────────────────────────────────────

configure_env() {
    print_section "Configuration"

    local env_file="${INSTALL_DIR}/.env"

    if [[ -f "${env_file}" ]]; then
        print_success "Existing .env found — preserving your configuration"
        return 0
    fi

    # Detect local timezone
    local tz
    tz=$(timedatectl show --property=Timezone --value 2>/dev/null \
         || cat /etc/timezone 2>/dev/null \
         || echo "UTC")

    local port="${DEFAULT_PORT}"
    if [[ "${UNATTENDED}" == "false" ]]; then
        read -r -p "$(echo -e "${QST}  Backend port [${port}]: ")" input_port
        port="${input_port:-${port}}"
    fi

    cat > "${env_file}" << ENVEOF
# Ezé-U Internet Monitor — Runtime Configuration
# Generated by installer on $(date)
# Edit this file to configure notification channels, etc.

# Port the backend (and frontend) listens on
PORT=${port}

# Set to production for the static build to be served
NODE_ENV=production

# Your server timezone (e.g. America/New_York, Europe/London, Africa/Johannesburg)
TZ=${tz}

# Node.js heap size limit
NODE_OPTIONS=--max-old-space-size=768
ENVEOF

    chmod 640 "${env_file}"
    print_success "Configuration written to ${env_file}"
    print_info "Edit it to configure notifications, port, and timezone."
}

# ────────────────────────────────────────────────────────────
# Permissions
# ────────────────────────────────────────────────────────────

set_permissions() {
    run_cmd "Setting install directory ownership" \
        chown -R "${SERVICE_USER}:${SERVICE_USER}" "${INSTALL_DIR}"
    run_cmd "Creating log directory ${LOG_DIR}" \
        mkdir -p "${LOG_DIR}"
    run_cmd "Setting log directory ownership" \
        chown -R "${SERVICE_USER}:${SERVICE_USER}" "${LOG_DIR}"
    # Ensure the database directory is writable by the service user
    chmod 750 "${INSTALL_DIR}/backend"
}

# ────────────────────────────────────────────────────────────
# systemd service
# ────────────────────────────────────────────────────────────

create_systemd_service() {
    print_section "System Service"

    if ! command -v systemctl &>/dev/null; then
        print_warn "systemd not available — skipping service registration."
        print_info "Start manually with: cd ${INSTALL_DIR} && node backend/server.js"
        return 0
    fi

    local node_bin
    node_bin=$(command -v node)

    cat > "/etc/systemd/system/${SERVICE_NAME}.service" << SVCEOF
[Unit]
Description=Ezé-U Internet Monitor
Documentation=https://github.com/${GITHUB_REPO}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env
ExecStart=${node_bin} backend/server.js
Restart=on-failure
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=5

# Logging
StandardOutput=append:${LOG_DIR}/monitor.log
StandardError=append:${LOG_DIR}/error.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${INSTALL_DIR} ${LOG_DIR}

[Install]
WantedBy=multi-user.target
SVCEOF

    run_cmd "Reloading systemd daemon" systemctl daemon-reload
    run_cmd "Enabling ${SERVICE_NAME} on boot" systemctl enable "${SERVICE_NAME}"
    run_cmd "Starting ${SERVICE_NAME}" systemctl start "${SERVICE_NAME}"

    sleep 2
    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        print_success "Service is running"
    else
        print_warn "Service may not have started cleanly."
        print_info "Diagnose with: journalctl -u ${SERVICE_NAME} -n 30 --no-pager"
    fi
}

# ────────────────────────────────────────────────────────────
# Install the 'ezeu' CLI tool
# ────────────────────────────────────────────────────────────

create_cli_tool() {
    print_section "CLI Tool (ezeu)"

# NOTE: The closing delimiter EZEU_CLI must be at column 0 — this is a bash heredoc requirement.
cat > "${CLI_PATH}" << 'EZEU_CLI'
#!/usr/bin/env bash
# ============================================================
#  ezeu — Ezé-U Internet Monitor management CLI
#
#  Commands:
#    start          Start the monitor service
#    stop           Stop the monitor service
#    restart        Restart the monitor service
#    status         Show service info and version
#    logs           Follow live logs
#    -up / update   Check GitHub for updates and apply
#    reconfigure    Re-run configuration wizard
#    uninstall      Remove the app completely
# ============================================================

readonly _INSTALL_DIR="/opt/ezeu-internet-monitor"
readonly _SERVICE_NAME="ezeu-monitor"
readonly _LOG_DIR="/var/log/ezeu"
readonly _CLI_PATH="/usr/local/bin/ezeu"
readonly _GITHUB_REPO="Format209/Eze-U-Internet-Monitor"
readonly _GITHUB_API="https://api.github.com/repos/${_GITHUB_REPO}"
readonly _GITHUB_URL="https://github.com/${_GITHUB_REPO}.git"
readonly _SERVICE_USER="ezeu"

readonly COL_NC='\e[0m'
readonly COL_RED='\e[0;31m'
readonly COL_GREEN='\e[0;32m'
readonly COL_YELLOW='\e[1;33m'
readonly COL_BLUE='\e[0;34m'
readonly COL_CYAN='\e[0;36m'
readonly COL_BOLD='\e[1m'

TICK="  [${COL_GREEN}✓${COL_NC}]"
CROSS="  [${COL_RED}✗${COL_NC}]"
INFO="  [${COL_CYAN}i${COL_NC}]"
WARN="  [${COL_YELLOW}!${COL_NC}]"

print_info()    { echo -e "${INFO}  $1"; }
print_success() { echo -e "${TICK}  $1"; }
print_warn()    { echo -e "${WARN}  $1"; }
print_error()   { echo -e "${CROSS}  ${COL_RED}$1${COL_NC}"; }

require_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        print_error "This command requires root. Try: sudo ezeu $*"
        exit 1
    fi
}

check_install() {
    if [[ ! -d "${_INSTALL_DIR}" ]]; then
        print_error "Ezé-U Internet Monitor is not installed at ${_INSTALL_DIR}."
        exit 1
    fi
}

# ── status ──────────────────────────────────────────────────
cmd_status() {
    check_install
    echo -e ""
    echo -e "${COL_BOLD}${COL_BLUE}  ══════════════════════════════${COL_NC}"
    echo -e "${COL_BOLD}${COL_BLUE}    Ezé-U Internet Monitor${COL_NC}"
    echo -e "${COL_BOLD}${COL_BLUE}  ══════════════════════════════${COL_NC}"
    echo -e ""

    local port
    port=$(grep -E '^PORT=' "${_INSTALL_DIR}/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo "8745")

    local current_hash
    current_hash=$(git -C "${_INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

    local branch
    branch=$(git -C "${_INSTALL_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

    print_info "Version   : ${COL_YELLOW}${current_hash}${COL_NC} (${branch})"
    print_info "Directory : ${_INSTALL_DIR}"
    print_info "Logs      : ${_LOG_DIR}"
    print_info "Config    : ${_INSTALL_DIR}/.env"
    print_info "Web UI    : ${COL_CYAN}http://localhost:${port}${COL_NC}"
    echo -e ""

    if command -v systemctl &>/dev/null; then
        systemctl status "${_SERVICE_NAME}" --no-pager -l 2>/dev/null || \
            print_warn "Service not managed by systemd. Run: sudo ezeu start"
    fi
    echo -e ""
}

# ── service helpers ──────────────────────────────────────────
cmd_start() {
    require_root "$@"
    check_install
    systemctl start "${_SERVICE_NAME}"
    print_success "Service started"
}

cmd_stop() {
    require_root "$@"
    check_install
    systemctl stop "${_SERVICE_NAME}"
    print_success "Service stopped"
}

cmd_restart() {
    require_root "$@"
    check_install
    systemctl restart "${_SERVICE_NAME}"
    print_success "Service restarted"
}

# ── logs ─────────────────────────────────────────────────────
cmd_logs() {
    check_install
    if [[ -f "${_LOG_DIR}/monitor.log" ]]; then
        print_info "Following logs — press Ctrl+C to exit"
        echo -e ""
        tail -n 50 -f "${_LOG_DIR}/monitor.log" "${_LOG_DIR}/error.log" 2>/dev/null
    elif command -v journalctl &>/dev/null; then
        print_info "Following journal — press Ctrl+C to exit"
        echo -e ""
        journalctl -u "${_SERVICE_NAME}" -f --no-pager
    else
        print_error "No logs found. Service may not have run yet."
    fi
}

# ── update ───────────────────────────────────────────────────
cmd_update() {
    require_root "$@"
    check_install

    echo -e ""
    echo -e "${COL_BOLD}${COL_BLUE}  ════ Ezé-U Internet Monitor — Update ════${COL_NC}"
    echo -e ""

    # Check connectivity
    if ! curl -fsSL --max-time 5 "https://github.com" > /dev/null 2>&1; then
        print_error "Cannot reach GitHub. Check internet connectivity."
        exit 1
    fi

    # Fetch remote commit hash (main branch)
    print_info "Querying GitHub for latest version..."
    local remote_json
    remote_json=$(curl -fsSL --max-time 15 \
        "${_GITHUB_API}/commits/main" 2>/dev/null) || {
        print_error "Failed to fetch version info from GitHub."
        exit 1
    }

    local remote_hash
    remote_hash=$(echo "${remote_json}" | grep '"sha"' | head -1 \
        | sed 's/.*"sha"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' | cut -c1-7)

    if [[ -z "${remote_hash}" ]]; then
        print_error "Could not parse version from GitHub API response."
        exit 1
    fi

    local current_hash
    current_hash=$(git -C "${_INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "")

    print_info "Current version : ${COL_YELLOW}${current_hash:-unknown}${COL_NC}"
    print_info "Latest version  : ${COL_GREEN}${remote_hash}${COL_NC}"

    if [[ "${current_hash}" == "${remote_hash}" ]]; then
        print_success "Already up to date — nothing to do."
        echo -e ""
        return 0
    fi

    # Fetch and display recent commit messages as a changelog
    local changelog
    changelog=$(curl -fsSL --max-time 10 \
        "${_GITHUB_API}/commits?per_page=5" 2>/dev/null \
        | grep '"message"' \
        | sed 's/.*"message"[[:space:]]*:[[:space:]]*"\([^"\\]*\)".*/  • \1/' \
        | head -5) || true

    if [[ -n "${changelog}" ]]; then
        echo -e ""
        echo -e "${COL_BOLD}  Recent changes:${COL_NC}"
        echo -e "${changelog}"
        echo -e ""
    fi

    # Record package.json checksums before pulling to detect dep changes
    local backend_pkg_before frontend_pkg_before
    backend_pkg_before=$(md5sum "${_INSTALL_DIR}/backend/package.json" 2>/dev/null | awk '{print $1}' || echo "")
    frontend_pkg_before=$(md5sum "${_INSTALL_DIR}/frontend/package.json" 2>/dev/null | awk '{print $1}' || echo "")

    # Stop service
    local was_running=false
    if systemctl is-active --quiet "${_SERVICE_NAME}" 2>/dev/null; then
        was_running=true
        print_info "Stopping service for update..."
        systemctl stop "${_SERVICE_NAME}"
    fi

    # Pull latest changes
    print_info "Pulling latest changes from GitHub..."
    if ! git -C "${_INSTALL_DIR}" pull --ff-only origin main 2>&1; then
        print_error "git pull failed — local modifications may be conflicting."
        print_info "Force update: sudo git -C ${_INSTALL_DIR} reset --hard origin/main && sudo ezeu -up"
        if [[ "${was_running}" == "true" ]]; then
            systemctl start "${_SERVICE_NAME}"
        fi
        exit 1
    fi

    # Reinstall backend deps if package.json changed
    local backend_pkg_after
    backend_pkg_after=$(md5sum "${_INSTALL_DIR}/backend/package.json" 2>/dev/null | awk '{print $1}' || echo "")
    if [[ "${backend_pkg_before}" != "${backend_pkg_after}" ]]; then
        print_info "Backend package.json changed — reinstalling dependencies..."
        bash -c "cd '${_INSTALL_DIR}/backend' && npm install --omit=dev --no-fund --no-audit" \
            > /tmp/ezeu_update.log 2>&1 || {
            print_warn "Backend npm install had warnings. Check /tmp/ezeu_update.log"
        }
        print_success "Backend dependencies updated"
    fi

    # Reinstall frontend deps if package.json changed
    local frontend_pkg_after
    frontend_pkg_after=$(md5sum "${_INSTALL_DIR}/frontend/package.json" 2>/dev/null | awk '{print $1}' || echo "")
    if [[ "${frontend_pkg_before}" != "${frontend_pkg_after}" ]]; then
        print_info "Frontend package.json changed — reinstalling dependencies..."
        bash -c "cd '${_INSTALL_DIR}/frontend' && npm install --no-fund --no-audit" \
            > /tmp/ezeu_update.log 2>&1 || {
            print_warn "Frontend npm install had warnings. Check /tmp/ezeu_update.log"
        }
        print_success "Frontend dependencies updated"
    fi

    # Always rebuild the frontend after any update
    print_info "Rebuilding frontend production bundle..."
    if bash -c "cd '${_INSTALL_DIR}/frontend' && npm run build" \
            > /tmp/ezeu_update.log 2>&1; then
        print_success "Frontend rebuilt"
    else
        print_warn "Frontend build had errors — see /tmp/ezeu_update.log"
    fi

    # Restore file ownership
    chown -R "${_SERVICE_USER}:${_SERVICE_USER}" "${_INSTALL_DIR}" 2>/dev/null || true

    # Update the CLI tool itself if install.sh was updated
    if [[ -f "${_INSTALL_DIR}/install.sh" ]]; then
        print_info "Refreshing CLI tool from updated install.sh..."
        bash "${_INSTALL_DIR}/install.sh" --update-cli-only 2>/dev/null || true
    fi

    # Restart service
    if [[ "${was_running}" == "true" ]]; then
        systemctl start "${_SERVICE_NAME}"
        sleep 2
        if systemctl is-active --quiet "${_SERVICE_NAME}"; then
            print_success "Service restarted successfully"
        else
            print_warn "Service did not restart cleanly. Check: journalctl -u ${_SERVICE_NAME} -n 20"
        fi
    fi

    local new_hash
    new_hash=$(git -C "${_INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "?")
    print_success "Update complete! Now on version: ${COL_GREEN}${new_hash}${COL_NC}"
    echo -e ""
}

# ── reconfigure ──────────────────────────────────────────────
cmd_reconfigure() {
    require_root "$@"
    check_install
    if [[ ! -f "${_INSTALL_DIR}/install.sh" ]]; then
        print_error "install.sh not found at ${_INSTALL_DIR}/install.sh"
        print_info "Re-download: curl -fsSL https://raw.githubusercontent.com/${_GITHUB_REPO}/main/install.sh | sudo bash -s -- --reconfigure"
        exit 1
    fi
    bash "${_INSTALL_DIR}/install.sh" --reconfigure
}

# ── uninstall ────────────────────────────────────────────────
cmd_uninstall() {
    require_root "$@"
    echo -e ""
    echo -e "${COL_RED}${COL_BOLD}  ⚠️  WARNING: This will completely remove Ezé-U Internet Monitor.${COL_NC}"
    echo -e "${COL_YELLOW}  This includes the database and all collected data.${COL_NC}"
    echo -e ""
    read -r -p "  Type 'yes' to confirm uninstallation: " confirm_input
    if [[ "${confirm_input}" != "yes" ]]; then
        print_info "Uninstall cancelled."
        return 0
    fi

    if command -v systemctl &>/dev/null; then
        systemctl stop    "${_SERVICE_NAME}" 2>/dev/null || true
        systemctl disable "${_SERVICE_NAME}" 2>/dev/null || true
        rm -f "/etc/systemd/system/${_SERVICE_NAME}.service"
        systemctl daemon-reload 2>/dev/null || true
    fi

    rm -rf "${_INSTALL_DIR}"
    rm -rf "${_LOG_DIR}"
    rm -f  "${_CLI_PATH}"
    userdel "${_SERVICE_USER}" 2>/dev/null || true

    print_success "Ezé-U Internet Monitor has been removed."
}

# ── help ─────────────────────────────────────────────────────
cmd_help() {
    echo -e ""
    echo -e "${COL_BOLD}  Usage: ${COL_CYAN}ezeu${COL_NC}${COL_BOLD} <command>${COL_NC}"
    echo -e ""
    echo -e "  ${COL_BOLD}Service management:${COL_NC}"
    echo -e "    ${COL_CYAN}start${COL_NC}           Start the monitor service"
    echo -e "    ${COL_CYAN}stop${COL_NC}            Stop the monitor service"
    echo -e "    ${COL_CYAN}restart${COL_NC}         Restart the monitor service"
    echo -e "    ${COL_CYAN}status${COL_NC}          Show service status, version, and URLs"
    echo -e "    ${COL_CYAN}logs${COL_NC}            Follow live application logs"
    echo -e ""
    echo -e "  ${COL_BOLD}Updates:${COL_NC}"
    echo -e "    ${COL_CYAN}-up${COL_NC}             Check GitHub and apply any updates"
    echo -e "    ${COL_CYAN}update${COL_NC}          Alias for -up"
    echo -e ""
    echo -e "  ${COL_BOLD}Maintenance:${COL_NC}"
    echo -e "    ${COL_CYAN}reconfigure${COL_NC}     Re-run the configuration wizard"
    echo -e "    ${COL_CYAN}uninstall${COL_NC}       Remove Ezé-U Internet Monitor completely"
    echo -e ""
    echo -e "  ${COL_BOLD}Examples:${COL_NC}"
    echo -e "    sudo ezeu -up"
    echo -e "    sudo ezeu restart"
    echo -e "    ezeu status"
    echo -e "    ezeu logs"
    echo -e ""
}

# ── Entry point ──────────────────────────────────────────────
case "${1:-help}" in
    start)               cmd_start ;;
    stop)                cmd_stop ;;
    restart)             cmd_restart ;;
    status)              cmd_status ;;
    logs)                cmd_logs ;;
    -up|update|upgrade)  cmd_update ;;
    reconfigure)         cmd_reconfigure ;;
    uninstall|remove)    cmd_uninstall ;;
    help|-h|--help)      cmd_help ;;
    *)
        print_error "Unknown command: '$1'"
        cmd_help
        exit 1
        ;;
esac
EZEU_CLI

    chmod +x "${CLI_PATH}"
    print_success "CLI installed at ${CLI_PATH}"
    print_info "Run ${COL_BOLD}ezeu help${COL_NC} to see all commands"
}

# ────────────────────────────────────────────────────────────
# Installation summary
# ────────────────────────────────────────────────────────────

print_summary() {
    local port
    port=$(grep -E '^PORT=' "${INSTALL_DIR}/.env" 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || echo "${DEFAULT_PORT}")

    local local_ip
    local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "your-server-ip")

    local current_hash
    current_hash=$(git -C "${INSTALL_DIR}" rev-parse --short HEAD 2>/dev/null || echo "unknown")

    echo -e ""
    echo -e "${COL_GREEN}${COL_BOLD}  ╔════════════════════════════════════════════╗${COL_NC}"
    echo -e "${COL_GREEN}${COL_BOLD}  ║   Ezé-U Internet Monitor is installed!    ║${COL_NC}"
    echo -e "${COL_GREEN}${COL_BOLD}  ╚════════════════════════════════════════════╝${COL_NC}"
    echo -e ""
    echo -e "  ${COL_BOLD}Open your monitor at:${COL_NC}"
    echo -e "    ${COL_CYAN}http://localhost:${port}${COL_NC}"
    echo -e "    ${COL_CYAN}http://${local_ip}:${port}${COL_NC}"
    echo -e ""
    echo -e "  ${COL_BOLD}Useful commands:${COL_NC}"
    echo -e "    ${COL_CYAN}ezeu status${COL_NC}      — Service status & info"
    echo -e "    ${COL_CYAN}ezeu -up${COL_NC}         — Check GitHub & update"
    echo -e "    ${COL_CYAN}ezeu logs${COL_NC}        — Follow live logs"
    echo -e "    ${COL_CYAN}ezeu restart${COL_NC}     — Restart the service"
    echo -e "    ${COL_CYAN}ezeu help${COL_NC}        — All available commands"
    echo -e ""
    echo -e "  ${COL_BOLD}Configuration:${COL_NC}   ${INSTALL_DIR}/.env"
    echo -e "  ${COL_BOLD}Logs:${COL_NC}             ${LOG_DIR}/"
    echo -e "  ${COL_BOLD}Version:${COL_NC}          ${current_hash}"
    echo -e ""
}

# ────────────────────────────────────────────────────────────
# Argument parsing
# ────────────────────────────────────────────────────────────

parse_args() {
    while [[ "$#" -gt 0 ]]; do
        case "$1" in
            --reconfigure)
                RECONFIGURE=true
                ;;
            --unattended|-y)
                UNATTENDED=true
                ;;
            --update-cli-only)
                # Internal flag: called by 'ezeu -up' to refresh the CLI tool
                create_cli_tool
                exit 0
                ;;
            --help|-h)
                echo "Usage: sudo bash install.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --reconfigure    Re-run configuration (.env) wizard only"
                echo "  --unattended     Non-interactive install (accept all defaults)"
                echo "  --help           Show this help"
                exit 0
                ;;
            *)
                print_error "Unknown argument: $1"
                exit 1
                ;;
        esac
        shift
    done
}

# ────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────

main() {
    parse_args "$@"
    print_banner

    # -- Reconfigure only mode --
    if [[ "${RECONFIGURE}" == "true" ]]; then
        check_root
        if [[ ! -d "${INSTALL_DIR}" ]]; then
            print_error "No installation found at ${INSTALL_DIR}. Run the full installer first."
            exit 1
        fi
        configure_env
        print_success "Reconfiguration complete — restart with: sudo ezeu restart"
        return 0
    fi

    # -- Full installation --
    check_root
    detect_os
    install_system_deps
    install_nodejs
    install_speedtest_cli
    create_service_user
    install_app
    install_npm_packages
    configure_env
    set_permissions
    create_systemd_service
    create_cli_tool
    print_summary
}

main "$@"
