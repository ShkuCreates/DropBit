const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class ModCommandsModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
  }

  async initialize() {
    console.log('📦 Moderation commands module initialized');
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

      await this.client.application.commands.set(commands);
      console.log('✅ Registered moderation slash commands');
    } catch (error) {
      console.error('❌ Failed to register moderation commands:', error);
    }
  }

  async handleSlashCommand(interaction) {
    const command = interaction.commandName;

    if (!Helpers.hasAdminRole(interaction.member, this.config)) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'You need admin permissions to use moderation commands.')],
        ephemeral: true
      });
      return;
    }

    try {
      switch (command) {
        case 'ban':
          await this.handleBan(interaction);
          break;
        case 'kick':
          await this.handleKick(interaction);
          break;
        case 'warn':
          await this.handleWarn(interaction);
          break;
      }
    } catch (error) {
      console.error(`Error handling ${command} command:`, error);
      
      if (!interaction.replied) {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed('Error', 'Failed to execute command. Please try again.')],
          ephemeral: true
        });
      }
    }
  }

  async handleBan(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const days = interaction.options.getInteger('days') || 0;

    if (user.id === interaction.user.id) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'You cannot ban yourself.')],
        ephemeral: true
      });
      return;
    }

    if (user.id === this.client.user.id) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'You cannot ban the bot.')],
        ephemeral: true
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'User not found in server.')],
        ephemeral: true
      });
      return;
    }

    if (!member.bannable) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Cannot ban this user. Check bot permissions.')],
        ephemeral: true
      });
      return;
    }

    try {
      await member.ban({
        reason: `${reason} | Banned by ${interaction.user.tag}`,
        deleteMessageDays: days
      });

      // Log the ban
      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('ban', {
        user,
        executor: interaction.user,
        reason
      }, interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🔨 User Banned')
        .addFields(
          { name: '◻️ USER', value: user.tag, inline: false },
          { name: '◻️ USER ID', value: user.id, inline: false },
          { name: '◻️ EXECUTOR', value: interaction.user.tag, inline: false },
          { name: '◻️ REASON', value: reason, inline: false },
          { name: '◻️ MESSAGES DELETED', value: `${days} days`, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error banning user:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to ban user.')],
        ephemeral: true
      });
    }
  }

  async handleKick(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (user.id === interaction.user.id) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'You cannot kick yourself.')],
        ephemeral: true
      });
      return;
    }

    if (user.id === this.client.user.id) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'You cannot kick the bot.')],
        ephemeral: true
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'User not found in server.')],
        ephemeral: true
      });
      return;
    }

    if (!member.kickable) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Cannot kick this user. Check bot permissions.')],
        ephemeral: true
      });
      return;
    }

    try {
      await member.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      // Log the kick
      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('kick', {
        user,
        executor: interaction.user,
        reason
      }, interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('👢 User Kicked')
        .addFields(
          { name: '◻️ USER', value: user.tag, inline: false },
          { name: '◻️ USER ID', value: user.id, inline: false },
          { name: '◻️ EXECUTOR', value: interaction.user.tag, inline: false },
          { name: '◻️ REASON', value: reason, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error kicking user:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to kick user.')],
        ephemeral: true
      });
    }
  }

  async handleWarn(interaction) {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');

    if (user.id === interaction.user.id) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'You cannot warn yourself.')],
        ephemeral: true
      });
      return;
    }

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'User not found in server.')],
        ephemeral: true
      });
      return;
    }

    try {
      // Get or create user warning data
      let warnData = await this.db.findOne('warnings', {
        userId: user.id,
        guildId: interaction.guild.id
      });

      if (!warnData) {
        warnData = await this.db.create('warnings', {
          userId: user.id,
          guildId: interaction.guild.id,
          warnings: [],
          totalWarns: 0
        });
      }

      // Add new warning
      const newWarning = {
        reason,
        executorId: interaction.user.id,
        executorTag: interaction.user.tag,
        timestamp: new Date(),
        warnNumber: warnData.totalWarns + 1
      };

      warnData.warnings.push(newWarning);
      warnData.totalWarns++;

      await this.db.updateById('warnings', warnData._id, {
        warnings: warnData.warnings,
        totalWarns: warnData.totalWarns
      });

      // Check for auto-punishments
      await this.checkAutoPunishments(member, warnData.totalWarns, interaction);

      // Log the warning
      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('moderationAction', {
        action: 'warn',
        target: user,
        executor: interaction.user,
        reason: `${reason} (Warning #${warnData.totalWarns})`
      }, interaction.guild);

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('⚠️ User Warned')
        .addFields(
          { name: '◻️ USER', value: user.tag, inline: false },
          { name: '◻️ USER ID', value: user.id, inline: false },
          { name: '◻️ EXECUTOR', value: interaction.user.tag, inline: false },
          { name: '◻️ REASON', value: reason, inline: false },
          { name: '◻️ TOTAL WARNINGS', value: `${warnData.totalWarns}/5`, inline: false }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error warning user:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Error', 'Failed to warn user.')],
        ephemeral: true
      });
    }
  }

  async checkAutoPunishments(member, warnCount, interaction) {
    const guild = interaction.guild;

    // Auto-mute after 3 warnings
    if (warnCount === 3) {
      try {
        await member.timeout(15 * 60 * 1000, 'Auto-muted after 3 warnings'); // 15 minutes
        
        const muteEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('🔇 Auto-Mute Applied')
          .addFields(
            { name: '◻️ USER', value: member.user.tag, inline: false },
            { name: '◻️ REASON', value: 'Auto-muted after 3 warnings', inline: false },
            { name: '◻️ DURATION', value: '15 minutes', inline: false }
          )
          .setTimestamp();

        await interaction.channel.send({ embeds: [muteEmbed] });

        // Log auto-mute
        const logger = require('../utils/logger');
        const Logger = new logger(this.client, this.db, this.config);
        await Logger.log('moderationAction', {
          action: 'auto_mute',
          target: member.user,
          executor: this.client.user,
          reason: 'Auto-muted after 3 warnings',
          duration: '15 minutes'
        }, guild);

      } catch (error) {
        console.error('Error applying auto-mute:', error);
      }
    }

    // Auto-kick after 5 warnings
    if (warnCount >= 5) {
      try {
        await member.kick('Auto-kicked after 5 warnings');
        
        const kickEmbed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('👢 Auto-Kick Applied')
          .addFields(
            { name: '◻️ USER', value: member.user.tag, inline: false },
            { name: '◻️ REASON', value: 'Auto-kicked after 5 warnings', inline: false }
          )
          .setTimestamp();

        await interaction.channel.send({ embeds: [kickEmbed] });

        // Log auto-kick
        const logger = require('../utils/logger');
        const Logger = new logger(this.client, this.db, this.config);
        await Logger.log('moderationAction', {
          action: 'auto_kick',
          target: member.user,
          executor: this.client.user,
          reason: 'Auto-kicked after 5 warnings'
        }, guild);

      } catch (error) {
        console.error('Error applying auto-kick:', error);
      }
    }
  }

  async getWarnings(user, guild) {
    try {
      const warnData = await this.db.findOne('warnings', {
        userId: user.id,
        guildId: guild.id
      });

      return warnData || { warnings: [], totalWarns: 0 };
    } catch (error) {
      console.error('Error getting warnings:', error);
      return { warnings: [], totalWarns: 0 };
    }
  }

  async clearWarnings(user, guild) {
    try {
      await this.db.deleteOne('warnings', {
        userId: user.id,
        guildId: guild.id
      });
      return true;
    } catch (error) {
      console.error('Error clearing warnings:', error);
      return false;
    }
  }
}

module.exports = ModCommandsModule;
