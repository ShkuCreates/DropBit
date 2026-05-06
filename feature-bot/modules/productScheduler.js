const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const https = require('https');
const http = require('http');

class ProductScheduler {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
    this.channelId = '1500526396961984543';
    this.isRunning = false;

    this.shopifyStores = [
      'gymshark.com',
      'allbirds.com',
      'fashionnova.com',
      'colourpop.com',
      'kyliecosmetics.com',
      'jeffreestarcosmetics.com',
      'cettire.com',
      'hiut-denim.co.uk',
      'tentree.com',
      'mvmtwatches.com',
      'puravidabracelets.com',
      'bombas.com',
      'brooklinen.com',
      'beardbrand.com',
      'meundies.com'
    ];
  }

  async start() {
    cron.schedule('0 0 * * *', async () => {
      await this.findAndPostWinningProduct();
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata'
    });

    this.isRunning = true;
    console.log('✅ Product scheduler started - Daily posts at 12 AM IST');

    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => this.findAndPostWinningProduct(), 5000);
    }
  }

  async fetchJson(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.setTimeout(10000, () => { req.destroy(); resolve(null); });
    });
  }

  async fetchProductsFromStore(store) {
    try {
      const data = await this.fetchJson(`https://${store}/products.json?limit=20`);
      if (!data || !data.products) return [];
      return data.products.map(p => ({
        title: p.title,
        url: `https://${store}/products/${p.handle}`,
        price: p.variants?.[0]?.price || '0',
        image: p.images?.[0]?.src || null,
        store,
        tags: p.tags || [],
        vendor: p.vendor || store
      }));
    } catch {
      return [];
    }
  }

  scoreProduct(product) {
    let score = 0;
    const title = product.title.toLowerCase();
    const winningKeywords = [
      'pro', 'plus', 'elite', 'premium', 'bundle', 'kit',
      'wireless', 'portable', 'smart', 'led', 'magnetic',
      'waterproof', 'rechargeable', 'mini', 'ultra'
    ];
    winningKeywords.forEach(kw => { if (title.includes(kw)) score += 10; });
    const price = parseFloat(product.price);
    if (price >= 20 && price <= 80) score += 30;
    else if (price >= 10 && price <= 120) score += 15;
    if (product.image) score += 20;
    return score;
  }

  async findAndPostWinningProduct() {
    try {
      const channel = await this.client.channels.fetch(this.channelId);
      if (!channel) { console.error('❌ Could not find product channel'); return; }

      console.log('🔍 Searching for winning products...');
      let allProducts = [];

      const shuffled = this.shopifyStores.sort(() => 0.5 - Math.random()).slice(0, 6);
      for (const store of shuffled) {
        const products = await this.fetchProductsFromStore(store);
        allProducts = allProducts.concat(products);
        await new Promise(r => setTimeout(r, 500));
      }

      if (allProducts.length === 0) {
        console.log('⚠️ No products found from stores');
        return;
      }

      const scored = allProducts.map(p => ({ ...p, score: this.scoreProduct(p) }));
      scored.sort((a, b) => b.score - a.score);
      const winner = scored[0];

      const price = parseFloat(winner.price);
      const suggestedSell = (price * 2.5).toFixed(2);
      const profit = (price * 1.5).toFixed(2);

      const hooks = [
        `🔥 This ${winner.title} is going viral right now!`,
        `⚡ Everyone is talking about this ${winner.title}`,
        `💡 The secret product dropshippers don't want you to know about`,
        `🚀 This ${winner.title} is changing the game in ${new Date().getFullYear()}`,
        `💰 High margin potential spotted — don't sleep on this one` 
      ];

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🏆 WINNING PRODUCT OF THE DAY')
        .setDescription('> Our system scanned multiple Shopify stores and found today\'s top-performing product with high dropshipping potential.')
        .addFields(
          { name: '◻️ PRODUCT NAME', value: `**${winner.title}**`, inline: false },
          { name: '◻️ STORE PRICE', value: `$${winner.price}`, inline: true },
          { name: '◻️ SUGGESTED SELL PRICE', value: `$${suggestedSell}`, inline: true },
          { name: '◻️ EST. PROFIT/SALE', value: `$${profit}`, inline: true },
          { name: '◻️ VENDOR', value: winner.vendor, inline: true },
          { name: '◻️ SOURCE STORE', value: winner.store, inline: true },
          { name: '◻️ HOOKS TO USE', value: hooks.map((h, i) => `**${i + 1}.** ${h}`).join('\n'), inline: false },
          { name: '◻️ MARKETING ANGLE', value: '📱 Run UGC-style video ads on TikTok & Instagram Reels\n🎯 Target: 18-35 age group, interests in online shopping\n💬 Use problem-solution format in ad copy', inline: false },
          { name: '🔗 VIEW PRODUCT', value: `[Click Here to View Product](${winner.url})`, inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Winning Product System | Scanned from Shopify Stores' });

      if (winner.image) embed.setImage(winner.image);

      await channel.send({ embeds: [embed] });
      console.log(`✅ Posted winning product: ${winner.title}`);

    } catch (error) {
      console.error('❌ Error finding/posting winning product:', error);
    }
  }
}

module.exports = ProductScheduler;
