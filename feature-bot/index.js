require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, PresenceUpdateStatus } = require('discord.js');
const fs = require('fs');
const path = require('path');

class DropbitEngine {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
      ]
    });
    
    this.commands = new Map();
    this.events = new Map();
    this.backgroundJobs = new Map();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing Dropbit Engine (Feature Bot)...');
      
      this.setupBotStatus();
      
      await this.loadCommands();
      console.log('✅ Commands loaded');

      await this.loadEvents();
      console.log('✅ Events loaded');

      await this.setupBackgroundJobs();
      console.log('✅ Background jobs setup');
      
      this.client.login(process.env.FEATURE_BOT_TOKEN);
      
    } catch (error) {
      console.error('❌ Failed to initialize Dropbit Engine:', error);
      process.exit(1);
    }
  }

  async loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      try {
        const CommandClass = require(path.join(commandsPath, file));
        const command = new CommandClass(this.client);
        this.commands.set(file.replace('.js', ''), command);
        console.log(`📦 Loaded command: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to load command ${file}:`, error);
      }
    }

    // Register slash commands
    const CommandRegistry = require('./utils/commandRegistry');
    const registry = new CommandRegistry();
    await registry.registerAllCommands(this.client);
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      try {
        const event = require(path.join(eventsPath, file));
        const eventName = file.split('.')[0];
        
        if (event.once) {
          this.client.once(eventName, (...args) => event.execute(...args, this.client, this.commands));
        } else {
          this.client.on(eventName, (...args) => event.execute(...args, this.client, this.commands));
        }
        
        console.log(`📋 Loaded event: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to load event ${file}:`, error);
      }
    }
  }

  async setupBackgroundJobs() {
    const ProductScheduler = require('./modules/productScheduler');
    const CompetitorTracker = require('./modules/competitorTracker');
    
    const productScheduler = new ProductScheduler(this.client);
    const competitorTracker = new CompetitorTracker(this.client);
    
    this.backgroundJobs.set('productScheduler', productScheduler);
    this.backgroundJobs.set('competitorTracker', competitorTracker);
    
    await productScheduler.start();
    await competitorTracker.start();
  }

  setupBotStatus() {
    this.client.once('ready', () => {
      console.log(`✅ Dropbit Engine is online as ${this.client.user.tag}`);
      
      this.client.user.setPresence({
        status: PresenceUpdateStatus.Online,
        activities: [{
          name: 'Dropbit System Running',
          type: ActivityType.Watching
        }]
      });
    });
  }
}

module.exports = DropbitEngine;
