require('dotenv').config();
const http = require('http');

console.log('🚀 Starting Dropbit Bot System...');
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Dropbit is running!');
});
server.listen(process.env.PORT || 3000, () => {
  console.log(`✅ Keep-alive server running on port ${process.env.PORT || 3000}`);
});
console.log('📦 Loading Utility Bot (Dropbit Core)...');

// Load and start Utility Bot (untouched)
const initializeUtilityBot = require('./src/index.js');

console.log('📦 Loading Feature Bot (Dropbit Engine)...');

// Load and start Feature Bot
const DropbitEngine = require('./feature-bot/index.js');
const featureBot = new DropbitEngine();

// Start both bots
async function startBothBots() {
  try {
    // Start utility bot first (it's already initialized by the require)
    console.log('✅ Utility Bot started');
    
    // Wait a moment before starting feature bot
    setTimeout(async () => {
      try {
        await featureBot.initialize();
      } catch (error) {
        console.error('❌ Failed to start Feature Bot:', error);
      }
    }, 2000); // 2 second delay
    
  } catch (error) {
    console.error('❌ Failed to start Utility Bot:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔄 Shutting down bots gracefully...');
  
  if (featureBot.client) {
    featureBot.client.destroy();
  }
  
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the system
startBothBots();
