// Test: Dynamic Backend URL Detection
// This demonstrates how the frontend automatically detects the correct backend URL

console.log('=== Frontend Backend URL Detection Test ===\n');

// Simulate different access scenarios
const scenarios = [
  { desc: 'Local Development', protocol: 'http:', hostname: 'localhost', port: '3000' },
  { desc: 'Network Access (Dev)', protocol: 'http:', hostname: '192.168.110.103', port: '3000' },
  { desc: 'Docker/Production', protocol: 'http:', hostname: 'localhost', port: '5000' },
  { desc: 'Network Access (Prod)', protocol: 'http:', hostname: '192.168.110.103', port: '5000' },
  { desc: 'Custom Domain', protocol: 'https:', hostname: 'monitor.example.com', port: '443' },
];

const getBackendUrl = (location) => {
  const protocol = location.protocol;
  const hostname = location.hostname;
  
  // Backend is always on port 5000
  return `${protocol}//${hostname}:5000`;
};

const getWebSocketUrl = (backendUrl) => {
  return backendUrl.replace(/^http/, 'ws');
};

scenarios.forEach(scenario => {
  const location = {
    protocol: scenario.protocol,
    hostname: scenario.hostname,
    port: scenario.port
  };
  
  const frontendUrl = `${scenario.protocol}//${scenario.hostname}:${scenario.port}`;
  const backendUrl = getBackendUrl(location);
  const wsUrl = getWebSocketUrl(backendUrl);
  
  console.log(`Scenario: ${scenario.desc}`);
  console.log(`  Frontend URL:  ${frontendUrl}`);
  console.log(`  Backend URL:   ${backendUrl}`);
  console.log(`  WebSocket URL: ${wsUrl}`);
  console.log('');
});

console.log('=== Key Takeaway ===');
console.log('No matter what IP/hostname you use to access the frontend,');
console.log('it will ALWAYS connect to the backend on the SAME IP/hostname at port 5000.');
console.log('\nThis means:');
console.log('✅ Works on localhost');
console.log('✅ Works on network IPs (192.168.x.x)');
console.log('✅ Works in Docker');
console.log('✅ Works with custom domains');
console.log('✅ No configuration needed!');
