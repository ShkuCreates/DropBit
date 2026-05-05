const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class TrackCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  async execute(interaction) {
    const url = interaction.options.getString('url');
    
    if (!url) {
      await interaction.reply({
        embeds: [this.createErrorEmbed('Missing URL', 'Please provide a URL to track.')],
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Check if already tracking
      const existing = await this.db.findOne('competitors', {
        userId: interaction.user.id,
        url: url
      });

      if (existing) {
        await interaction.editReply({
          embeds: [this.createErrorEmbed('Already Tracking', 'You are already tracking this URL.')],
          ephemeral: true
        });
        return;
      }

      // Get initial page content
      const initialContent = await this.fetchPageContent(url);
      
      // Create tracking entry
      const trackingData = await this.db.create('competitors', {
        userId: interaction.user.id,
        url: url,
        title: this.extractTitle(url),
        lastChecked: new Date(),
        lastContent: initialContent,
        isActive: true,
        createdAt: new Date()
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🎯 Competitor Tracking Started')
        .setDescription(`Now monitoring: ${url}`)
        .addFields(
          {
            name: '◻️ TRACKING ID',
            value: trackingData._id,
            inline: false
          },
          {
            name: '◻️ STATUS',
            value: '✅ Active',
            inline: false
          },
          {
            name: '◻️ CHECK FREQUENCY',
            value: 'Every 30 minutes',
            inline: false
          },
          {
            name: '◻️ NOTIFICATIONS',
            value: 'You will be DM\'d when changes are detected',
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Competitor Tracker' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in track command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'Failed to start tracking. Please verify the URL.')],
        ephemeral: true
      });
    }
  }

  async fetchPageContent(url) {
    // Simplified content fetching - in production, you'd use a proper web scraper
    try {
      const https = require('https');
      const http = require('http');
      
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data.substring(0, 1000))); // First 1000 chars
        }).on('error', reject);
      });
    } catch (error) {
      console.error('Error fetching page:', error);
      return 'Content not available';
    }
  }

  extractTitle(url) {
    // Simple title extraction from URL
    const domain = new URL(url).hostname;
    const path = new URL(url).pathname;
    return `${domain}${path}`;
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
      .setName('track')
      .setDescription('Track a competitor URL for changes')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('The URL to track')
          .setRequired(true)
      )
      .toJSON();
  }
}

module.exports = TrackCommand;
