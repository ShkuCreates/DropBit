const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Helpers = require('../utils/helpers');

class StickyModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.stickyMessages = new Map();
    this.channelMessageCount = new Map();
  }

  async initialize() {
    console.log('📦 Sticky messages module initialized');
    await this.loadStickyMessages();
  }

  async loadStickyMessages() {
    try {
      const allStickies = await this.db.find('sticky', { guildId: process.env.GUILD_ID });
      this.stickyMessages.clear();
      
      for (const sticky of allStickies) {
        this.stickyMessages.set(sticky.channelId, sticky);
        this.channelMessageCount.set(sticky.channelId, sticky.messageCount || 0);
      }
      
      console.log(`Loaded ${this.stickyMessages.size} sticky messages`);
    } catch (error) {
      console.error('Error loading sticky messages:', error);
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
          )
      ];

      await this.client.application.commands.set(commands);
      console.log('✅ Registered sticky slash commands');
    } catch (error) {
      console.error('❌ Failed to register sticky commands:', error);
    }
  }

  async handleMessage(message) {
    if (!this.config.get('sticky.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;

    const channelId = message.channel.id;
    const sticky = this.stickyMessages.get(channelId);
    
    if (!sticky) return;

    const currentCount = this.channelMessageCount.get(channelId) || 0;
    this.channelMessageCount.set(channelId, currentCount + 1);

    const maxMessages = this.config.get('sticky.resendAfterMessages');
    
    if (currentCount + 1 >= maxMessages) {
      await this.resendStickyMessage(channelId);
      this.channelMessageCount.set(channelId, 0);
    }
  }

  async resendStickyMessage(channelId) {
    try {
      const sticky = this.stickyMessages.get(channelId);
      if (!sticky) return;

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;

      await this.deleteOldStickyMessage(channelId);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('📌 Sticky Message')
        .setDescription(sticky.message)
        .setFooter({
          text: 'This message will automatically repost to stay visible'
        })
        .setTimestamp();

      const newMessage = await channel.send({ embeds: [embed] });

      await this.db.updateById('sticky', sticky._id, {
        messageId: newMessage.id,
        lastSent: new Date(),
        messageCount: 0
      });

      sticky.messageId = newMessage.id;
      sticky.lastSent = new Date();

    } catch (error) {
      console.error('Error resending sticky message:', error);
    }
  }

  async deleteOldStickyMessage(channelId) {
    try {
      const sticky = this.stickyMessages.get(channelId);
      if (!sticky || !sticky.messageId) return;

      const channel = await this.client.channels.fetch(channelId);
      if (!channel) return;

      const oldMessage = await channel.messages.fetch(sticky.messageId).catch(() => null);
      if (oldMessage) {
        await oldMessage.delete();
      }

    } catch (error) {
      console.error('Error deleting old sticky message:', error);
    }
  }

  async handleSlashCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (!Helpers.hasAdminRole(interaction.member, this.config)) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'You need admin permissions to manage sticky messages.')],
        ephemeral: true
      });
      return;
    }

    try {
      switch (subcommand) {
        case 'set':
          await this.handleSet(interaction);
          break;
        case 'remove':
          await this.handleRemove(interaction);
          break;
        case 'show':
          await this.handleShow(interaction);
          break;
      }
    } catch (error) {
      console.error('Error handling sticky command:', error);
      
      if (!interaction.replied) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Error', 'Failed to execute sticky command.')],
          ephemeral: true
        });
      }
    }
  }

  async handleSet(interaction) {
    try {
      const message = interaction.options.getString('message').trim();
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const channelId = targetChannel.id;

      if (!message) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Invalid Input', 'Message content is required.')],
          ephemeral: true
        });
        return;
      }

      if (message.length > 2000) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Message Too Long', 'Sticky message must be 2000 characters or less.')],
          ephemeral: true
        });
        return;
      }

      const maxPerChannel = this.config.get('sticky.maxPerChannel') || 1;
      const existingSticky = this.stickyMessages.get(channelId);

      if (existingSticky && maxPerChannel <= 1) {
        await this.deleteOldStickyMessage(channelId);
      }

      const stickyData = await this.db.create('sticky', {
        channelId,
        message,
        guildId: interaction.guild.id,
        createdBy: interaction.user.id,
        createdAt: new Date(),
        lastSent: new Date(),
        messageCount: 0
      });

      this.stickyMessages.set(channelId, stickyData);
      this.channelMessageCount.set(channelId, 0);

      await this.resendStickyMessage(channelId);

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed(
          'Sticky Message Set',
          `Sticky message has been set in this channel. It will automatically repost to stay visible.`
        )]
      });

    } catch (error) {
      console.error('Error setting sticky message:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to set sticky message. Please try again.')],
        ephemeral: true
      });
    }
  }

  async handleRemove(interaction) {
    try {
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const channelId = targetChannel.id;
      const sticky = this.stickyMessages.get(channelId);

      if (!sticky) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('No Sticky Message', `There is no sticky message in ${targetChannel}.`)],
          ephemeral: true
        });
        return;
      }

      await this.deleteOldStickyMessage(channelId);

      await this.db.deleteOne('sticky', { channelId });
      this.stickyMessages.delete(channelId);
      this.channelMessageCount.delete(channelId);

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed(
          'Sticky Message Removed',
          `The sticky message has been removed from ${targetChannel}.`
        )]
      });

    } catch (error) {
      console.error('Error removing sticky message:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to remove sticky message. Please try again.')],
        ephemeral: true
      });
    }
  }

  async handleShow(interaction) {
    try {
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
      const channelId = targetChannel.id;
      const sticky = this.stickyMessages.get(channelId);

      if (!sticky) {
        await interaction.reply({
          embeds: [Helpers.createInfoEmbed('No Sticky Message', `There is no sticky message in ${targetChannel}.`)],
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('📌 Current Sticky Message')
        .setDescription(sticky.message)
        .addFields(
          {
            name: '◻️ CHANNEL',
            value: targetChannel.toString(),
            inline: false
          },
          {
            name: '◻️ CREATED BY',
            value: `<@${sticky.createdBy}>`,
            inline: false
          },
          {
            name: '◻️ CREATED AT',
            value: sticky.createdAt.toLocaleDateString(),
            inline: false
          },
          {
            name: 'Messages Until Resend',
            value: `${this.channelMessageCount.get(channelId) || 0}/${this.config.get('sticky.resendAfterMessages')}`,
            inline: true
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('Error showing sticky message:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to show sticky message. Please try again.')],
        ephemeral: true
      });
    }
  }

  async reloadStickyMessages() {
    await this.loadStickyMessages();
  }

  getStickyCount() {
    return this.stickyMessages.size;
  }

  getChannelSticky(channelId) {
    return this.stickyMessages.get(channelId);
  }

  getAllStickies() {
    return Array.from(this.stickyMessages.values());
  }

  clearChannelCount(channelId) {
    this.channelMessageCount.set(channelId, 0);
  }
}

module.exports = StickyModule;
