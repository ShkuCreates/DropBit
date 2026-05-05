const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class AdsCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  async execute(interaction) {
    const productUrl = interaction.options.getString('product_url');
    
    if (!productUrl) {
      await interaction.reply({
        embeds: [this.createErrorEmbed('Missing URL', 'Please provide a product URL.')],
        ephemeral: true
      });
      return;
    }

    try {
      await interaction.deferReply();

      // Generate hooks and scripts
      const hooks = this.generateHooks(productUrl);
      const scripts = this.generateAdScripts(productUrl);
      const angles = this.generateAngles(productUrl);

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🎯 Ad Scripts & Hooks Generator')
        .setDescription(`Generated content for: ${productUrl}`)
        .addFields(
          {
            name: '🎣 Hooks (5)',
            value: hooks.map((hook, i) => `${i + 1}. ${hook}`).join('\n'),
            inline: false
          },
          {
            name: '📝 Ad Scripts (2)',
            value: scripts.map((script, i) => `**Script ${i + 1}:**\n${script}`).join('\n\n'),
            inline: false
          },
          {
            name: '🎯 Angles',
            value: angles.map((angle, i) => `${i + 1}. ${angle}`).join('\n'),
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Ad Generator' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in ads command:', error);
      await interaction.editReply({
        embeds: [this.createErrorEmbed('Error', 'Failed to generate ad content. Please try again.')],
        ephemeral: true
      });
    }
  }

  generateHooks(url) {
    const hooks = [
      `This ${this.getProductType(url)} is changing the game...`,
      `Stop scrolling! You need to see this ${this.getProductType(url)} first.`,
      `The secret to ${this.getBenefit()}? It's this ${this.getProductType(url)}.`,
      `99% of people don't know about this ${this.getProductType(url)} yet.`,
      `Your search for the perfect ${this.getProductType(url)} ends here.`
    ];

    return hooks;
  }

  generateAdScripts(url) {
    const scripts = [
      `🔥 **LIMITED TIME OFFER** 🔥\n\nJust discovered this amazing ${this.getProductType(url)} that's absolutely game-changing!\n\n✨ **Why you need this:**\n${this.getBenefits()}\n\n⏰ **Hurry!** This won't last long.\n👉 ${url}\n\n#Trending #MustHave`,
      
      `💯 **HONEST REVIEW** 💯\n\nI've tried countless ${this.getProductType(url)}s, but this one? 🤯\n\n**What makes it different:**\n${this.getUniqueFeatures()}\n\n**My verdict:** ${this.getVerdict()}\n\nCheck it out: ${url}\n\n#Review #GameChanger`
    ];

    return scripts;
  }

  generateAngles(url) {
    const angles = [
      'Scarcity angle - "Only 3 left in stock"',
      'Social proof angle - "Join 10,000+ satisfied customers"',
      'Problem-solution angle - "Tired of [problem]? This solves it instantly"',
      'Authority angle - "Recommended by industry experts"',
      'Curiosity angle - "The one thing you\'re missing in your [category]"'
    ];

    return angles;
  }

  getProductType(url) {
    // Simple URL-based product type detection
    if (url.includes('amazon') || url.includes('shopify')) return 'product';
    if (url.includes('udemy') || url.includes('coursera')) return 'course';
    if (url.includes('youtube') || url.includes('tiktok')) return 'content';
    return 'item';
  }

  getBenefit() {
    const benefits = [
      'saving time and money',
      'achieving your goals faster',
      'looking and feeling your best',
      'staying ahead of the competition',
      'making smarter decisions'
    ];
    
    return benefits[Math.floor(Math.random() * benefits.length)];
  }

  getBenefits() {
    return `• Saves you hours of time\n• Professional quality results\n• Easy to use for beginners\n• 30-day money-back guarantee\n• Join thousands of happy customers`;
  }

  getUniqueFeatures() {
    return `• Revolutionary design\n• Premium materials\n• Patent-pending technology\n• Award-winning customer support\n• Eco-friendly packaging`;
  }

  getVerdict() {
    const verdicts = [
      '10/10 - Absolutely worth it!',
      'This is a game-changer!',
      'Best purchase I made this year!',
      'You won\'t regret this!',
      'Simply outstanding value!'
    ];
    
    return verdicts[Math.floor(Math.random() * verdicts.length)];
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
      .setName('ads')
      .setDescription('Generate ad scripts and hooks for a product')
      .addStringOption(option =>
        option.setName('product_url')
          .setDescription('The product URL to generate content for')
          .setRequired(true)
      )
      .toJSON();
  }
}

module.exports = AdsCommand;
