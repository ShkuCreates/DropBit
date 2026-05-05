const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Helpers = require('../utils/helpers');

class TriggersModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.triggers = new Map();
  }

  async initialize() {
    console.log('📦 Triggers module initialized');
    await this.loadTriggers();
  }

  async loadTriggers() {
    try {
      const allTriggers = await this.db.find('triggers', { guildId: process.env.GUILD_ID });
      this.triggers.clear();
      
      for (const trigger of allTriggers) {
        this.triggers.set(trigger.keyword.toLowerCase(), trigger);
      }
      
      console.log(`Loaded ${this.triggers.size} triggers`);
    } catch (error) {
      console.error('Error loading triggers:', error);
    }
  }

  setupSlashCommands() {
    // Wait for bot to be ready before setting up commands
    if (!this.client.isReady()) {
      this.client.once('ready', () => {
        this.registerSlashCommands();
      });
    } else {
      this.registerSlashCommands();
    }
  }

  async registerSlashCommands() {
    try {
      const commands = [
        new SlashCommandBuilder()
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
          )
      ];

      await this.client.application.commands.set(commands);
      console.log('✅ Registered trigger slash commands');
    } catch (error) {
      console.error('❌ Failed to register trigger commands:', error);
    }
  }

  async handleMessage(message) {
    if (!this.config.get('triggers.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = this.config.get('triggers.caseSensitive') ? message.content : message.content.toLowerCase();
    
    for (const [keyword, triggerData] of this.triggers.entries()) {
      const searchKeyword = this.config.get('triggers.caseSensitive') ? keyword : keyword.toLowerCase();
      
      if (content.includes(searchKeyword)) {
        await this.respondToTrigger(message, triggerData);
        break;
      }
    }
  }

  async respondToTrigger(message, triggerData) {
    try {
      let response = triggerData.response;
      
      if (this.config.get('triggers.mentionUser')) {
        response = `${message.author.toString()}, ${response}`;
      }

      response = response
        .replace('{user}', message.author.toString())
        .replace('{username}', message.author.username)
        .replace('{server}', message.guild.name)
        .replace('{channel}', message.channel.toString());

      await message.reply(response);

    } catch (error) {
      console.error('Error responding to trigger:', error);
    }
  }

  async handleSlashCommand(interaction) {
    if (!Helpers.hasAdminRole(interaction.member, this.config)) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'You need admin permissions to use trigger commands.')],
        ephemeral: true
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'add':
        await this.addTrigger(interaction);
        break;
      case 'remove':
        await this.removeTrigger(interaction);
        break;
      case 'list':
        await this.listTriggers(interaction);
        break;
    }
  }

  async addTrigger(interaction) {
    try {
      const keyword = interaction.options.getString('keyword').trim();
      const response = interaction.options.getString('response').trim();

      if (!keyword || !response) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Invalid Input', 'Both keyword and response are required.')],
          ephemeral: true
        });
        return;
      }

      const existingTrigger = await this.db.findOne('triggers', {
        guildId: interaction.guild.id,
        keyword: this.config.get('triggers.caseSensitive') ? keyword : keyword.toLowerCase()
      });

      if (existingTrigger) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Trigger Exists', `A trigger with keyword "${keyword}" already exists.`)],
          ephemeral: true
        });
        return;
      }

      const triggerData = await this.db.create('triggers', {
        keyword: this.config.get('triggers.caseSensitive') ? keyword : keyword.toLowerCase(),
        response,
        guildId: interaction.guild.id,
        createdBy: interaction.user.id,
        createdAt: new Date()
      });

      this.triggers.set(triggerData.keyword.toLowerCase(), triggerData);

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed(
          'Trigger Added',
          `Trigger "${keyword}" has been added successfully.`
        )]
      });

    } catch (error) {
      console.error('Error adding trigger:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to add trigger. Please try again.')],
        ephemeral: true
      });
    }
  }

  async removeTrigger(interaction) {
    try {
      const keyword = interaction.options.getString('keyword').trim();

      const triggerData = await this.db.findOne('triggers', {
        guildId: interaction.guild.id,
        keyword: this.config.get('triggers.caseSensitive') ? keyword : keyword.toLowerCase()
      });

      if (!triggerData) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Trigger Not Found', `No trigger found with keyword "${keyword}".`)],
          ephemeral: true
        });
        return;
      }

      await this.db.deleteOne('triggers', {
        guildId: interaction.guild.id,
        keyword: this.config.get('triggers.caseSensitive') ? keyword : keyword.toLowerCase()
      });

      this.triggers.delete(triggerData.keyword.toLowerCase());

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed(
          'Trigger Removed',
          `Trigger "${keyword}" has been removed successfully.`
        )]
      });

    } catch (error) {
      console.error('Error removing trigger:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to remove trigger. Please try again.')],
        ephemeral: true
      });
    }
  }

  async listTriggers(interaction) {
    try {
      const guildTriggers = Array.from(this.triggers.values())
        .filter(trigger => trigger.guildId === interaction.guild.id);

      if (guildTriggers.length === 0) {
        await interaction.reply({
          embeds: [Helpers.createInfoEmbed('No Triggers', 'No triggers have been set up for this server.')],
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎯 Auto Triggers')
        .setDescription(`Found ${guildTriggers.length} trigger${guildTriggers.length === 1 ? '' : 's'}`)
        .setTimestamp();

      let description = '';
      for (const trigger of guildTriggers) {
        const response = Helpers.truncateString(trigger.response, 50);
        description += `**${trigger.keyword}** → ${response}\n`;
      }

      embed.setDescription(description);

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error listing triggers:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to list triggers. Please try again.')],
        ephemeral: true
      });
    }
  }

  async reloadTriggers() {
    await this.loadTriggers();
  }

  getTriggerCount() {
    return this.triggers.size;
  }

  getGuildTriggers(guildId) {
    return Array.from(this.triggers.values())
      .filter(trigger => trigger.guildId === guildId);
  }
}

module.exports = TriggersModule;
