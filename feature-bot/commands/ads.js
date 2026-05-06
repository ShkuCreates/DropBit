const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

class AdsCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  async execute(interaction) {
    const productUrl = interaction.options.getString('product_url');

    const modal = new ModalBuilder()
      .setCustomId(`ads_modal_${interaction.id}_${encodeURIComponent(productUrl)}`)
      .setTitle('📦 Product Details')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('product_name')
            .setLabel('Product Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Magnetic Phone Holder')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('product_price')
            .setLabel('Selling Price (e.g. $29.99)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. $29.99')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('target_audience')
            .setLabel('Target Audience')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Car owners, 25-45 age, tech lovers')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('key_benefit')
            .setLabel('Key Benefit / Main Problem it Solves')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. Keeps phone secure while driving')
            .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('image_url')
            .setLabel('Product Image URL (optional)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://example.com/image.jpg')
            .setRequired(false)
        )
      );

    await interaction.showModal(modal);
  }

  async handleModalSubmit(interaction) {
    if (!interaction.customId.startsWith('ads_modal_')) return false;

    await interaction.deferReply();

    const parts = interaction.customId.split('_');
    const productUrl = decodeURIComponent(parts[parts.length - 1]);
    const name = interaction.fields.getTextInputValue('product_name');
    const price = interaction.fields.getTextInputValue('product_price');
    const audience = interaction.fields.getTextInputValue('target_audience');
    const benefit = interaction.fields.getTextInputValue('key_benefit');
    const imageUrl = interaction.fields.getTextInputValue('image_url') || null;

    const hooks = [
      `🔥 Stop scrolling! This ${name} is exactly what you've been looking for.`,
      `⚡ I found the most underrated product of ${new Date().getFullYear()} — ${name}`,
      `💡 Tired of ${benefit.toLowerCase().replace('keeps', 'not having')}? This ${name} fixes it.`,
      `🎯 ${audience.split(',')[0]} are obsessed with this ${name} right now.`,
      `🚀 This ${name} went from 0 to viral in 3 days — here's why.` 
    ];

    const script1 = `🎬 **AD SCRIPT 1 — Problem/Solution Format**\n\n` +
      `[HOOK] "${hooks[0]}"\n\n` +
      `[BODY]\nAre you a ${audience}?\n` +
      `Then you NEED to ${name}.\n\n` +
      `It ${benefit} — and it does it better than anything else on the market.\n\n` +
      `For only ${price}, you get:\n` +
      `✅ Premium quality build\n` +
      `✅ Instant results\n` +
      `✅ 30-day money-back guarantee\n\n` +
      `[CTA] "Tap to link below before we run out of stock!"`;

    const script2 = `🎬 **AD SCRIPT 2 — Social Proof Format**\n\n` +
      `[HOOK] "${hooks[3]}"\n\n` +
      `[BODY]\n"I never thought a product could change my life until I tried this ${name}."\n\n` +
      `Thousands of ${audience} are already using it to ${benefit.toLowerCase()}.\n\n` +
      `And right now it's only ${price} — but this price WON'T last.\n\n` +
      `[CTA] "Join 10,000+ happy customers. Order now using the link!"`;

    const embed = new EmbedBuilder()
      .setColor(0x000000)
      .setTitle(`🎯 Ad Scripts & Hooks — ${name}`)
      .setDescription(`> Complete ad content generated for **${name}**. Use these scripts directly on TikTok, Instagram Reels, or Facebook Ads.`)
      .addFields(
        {
          name: '◻️ PRODUCT DETAILS',
          value: `**Name:** ${name}\n**Price:** ${price}\n**Audience:** ${audience}\n**Benefit:** ${benefit}`,
          inline: false
        },
        {
          name: '◻️ HOOKS (5)',
          value: hooks.map((h, i) => `**${i + 1}.** ${h}`).join('\n\n'),
          inline: false
        },
        {
          name: '◻️ AD SCRIPT 1 — Problem/Solution',
          value: script1,
          inline: false
        },
        {
          name: '◻️ AD SCRIPT 2 — Social Proof',
          value: script2,
          inline: false
        },
        {
          name: '◻️ MARKETING ANGLES',
          value: '1. **Scarcity** — "Only 50 units left"\n2. **Social Proof** — "Join 10,000+ customers"\n3. **Problem/Solution** — Lead with pain point\n4. **Authority** — "As seen on TikTok"\n5. **Curiosity** — "The product nobody is talking about"',
          inline: false
        },
        {
          name: '🔗 PRODUCT LINK',
          value: `[View Product](${productUrl})`,
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Dropbit Engine • Ad Script Generator' });

    if (imageUrl) embed.setImage(imageUrl);

    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('ads')
      .setDescription('Generate ad scripts and hooks for a product')
      .addStringOption(option =>
        option.setName('product_url')
          .setDescription('The product URL or image URL')
          .setRequired(true)
      )
      .toJSON();
  }
}

module.exports = AdsCommand;
