const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class UntrackCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  async execute(interaction) {
    const url = interaction.options.getString('url');
    
    if (!url) {
      await interaction.reply({
        embeds: [this.createErrorEmbed('Missing URL', 'Please provide a URL to stop tracking.')],
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Find and remove tracking
      const tracking = await this.db.findOne('competitors', {
        userId: interaction.user.id,
        url: url
      });

      if (!tracking) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Not Found', 'You are not tracking this URL.')],
          ephemeral: true
        });
        return;
      }

      await this.db.deleteOne('competitors', {
        userId: interaction.user.id,
        url: url
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🛑 Competitor Tracking Stopped')
        .setDescription(`No longer monitoring: ${url}`)
        .addFields(
          {
            name: '◻️ STATUS',
            value: '❌ Tracking removed',
            inline: false
          },
          {
            name: '◻️ TRACKED FOR',
            value: `${Math.floor((new Date() - new Date(tracking.createdAt)) / (1000 * 60 * 60 * 24))} days`,
            inline: false
          },
          {
            name: '◻️ NOTIFICATIONS',
            value: 'You will no longer receive updates for this URL',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Competitor Tracker' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in untrack command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'Failed to stop tracking. Please try again.')],
        ephemeral: true
      });
    }
  }

  createErrorEmbed(title, description) {
    return new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`❌ ${title}`)
      .setDescription(description)
      .setTimestamp();
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('untrack')
      .setDescription('Stop tracking a competitor URL')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('The URL to stop tracking')
          .setRequired(true)
      )
      .toJSON();
  }
}

module.exports = UntrackCommand;
