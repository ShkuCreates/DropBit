const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class OnboardingModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.activeOnboarding = new Map();
  }

  async initialize() {
    console.log('📦 Onboarding module initialized');
  }

  async startOnboarding(member) {
    if (!this.config.get('onboarding.enabled')) return;

    try {
      const questions = this.config.get('onboarding.questions');
      if (!questions || questions.length === 0) return;

      const onboardingData = {
        userId: member.id,
        guildId: member.guild.id,
        currentQuestion: 0,
        answers: {},
        startedAt: new Date()
      };

      this.activeOnboarding.set(member.id, onboardingData);

      await this.sendQuestion(member, 0);

    } catch (error) {
      console.error('Error starting onboarding:', error);
    }
  }

  async sendQuestion(member, questionIndex) {
    try {
      const questions = this.config.get('onboarding.questions');
      if (questionIndex >= questions.length) {
        await this.completeOnboarding(member);
        return;
      }

      const question = questions[questionIndex];
      const onboardingData = this.activeOnboarding.get(member.id);

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎯 Onboarding')
        .setDescription(question.question)
        .setFooter({
          text: `Question ${questionIndex + 1} of ${questions.length}`
        });

      let components = [];

      if (question.type === 'select') {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`onboarding_select_${member.id}_${questionIndex}`)
          .setPlaceholder('Choose an option...')
          .addOptions(question.options.map(option => ({
            label: option.label,
            value: option.value,
            description: option.description || '',
            emoji: option.emoji
          })));

        components.push(new ActionRowBuilder().addComponents(selectMenu));
      } else if (question.type === 'buttons') {
        const buttons = question.options.map(option => 
          new ButtonBuilder()
            .setCustomId(`onboarding_button_${member.id}_${questionIndex}_${option.value}`)
            .setLabel(option.label)
            .setStyle(ButtonStyle.Primary)
            .setEmoji(option.emoji)
        );

        // Split buttons into rows of 5
        for (let i = 0; i < buttons.length; i += 5) {
          components.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }
      }

      const verificationChannelId = this.config.get('channels.verification');
      const channel = await this.client.channels.fetch(verificationChannelId);
      
      if (onboardingData.messageId) {
        try {
          const oldMessage = await channel.messages.fetch(onboardingData.messageId);
          await oldMessage.edit({ embeds: [embed], components });
        } catch (error) {
          console.error('Error editing onboarding message:', error);
        }
      } else {
        const message = await channel.send({
          content: member.toString(),
          embeds: [embed],
          components
        });
        onboardingData.messageId = message.id;
      }

    } catch (error) {
      console.error('Error sending onboarding question:', error);
    }
  }

  async handleSelectMenu(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('onboarding_select_')) return;

    const parts = customId.split('_');
    const userId = parts[2];
    const questionIndex = parseInt(parts[3]);

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'This onboarding is not for you!')],
        ephemeral: true
      });
      return;
    }

    await this.processAnswer(interaction, userId, questionIndex, interaction.values[0]);
  }

  async handleButton(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('onboarding_button_')) return;

    const parts = customId.split('_');
    const userId = parts[2];
    const questionIndex = parseInt(parts[3]);
    const value = parts[4];

    if (interaction.user.id !== userId) {
      await interaction.reply({
        embeds: [Helpers.createErrorEmbed('Access Denied', 'This onboarding is not for you!')],
        ephemeral: true
      });
      return;
    }

    await this.processAnswer(interaction, userId, questionIndex, value);
  }

  async processAnswer(interaction, userId, questionIndex, answer) {
    try {
      const onboardingData = this.activeOnboarding.get(userId);
      if (!onboardingData) return;

      const questions = this.config.get('onboarding.questions');
      const question = questions[questionIndex];

      onboardingData.answers[question.id] = answer;
      onboardingData.currentQuestion = questionIndex + 1;

      await interaction.deferUpdate();

      if (questionIndex + 1 >= questions.length) {
        await this.completeOnboarding(interaction.member);
      } else {
        await this.sendQuestion(interaction.member, questionIndex + 1);
      }

    } catch (error) {
      console.error('Error processing onboarding answer:', error);
    }
  }

  async completeOnboarding(member) {
    try {
      const onboardingData = this.activeOnboarding.get(member.id);
      if (!onboardingData) return;

      await this.assignRoles(member, onboardingData.answers);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('✅ Onboarding Complete')
        .setDescription('Thank you for completing the onboarding process! You now have access to all server features.')
        .addFields(
          {
            name: 'Roles Assigned',
            value: this.getAssignedRolesText(onboardingData.answers),
            inline: false
          }
        )
        .setTimestamp();

      const verificationChannelId = this.config.get('channels.verification');
      const channel = await this.client.channels.fetch(verificationChannelId);
      
      if (onboardingData.messageId) {
        try {
          const message = await channel.messages.fetch(onboardingData.messageId);
          await message.edit({ embeds: [embed], components: [] });
        } catch (error) {
          console.error('Error editing onboarding completion message:', error);
        }
      }

      this.activeOnboarding.delete(member.id);

      const logger = require('../utils/logger');
      const Logger = new logger(this.client, this.db, this.config);
      await Logger.log('memberJoin', {
        user: member.user,
        member,
        onboarding: true
      }, member.guild);

    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }

  async assignRoles(member, answers) {
    try {
      const onboardingRoles = this.config.get('roles.onboarding') || {};

      for (const [questionId, answer] of Object.entries(answers)) {
        const roleId = onboardingRoles[answer];
        if (roleId) {
          await member.roles.add(roleId).catch(() => {});
        }
      }

    } catch (error) {
      console.error('Error assigning onboarding roles:', error);
    }
  }

  getAssignedRolesText(answers) {
    const onboardingRoles = this.config.get('roles.onboarding') || {};
    const assignedRoles = [];

    for (const [questionId, answer] of Object.entries(answers)) {
      const roleId = onboardingRoles[answer];
      if (roleId) {
        const roleName = answer.charAt(0).toUpperCase() + answer.slice(1);
        assignedRoles.push(`• ${roleName}`);
      }
    }

    return assignedRoles.length > 0 ? assignedRoles.join('\n') : 'No additional roles assigned';
  }

  async skipOnboarding(member) {
    if (!Helpers.hasAdminRole(member, this.config)) {
      throw new Error('You need admin permissions to skip onboarding.');
    }

    try {
      const onboardingData = this.activeOnboarding.get(member.id);
      if (!onboardingData) {
        throw new Error('No active onboarding found for this user.');
      }

      this.activeOnboarding.delete(member.id);

      const verificationChannelId = this.config.get('channels.verification');
      const channel = await this.client.channels.fetch(verificationChannelId);
      
      if (onboardingData.messageId) {
        try {
          const message = await channel.messages.fetch(onboardingData.messageId);
          await message.delete();
        } catch (error) {
          console.error('Error deleting onboarding message:', error);
        }
      }

      return {
        success: true,
        message: `Onboarding skipped for ${member.user.tag}.`
      };

    } catch (error) {
      console.error('Error skipping onboarding:', error);
      throw error;
    }
  }

  async resetOnboarding(member) {
    if (!Helpers.hasAdminRole(member, this.config)) {
      throw new Error('You need admin permissions to reset onboarding.');
    }

    try {
      this.activeOnboarding.delete(member.id);
      await this.startOnboarding(member);

      return {
        success: true,
        message: `Onboarding reset for ${member.user.tag}.`
      };

    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  }

  getActiveOnboardingCount() {
    return this.activeOnboarding.size;
  }

  getOnboardingStatus(userId) {
    return this.activeOnboarding.get(userId);
  }

  async cleanupInactiveOnboarding() {
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes

    for (const [userId, onboardingData] of this.activeOnboarding.entries()) {
      if (now - onboardingData.startedAt.getTime() > timeout) {
        try {
          const guild = this.client.guilds.cache.get(onboardingData.guildId);
          if (guild) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
              await this.skipOnboarding(member);
            }
          }
        } catch (error) {
          console.error('Error cleaning up inactive onboarding:', error);
        }
      }
    }
  }

  startCleanupInterval() {
    setInterval(() => {
      this.cleanupInactiveOnboarding();
    }, 60000); // Check every minute
  }
}

module.exports = OnboardingModule;
