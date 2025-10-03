import React, { useState } from 'react';
import { Save, RotateCcw, Plus, Trash2, Settings as SettingsIcon, Activity, AlertTriangle, Heart } from 'lucide-react';
import './Settings.css';

function Settings({ settings, updateSettings }) {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [localSettings, setLocalSettings] = useState({
    ...settings,
    monitoringHosts: settings.monitoringHosts || [
      { address: '8.8.8.8', name: 'Google DNS', enabled: true },
      { address: '1.1.1.1', name: 'Cloudflare DNS', enabled: true },
      { address: '208.67.222.222', name: 'OpenDNS', enabled: false }
    ]
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [newHost, setNewHost] = useState({ address: '', name: '', enabled: true });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setLocalSettings(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : parseFloat(value) || value
        }
      }));
    } else {
      setLocalSettings(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : parseFloat(value) || value
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    
    try {
      await updateSettings(localSettings);
      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      setSaveMessage('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(settings);
    setSaveMessage('Settings reset');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleHostToggle = (index) => {
    const hosts = localSettings.monitoringHosts || [];
    const updatedHosts = [...hosts];
    updatedHosts[index].enabled = !updatedHosts[index].enabled;
    setLocalSettings(prev => ({
      ...prev,
      monitoringHosts: updatedHosts
    }));
  };

  const handleAddHost = () => {
    if (newHost.address && newHost.name) {
      const hosts = localSettings.monitoringHosts || [];
      setLocalSettings(prev => ({
        ...prev,
        monitoringHosts: [...hosts, { ...newHost }]
      }));
      setNewHost({ address: '', name: '', enabled: true });
    }
  };

  const handleRemoveHost = (index) => {
    const hosts = localSettings.monitoringHosts || [];
    const updatedHosts = hosts.filter((_, i) => i !== index);
    setLocalSettings(prev => ({
      ...prev,
      monitoringHosts: updatedHosts
    }));
  };

  return (
    <div className="settings">
      <div className="settings-container">
        <h2>Settings</h2>

        {saveMessage && (
          <div className={`save-message ${saveMessage.includes('Error') ? 'error' : 'success'}`}>
            {saveMessage}
          </div>
        )}

        <div className="settings-layout">
          {/* Side Tabs */}
          <div className="settings-sidebar">
            <button
              className={`sidebar-tab ${activeTab === 'monitoring' ? 'active' : ''}`}
              onClick={() => setActiveTab('monitoring')}
            >
              <SettingsIcon size={20} />
              <span>Monitoring</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'hosts' ? 'active' : ''}`}
              onClick={() => setActiveTab('hosts')}
            >
              <Activity size={20} />
              <span>Live Hosts</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'thresholds' ? 'active' : ''}`}
              onClick={() => setActiveTab('thresholds')}
            >
              <AlertTriangle size={20} />
              <span>Thresholds</span>
            </button>
            <button
              className={`sidebar-tab ${activeTab === 'donate' ? 'active' : ''}`}
              onClick={() => setActiveTab('donate')}
            >
              <Heart size={20} />
              <span>Donate</span>
            </button>
          </div>

          {/* Content Area */}
          <div className="settings-content">
            {/* Monitoring Configuration Tab */}
            {activeTab === 'monitoring' && (
              <div className="settings-section">
          <h3>Monitoring Configuration</h3>
          
          <div className="setting-item">
            <label htmlFor="testInterval">
              Test Interval (minutes)
              <span className="help-text">How often to run automatic speed tests</span>
            </label>
            <input
              type="number"
              id="testInterval"
              name="testInterval"
              value={localSettings.testInterval}
              onChange={handleChange}
              min="1"
              max="1440"
            />
          </div>
        </div>
      )}

            {/* Monitoring Hosts Tab */}
            {activeTab === 'hosts' && (
              <div className="settings-section">
                <h3>Monitoring Hosts</h3>
          <p className="section-description">
            Configure which hosts to ping during live monitoring. Multiple hosts can be monitored simultaneously.
          </p>

          <div className="monitoring-hosts-list">
            {(localSettings.monitoringHosts || []).map((host, index) => (
              <div key={index} className="monitoring-host-item">
                <div className="host-toggle">
                  <input
                    type="checkbox"
                    checked={host.enabled}
                    onChange={() => handleHostToggle(index)}
                  />
                </div>
                <div className="host-details">
                  <div className="host-name">{host.name}</div>
                  <div className="host-address-small">{host.address}</div>
                </div>
                <button
                  className="btn-remove-host"
                  onClick={() => handleRemoveHost(index)}
                  title="Remove host"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="add-host-section">
            <h4>Add New Host</h4>
            <div className="add-host-form">
              <input
                type="text"
                placeholder="Host Name (e.g., Google DNS)"
                value={newHost.name}
                onChange={(e) => setNewHost({ ...newHost, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="IP Address (e.g., 8.8.8.8)"
                value={newHost.address}
                onChange={(e) => setNewHost({ ...newHost, address: e.target.value })}
              />
              <button
                className="btn-add-host"
                onClick={handleAddHost}
                disabled={!newHost.address || !newHost.name}
              >
                <Plus size={20} />
                Add Host
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Performance Thresholds Tab */}
            {activeTab === 'thresholds' && (
              <div className="settings-section">
                <h3>Performance Thresholds</h3>
          <p className="section-description">
            Set minimum acceptable values for network performance. Values below these thresholds will be highlighted as warnings.
          </p>

          <div className="setting-item">
            <label htmlFor="thresholds.minDownload">
              Minimum Download Speed (Mbps)
              <span className="help-text">Alert when download speed falls below this value</span>
            </label>
            <input
              type="number"
              id="thresholds.minDownload"
              name="thresholds.minDownload"
              value={localSettings.thresholds.minDownload}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="thresholds.minUpload">
              Minimum Upload Speed (Mbps)
              <span className="help-text">Alert when upload speed falls below this value</span>
            </label>
            <input
              type="number"
              id="thresholds.minUpload"
              name="thresholds.minUpload"
              value={localSettings.thresholds.minUpload}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="thresholds.maxPing">
              Maximum Ping (ms)
              <span className="help-text">Alert when ping exceeds this value</span>
            </label>
            <input
              type="number"
              id="thresholds.maxPing"
              name="thresholds.maxPing"
              value={localSettings.thresholds.maxPing}
              onChange={handleChange}
              min="1"
              step="1"
            />
          </div>
        </div>
      )}

            {/* Donate Tab */}
            {activeTab === 'donate' && (
              <div className="settings-section">
                <h3>Support Development</h3>
                <p className="section-description">
                  If you find this application useful, please consider supporting its development.
                  Your contribution helps maintain and improve Ezé-U Internet Monitor.
                </p>
                <div className="donate-content">
                  <div className="donate-card">
                    <Heart size={48} className="donate-icon" />
                    <h4>Become a Sponsor</h4>
                    <p>Support ongoing development.</p>
                    <a
                      href="https://github.com/sponsors/Format209"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-donate"
                    >
                      <Heart size={20} />
                      Sponsor on GitHub
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Save/Reset Actions - Always visible */}
            <div className="settings-actions">
              <button
                className="btn-reset"
                onClick={handleReset}
              >
                <RotateCcw size={20} />
                Reset
              </button>
              <button
                className="btn-save"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save size={20} />
                {isSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;
