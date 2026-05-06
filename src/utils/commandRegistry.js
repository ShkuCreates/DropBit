const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

class CommandRegistry {
  constructor() {
    this.commands = new Map();
  }

  registerCommand(name, builder) {
    this.commands.set(name, builder);
  }

  async registerAllCommands(client) {
    try {
      // Wait for client to be ready
      if (!client.isReady()) {
        await new Promise(resolve => client.once('ready', resolve));
      }
      
      const allCommands = Array.from(this.commands.values());
      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      if (guild) {
        await guild.commands.set(allCommands);
        console.log(`✅ Registered ${allCommands.length} slash commands to guild`);
      } else {
        await client.application.commands.set(allCommands);
        console.log(`✅ Registered ${allCommands.length} slash commands globally`);
      }
    } catch (error) {
      console.error('❌ Failed to register slash commands:', error);
    }
  }

  getTriggerCommands() {
    return new SlashCommandBuilder()
      .setName('trigger')
      .setDescription('Manage auto triggers')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Add a new trigger')
          .addStringOption(option =>
            option.setName('keyword')
              .setDescription('The keyword to trigger the response')
              .setRequired(true)
          )
          .addStringOption(option =>
            option.setName('response')
              .setDescription('The response message')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Remove a trigger')
          .addStringOption(option =>
            option.setName('keyword')
              .setDescription('The keyword to remove')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all triggers')
      );
  }

  getStickyCommands() {
    return new SlashCommandBuilder()
      .setName('sticky')
      .setDescription('Manage sticky messages')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(subcommand =>
        subcommand
          .setName('set')
          .setDescription('Set a sticky message')
          .addStringOption(option =>
            option.setName('message')
              .setDescription('The sticky message content')
              .setRequired(true)
          )
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('The channel to set the sticky message in (defaults to current)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('remove')
          .setDescription('Remove the sticky message')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('The channel to remove the sticky message from (defaults to current)')
              .setRequired(false)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('show')
          .setDescription('Show the current sticky message')
          .addChannelOption(option =>
            option.setName('channel')
              .setDescription('The channel to show the sticky message for (defaults to current)')
              .setRequired(false)
          )
      );
  }

  getModerationCommands() {
    return [
      new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to ban')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the ban')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option.setName('days')
            .setDescription('Days of messages to delete (0-7)')
            .setMinValue(0)
            .setMaxValue(7)
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to kick')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the kick')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
          option.setName('user')
            .setDescription('The user to warn')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('reason')
            .setDescription('The reason for the warning')
            .setRequired(true)
        )
    ];
  }

  initializeAllCommands() {
    this.registerCommand('trigger', this.getTriggerCommands());
    this.registerCommand('sticky', this.getStickyCommands());
    
    const TestCommand = require('../commands/test');
    const testCmd = new TestCommand(null, null, null);
    this.registerCommand('test', testCmd.getSlashCommand());
    
    const modCommands = this.getModerationCommands();
    modCommands.forEach(cmd => {
      this.registerCommand(cmd.name, cmd);
    });
  }
}

module.exports = CommandRegistry;
