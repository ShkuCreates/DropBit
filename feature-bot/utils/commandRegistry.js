const { SlashCommandBuilder } = require('discord.js');

class FeatureBotCommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  async registerAllCommands(client) {
    try {
      // Wait for client to be ready
      if (!client.isReady()) {
        await new Promise(resolve => client.once('ready', resolve));
      }

      const AdsCommand = require('../commands/ads');
      const TrackCommand = require('../commands/track');
      const UntrackCommand = require('../commands/untrack');
      const ProductsCommand = require('../commands/products');

      const adsCmd = new AdsCommand(client);
      const trackCmd = new TrackCommand(client);
      const untrackCmd = new UntrackCommand(client);
      const productsCmd = new ProductsCommand(client);

      const commands = [
        adsCmd.getSlashCommand(),
        trackCmd.getSlashCommand(),
        untrackCmd.getSlashCommand(),
        productsCmd.getSlashCommand()
      ];

      await client.application.commands.set(commands);
      console.log(`✅ Registered ${commands.length} feature bot slash commands`);
    } catch (error) {
      console.error('❌ Failed to register feature bot commands:', error);
    }
  }
}

module.exports = FeatureBotCommandRegistry;
