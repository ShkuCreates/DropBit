const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const svgCaptcha = require('svg-captcha');
const Helpers = require('../utils/helpers');

class VerificationModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.activeVerifications = new Map();
  }

  async initialize() {
    console.log('📦 Verification module initialized');
    this.startCleanupInterval();
  }

  async startVerification(member) {
    if (!this.config.get('verification.enabled')) return;

    const verificationChannelId = this.config.get('channels.verification');
    if (!verificationChannelId) return;

    try {
      const verificationChannel = await this.client.channels.fetch(verificationChannelId);
      if (!verificationChannel) return;

      const unverifiedRoleId = this.config.get('roles.unverified');
      const verifiedRoleId = this.config.get('roles.verified');

      if (unverifiedRoleId) {
        await member.roles.add(unverifiedRoleId).catch(() => {});
      }

      const captcha = svgCaptcha.create({
    size: this.config.get('verification.captchaLength'),
    noise: 2,
    color: true,
    background: '#222222'
  }).text.toLowerCase();
      const expiresAt = new Date(Date.now() + (this.config.get('verification.timeoutMinutes') * 60 * 1000));

      await this.db.create('verification', {
        userId: member.id,
        guildId: member.guild.id,
        captcha,
        attempts: 0,
        expiresAt
      });

      const embed = new EmbedBuilder()
        .setColor(this.config.get('verification.embed.color') || 0xffff00)
        .setTitle(this.config.get('verification.embed.title'))
        .setDescription(this.config.get('verification.embed.description')
          .replace('{timeoutMinutes}', this.config.get('verification.timeoutMinutes')))
        .addFields(
          {
            name: 'Instructions',
            value: '1. Click the "Verify" button below\n2. Enter the captcha code shown\n3. Wait for verification to complete',
            inline: false
          },
          {
            name: 'Captcha Code',
            value: `**\`${captcha}\`**`,
            inline: false
          }
        )
        .setFooter({
          text: `You have ${this.config.get('verification.timeoutMinutes')} minutes to verify`
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`verify_${member.id}`)
          .setLabel('Verify')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅')
      );

      const message = await verificationChannel.send({
        content: member.toString(),
        embeds: [embed],
        components: [row]
      });

      this.activeVerifications.set(member.id, {
        messageId: message.id,
        captcha,
        expiresAt,
        attempts: 0
      });

      setTimeout(() => {
        this.cleanupVerification(member.id);
      }, this.config.get('verification.timeoutMinutes') * 60 * 1000);

    } catch (error) {
      console.error('Error starting verification:', error);
    }
  }

  async handleVerification(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('verify_')) return;

    const userId = customId.replace('verify_', '');
    const member = interaction.member;

    if (member.id !== userId) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'This verification is not for you!')],
        ephemeral: true
      });
      return;
    }

    const verificationData = await this.db.findOne('verification', { userId: member.id });
    if (!verificationData) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Verification Expired', 'Please start a new verification.')],
        ephemeral: true
      });
      return;
    }

    if (Date.now() > verificationData.expiresAt.getTime()) {
      await this.db.deleteOne('verification', { userId: member.id });
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Verification Expired', 'Your verification has expired. Please start a new one.')],
        ephemeral: true
      });
      return;
    }

    const modal = new ModalBuilder()
      .setCustomId(`verify_modal_${member.id}`)
      .setTitle('Verification Required')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('captcha_input')
            .setLabel('Enter the captcha code')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter the code shown in the message')
            .setRequired(true)
            .setMaxLength(10)
        )
      );

    await interaction.showModal(modal);
  }

  async handleVerificationSubmit(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('verify_modal_')) return;

    const userId = customId.replace('verify_modal_', '');
    const member = interaction.member;

    if (member.id !== userId) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'This verification is not for you!')],
        ephemeral: true
      });
      return;
    }

    const verificationData = await this.db.findOne('verification', { userId: member.id });
    if (!verificationData) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Verification Not Found', 'Please start a new verification.')],
        ephemeral: true
      });
      return;
    }

    const userInput = interaction.fields.getTextInputValue('captcha_input').trim();
    const maxAttempts = this.config.get('verification.attempts');

    verificationData.attempts++;

    if (userInput === verificationData.captcha) {
      await this.completeVerification(member, interaction);
    } else {
      if (verificationData.attempts >= maxAttempts) {
        await this.failVerification(member, interaction, 'Maximum attempts reached');
      } else {
        await interaction.reply({
          embeds: [Helpers.createErrorEmbed(
            'Incorrect Code',
            `The captcha code is incorrect. You have ${maxAttempts - verificationData.attempts} attempts remaining.`
          )],
          ephemeral: true
        });

        await this.db.updateById('verification', verificationData._id, {
          attempts: verificationData.attempts
        });
      }
    }
  }

  async completeVerification(member, interaction) {
    try {
      await this.db.deleteOne('verification', { userId: member.id });

      const unverifiedRoleId = this.config.get('roles.unverified');
      const verifiedRoleId = this.config.get('roles.verified');

      if (unverifiedRoleId) {
        await member.roles.remove(unverifiedRoleId).catch(() => {});
      }

      if (verifiedRoleId) {
        await member.roles.add(verifiedRoleId).catch(() => {});
      }

      await interaction.reply({
        embeds: [Helpers.createSuccessEmbed(
          'Verification Successful',
          this.config.get('verification.successMessage')
        )],
        ephemeral: true
      });

      const activeVerification = this.activeVerifications.get(member.id);
      if (activeVerification) {
        try {
          const verificationChannelId = this.config.get('channels.verification');
          const verificationChannel = await this.client.channels.fetch(verificationChannelId);
          if (verificationChannel) {
            const message = await verificationChannel.messages.fetch(activeVerification.messageId);
            await message.delete();
          }
        } catch (error) {
          console.error('Error deleting verification message:', error);
        }
        this.activeVerifications.delete(member.id);
      }

      const onboardingModule = require('./onboarding');
      const OnboardingModule = new onboardingModule(this.client, this.db, this.config);
      await OnboardingModule.startOnboarding(member);

      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('verificationSuccess', {
        user: member.user,
        timeTaken: Date.now() - (activeVerification?.expiresAt?.getTime() - (this.config.get('verification.timeoutMinutes') * 60 * 1000))
      }, member.guild);

    } catch (error) {
      console.error('Error completing verification:', error);
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Verification Error', 'An error occurred during verification. Please contact an admin.')],
        ephemeral: true
      });
    }
  }

  async failVerification(member, interaction, reason) {
    try {
      await this.db.deleteOne('verification', { userId: member.id });

      await interaction.reply({
        embeds: [Helpers.createErrorEmbed(
          'Verification Failed',
          this.config.get('verification.failureMessage')
        )],
        ephemeral: true
      });

      const activeVerification = this.activeVerifications.get(member.id);
      if (activeVerification) {
        try {
          const verificationChannelId = this.config.get('channels.verification');
          const verificationChannel = await this.client.channels.fetch(verificationChannelId);
          if (verificationChannel) {
            const message = await verificationChannel.messages.fetch(activeVerification.messageId);
            await message.delete();
          }
        } catch (error) {
          console.error('Error deleting verification message:', error);
        }
        this.activeVerifications.delete(member.id);
      }

      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('verificationFail', {
        user: member.user,
        attempts: activeVerification?.attempts || 0,
        reason
      }, member.guild);

      setTimeout(async () => {
        try {
          await member.kick('Verification failed - maximum attempts reached');
        } catch (error) {
          console.error('Error kicking member after verification failure:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('Error failing verification:', error);
    }
  }

  async cleanupVerification(userId) {
    const verificationData = this.activeVerifications.get(userId);
    if (!verificationData) return;

    if (Date.now() > verificationData.expiresAt.getTime()) {
      try {
        const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
        if (guild) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            await this.failVerification(member, null, 'Verification timeout');
          }
        }
      } catch (error) {
        console.error('Error cleaning up verification:', error);
      }
    }
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [userId, verification] of this.activeVerifications.entries()) {
        if (now > verification.expiresAt.getTime()) {
          this.cleanupVerification(userId);
        }
      }
    }, 60000);
  }
}

module.exports = VerificationModule;
