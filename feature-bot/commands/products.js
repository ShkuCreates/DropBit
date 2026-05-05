const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

class ProductsCommand {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
  }

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const allProducts = await this.db.find('products', {});

      if (!allProducts || allProducts.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(0x000000)
          .setTitle('📦 Product Database')
          .setDescription('No products in the database yet. Ask an admin to add products.')
          .setTimestamp()
          .setFooter({ text: 'Dropbit Engine • Products' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const productList = allProducts
        .slice(0, 10)
        .map((p, i) => `**${i + 1}.** [${p.title}](${p.url})\n◻️ ${p.hook}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('📦 Winning Products Database')
        .setDescription(productList)
        .addFields({
          name: '◻️ TOTAL PRODUCTS',
          value: `${allProducts.length} products in database`,
          inline: false
        })
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Products' });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('Error in products command:', error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Error')
            .setDescription('Failed to fetch products. Please try again.')
            .setTimestamp()
        ]
      });
    }
  }

  getSlashCommand() {
    return new SlashCommandBuilder()
      .setName('products')
      .setDescription('View all winning products in the database')
      .toJSON();
  }
}

module.exports = ProductsCommand;
