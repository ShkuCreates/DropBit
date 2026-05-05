require('dotenv').config();
const { Client, GatewayIntentBits, Partials, ActivityType, PresenceUpdateStatus } = require('discord.js');
const fs = require('fs');
const path = require('path');

const Database = require('./utils/database');
const config = require('./utils/configLoader');
const RoleManager = require('./utils/roleManager');
const CommandRegistry = require('./utils/commandRegistry');

class DropBitBot {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent
      ],
      partials: [
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction,
        Partials.GuildScheduledEvent,
        Partials.ThreadMember
      ]
    });

    this.db = new Database();
    this.modules = new Map();
    this.cooldowns = new Map();
    this.roleManager = new RoleManager(this.client, this.db, config);
    this.commandRegistry = new CommandRegistry();
  }

  async initialize() {
    try {
      console.log('🚀 Initializing DropBit Bot...');
      
      await this.db.connect();
      console.log('✅ Database connected');

      await this.loadModules();
      console.log('✅ Modules loaded');

      await this.loadEvents();
      console.log('✅ Events loaded');

      // Initialize and register commands
      this.commandRegistry.initializeAllCommands();
      await this.commandRegistry.registerAllCommands(this.client);

      this.setupBotStatus();
      
      this.client.login(process.env.BOT_TOKEN);
      
    } catch (error) {
      console.error('❌ Failed to initialize bot:', error);
      process.exit(1);
    }
  }

  async loadModules() {
    const modulesPath = path.join(__dirname, 'modules');
    const moduleFiles = fs.readdirSync(modulesPath).filter(file => file.endsWith('.js'));

    for (const file of moduleFiles) {
      try {
        const ModuleClass = require(path.join(modulesPath, file));
        const module = new ModuleClass(this.client, this.db, config);
        await module.initialize();
        this.modules.set(file.replace('.js', ''), module);
        console.log(`📦 Loaded module: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to load module ${file}:`, error);
      }
    }
  }

  async loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
      try {
        const event = require(path.join(eventsPath, file));
        const eventName = file.split('.')[0];
        
        if (event.once) {
          this.client.once(eventName, (...args) => event.execute(...args, this.client, this.db, config, this.modules));
        } else {
          this.client.on(eventName, (...args) => event.execute(...args, this.client, this.db, config, this.modules));
        }
        
        console.log(`📋 Loaded event: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to load event ${file}:`, error);
      }
    }
  }

  setupBotStatus() {
    this.client.once('ready', async () => {
      console.log(`✅ Bot is online as ${this.client.user.tag}`);
      
      // Initialize roles automatically
      const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
      if (guild) {
        console.log('🔧 Setting up server roles...');
        await this.roleManager.initializeRoles(guild);
      }
      
      const statusConfig = config.get('bot.status');
      
      this.client.user.setPresence({
        status: statusConfig.state === 'DND' ? PresenceUpdateStatus.DoNotDisturb : 
               statusConfig.state === 'IDLE' ? PresenceUpdateStatus.Idle : 
               PresenceUpdateStatus.Online,
        activities: [{
          name: statusConfig.activity,
          type: statusConfig.type === 'STREAMING' ? ActivityType.Streaming :
                statusConfig.type === 'WATCHING' ? ActivityType.Watching :
                statusConfig.type === 'LISTENING' ? ActivityType.Listening :
                statusConfig.type === 'PLAYING' ? ActivityType.Playing :
                ActivityType.Custom,
          url: statusConfig.type === 'STREAMING' ? statusConfig.url : undefined
        }]
      });
    });
  }

  hasPermission(member, permission = 'ADMINISTRATOR') {
    if (!member) return false;
    
    const adminRoles = config.get('bot.adminRoles') || [];
    return member.permissions.has(permission) || 
           member.roles.cache.some(role => adminRoles.includes(role.name));
  }

  setCooldown(userId, command, duration) {
    if (!this.cooldowns.has(command)) {
      this.cooldowns.set(command, new Map());
    }
    
    const now = Date.now();
    const timestamps = this.cooldowns.get(command);
    timestamps.set(userId, now + duration);
    
    setTimeout(() => timestamps.delete(userId), duration);
  }

  getCooldown(userId, command) {
    if (!this.cooldowns.has(command)) return 0;
    
    const timestamps = this.cooldowns.get(command);
    const expirationTime = timestamps.get(userId);
    
    if (!expirationTime) return 0;
    
    const now = Date.now();
    if (now > expirationTime) {
      timestamps.delete(userId);
      return 0;
    }
    
    return expirationTime - now;
  }
}

const bot = new DropBitBot();
bot.initialize();

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});
