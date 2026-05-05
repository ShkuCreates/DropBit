const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');

class ProductScheduler {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
    this.channelId = process.env.FEATURE_BOT_CHANNEL_ID || null;
    this.isRunning = false;
  }

  async start() {
    if (!this.channelId) {
      console.log('⚠️ No channel configured for daily products. Set FEATURE_BOT_CHANNEL_ID in .env');
      return;
    }

    // Schedule daily post at 12 AM IST (which is 18:30 UTC the previous day)
    cron.schedule('30 18 * * *', async () => {
      await this.postDailyProduct();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    this.isRunning = true;
    console.log('✅ Product scheduler started - Daily posts at 12 AM IST');
    
    // Post immediately if testing
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => this.postDailyProduct(), 5000);
    }
  }

  async postDailyProduct() {
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) {
        console.error('❌ Could not find product channel');
        return;
      }

      // Get a random winning product
      const product = await this.getWinningProduct();
      
      if (!product) {
        console.log('⚠️ No products available for daily post');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🏆 WINNING PRODUCT OF THE DAY')
        .setDescription(`Today's top-performing product that's crushing it!`)
        .addFields(
          {
            name: '◻️ PRODUCT TITLE',
            value: product.title,
            inline: false
          },
          {
            name: '◻️ WHY IT\'S WINNING',
            value: product.description,
            inline: false
          },
          {
            name: '◻️ HOOK/ANGLE',
            value: product.hook,
            inline: false
          },
          {
            name: '◻️ STRATEGY',
            value: product.angle,
            inline: false
          }
        )
        .addFields(
          {
            name: '🔗 CHECK IT OUT',
            value: `[View Product](${product.url})`,
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Daily Winner' })
        .setThumbnail('https://media.discordapp.net/attachments/1500527370111680522/1500528696375640114/Dropbit_Banner.png?ex=69f8c3bf&is=69f7723f&hm=ba19b88309ebf73030b2e9f58acd0c3bd8f4f3e1668bab4c9be51f39b66c48bc&=&format=webp&quality=lossless&width=1143&height=457');

      await channel.send({ embeds: [embed] });
      
      // Mark as posted
      await this.db.updateById('products', product._id, {
        postedAt: new Date(),
        isDailyWinner: true
      });

      console.log(`✅ Posted daily product: ${product.title}`);

    } catch (error) {
      console.error('❌ Error posting daily product:', error);
    }
  }

  async getWinningProduct() {
    try {
      // Get products that haven't been posted recently
      const allProducts = await this.db.find('products', {});
      const products = allProducts.filter(p => p.isDailyWinner !== true);

      if (products.length === 0) {
        // Reset all products if all have been posted
        await this.resetDailyWinners();
        return await this.getWinningProduct();
      }

      // Select random product
      const randomIndex = Math.floor(Math.random() * products.length);
      return products[randomIndex];

    } catch (error) {
      console.error('Error getting winning product:', error);
      return null;
    }
  }

  async resetDailyWinners() {
    try {
      const products = await this.db.find('products', {});
      
      for (const product of products) {
        await this.db.updateById('products', product._id, {
          isDailyWinner: false,
          postedAt: null
        });
      }

      console.log('✅ Reset all daily winners');

    } catch (error) {
      console.error('Error resetting daily winners:', error);
    }
  }

  async addProduct(title, url, description, hook, angle) {
    try {
      const product = await this.db.create('products', {
        title,
        url,
        description,
        hook,
        angle,
        postedAt: null,
        isDailyWinner: false
      });

      console.log(`✅ Added product: ${title}`);
      return product;

    } catch (error) {
      console.error('Error adding product:', error);
      return null;
    }
  }

  async getProducts() {
    try {
      return await this.db.find('products', {});
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }
}

module.exports = ProductScheduler;
