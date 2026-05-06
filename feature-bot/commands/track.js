const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const https = require('https');
const http = require('http');

class TrackCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  isEcommerceUrl(url) {
    try {
      const { hostname } = new URL(url);
      const ecommercePatterns = [
        'myshopify.com', 'shopify.com',
        'amazon.', 'ebay.', 'etsy.com',
        'woocommerce', 'bigcommerce', 'wix.com',
        'squarespace.com', 'aliexpress.com'
      ];
      const isShopifyLike = ecommercePatterns.some(p => hostname.includes(p));
      return isShopifyLike || url.includes('/collections') || url.includes('/products');
    } catch {
      return false;
    }
  }

  async fetchProducts(url) {
    try {
      const { hostname, protocol } = new URL(url);
      const jsonUrl = `${protocol}//${hostname}/products.json?limit=250`;
      return new Promise((resolve) => {
        const client = jsonUrl.startsWith('https') ? https : http;
        const req = client.get(jsonUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const ids = (json.products || []).map(p => p.id.toString());
              resolve(ids);
            } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.setTimeout(10000, () => { req.destroy(); resolve([]); });
      });
    } catch { return []; }
  }

  async execute(interaction) {
    const url = interaction.options.getString('url');

    if (!this.isEcommerceUrl(url)) {
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Invalid URL')
          .setDescription('Please provide a valid **Shopify store** or **e-commerce site** URL.\n\n**Examples:**\n• `https://yourcompetitor.myshopify.com`\n• `https://gymshark.com`')
          .setTimestamp()
          .setFooter({ text: 'Dropbit Engine • Competitor Tracker' })],
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      const existing = await this.db.findOne('competitors', { userId: interaction.user.id, url });
      if (existing) {
        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xff6600)
            .setTitle('⚠️ Already Tracking')
            .setDescription(`You are already tracking: **${url}**`)
            .setTimestamp()
            .setFooter({ text: 'Dropbit Engine • Competitor Tracker' })]
        });
        return;
      }

      const initialProducts = await this.fetchProducts(url);
      const { hostname } = new URL(url);

      await this.db.create('competitors', {
        userId: interaction.user.id,
        url,
        title: hostname,
        lastChecked: new Date(),
        lastContent: JSON.stringify(initialProducts),
        productCount: initialProducts.length,
        isActive: true,
        createdAt: new Date()
      });

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🎯 Competitor Tracking Started')
        .setDescription(`Now monitoring **${hostname}** for new product launches!`)
        .addFields(
          { name: '◻️ STORE', value: hostname, inline: false },
          { name: '◻️ PRODUCTS FOUND', value: `${initialProducts.length} products currently listed`, inline: true },
          { name: '◻️ CHECK FREQUENCY', value: 'Every 30 minutes', inline: true },
          { name: '◻️ ALERT TYPE', value: '📩 DM notification on new product launch', inline: false },
          { name: '◻️ STATUS', value: '✅ Active & Monitoring', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Competitor Tracker' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in track command:', error);
      await interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Error')
          .setDescription('Failed to start tracking. Please verify the URL and try again.')
          .setTimestamp()]
      });
    }
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('track')
      .setDescription('Track a competitor Shopify/e-commerce store for new product launches')
      .addStringOption(option =>
        option.setName('url')
          .setDescription('The Shopify or e-commerce store URL to track')
          .setRequired(true)
      )
      .toJSON();
  }
}

module.exports = TrackCommand;
