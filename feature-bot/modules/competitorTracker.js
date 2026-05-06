const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');

class CompetitorTracker {
  constructor(client) {
    this.client = client;
    this.db = require('../utils/database');
    this.db.connect();
    this.isRunning = false;
  }

  async start() {
    // Check for changes every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.checkAllTrackers();
    });

    this.isRunning = true;
    console.log('✅ Competitor tracker started - Checking every 30 minutes');
  }

  async checkAllTrackers() {
    try {
      const trackers = await this.db.find('competitors', { isActive: true });
      
      for (const tracker of trackers) {
        await this.checkTracker(tracker);
      }

    } catch (error) {
      console.error('❌ Error checking trackers:', error);
    }
  }

  async checkTracker(tracker) {
    try {
      const currentProducts = await this.fetchNewProducts(tracker.url);
      const previousProducts = JSON.parse(tracker.lastContent || '[]');

      const newProducts = currentProducts.filter(id => !previousProducts.includes(id));

      if (newProducts.length > 0) {
        const productDetails = await this.fetchNewProductDetails(tracker.url, newProducts);
        for (const product of productDetails) {
          await this.notifyUser(tracker, product);
        }

        await this.db.updateById('competitors', tracker._id, {
          lastContent: JSON.stringify(currentProducts),
          productCount: currentProducts.length,
          lastChecked: new Date()
        });

        console.log(`� ${newProducts.length} new product(s) found for ${tracker.url}`);
      } else {
        await this.db.updateById('competitors', tracker._id, { lastChecked: new Date() });
      }
    } catch (error) {
      console.error(`❌ Error checking tracker ${tracker.url}:`, error);
    }
  }

  async notifyUser(tracker, product) {
    try {
      const user = await this.client.users.fetch(tracker.userId);
      if (!user) return;

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('� Competitor Launched a New Product!')
        .setDescription(`> Your competitor **${tracker.title}** just listed a brand new product. Be the first to react!`)
        .addFields(
          { name: '◻️ STORE', value: tracker.title, inline: false },
          { name: '◻️ NEW PRODUCT', value: `**${product.title}**`, inline: false },
          { name: '◻️ PRICE', value: `$${product.price}`, inline: true },
          { name: '◻️ VENDOR', value: product.vendor, inline: true },
          { name: '◻️ DETECTED AT', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST', inline: false },
          { name: '🔗 VIEW PRODUCT', value: `[Click Here to View](${product.url})`, inline: false },
          { name: '� QUICK ACTIONS', value: '• Source a similar product from AliExpress\n• Create ad content immediately\n• Launch before they scale', inline: false }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Competitor Tracker' });

      if (product.image) embed.setImage(product.image);

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.error(`❌ Error notifying user ${tracker.userId}:`, error);
    }
  }

  async fetchNewProducts(url) {
    try {
      const { hostname, protocol } = new URL(url);
      const jsonUrl = `${protocol}//${hostname}/products.json?limit=250`;
      const https = require('https');
      const http = require('http');
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
              resolve((json.products || []).map(p => p.id.toString()));
            } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.setTimeout(10000, () => { req.destroy(); resolve([]); });
      });
    } catch { return []; }
  }

  async fetchNewProductDetails(url, newIds) {
    try {
      const { hostname, protocol } = new URL(url);
      const jsonUrl = `${protocol}//${hostname}/products.json?limit=250`;
      const https = require('https');
      const http = require('http');
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
              const newProducts = (json.products || [])
                .filter(p => newIds.includes(p.id.toString()))
                .map(p => ({
                  title: p.title,
                  price: p.variants?.[0]?.price || 'N/A',
                  image: p.images?.[0]?.src || null,
                  url: `${protocol}//${hostname}/products/${p.handle}`,
                  vendor: p.vendor || hostname
                }));
              resolve(newProducts);
            } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.setTimeout(10000, () => { req.destroy(); resolve([]); });
      });
    } catch { return []; }
  }

  async fetchPageContent(url) {
    try {
      const https = require('https');
      const http = require('http');
      
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        const req = client.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data.substring(0, 1000))); // First 1000 chars
        });

        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
    } catch (error) {
      console.error('Error fetching page:', error);
      return 'Content not available';
    }
  }

  async getUserTrackers(userId) {
    try {
      return await this.db.find('competitors', { userId, isActive: true });
    } catch (error) {
      console.error('Error getting user trackers:', error);
      return [];
    }
  }

  async getAllTrackers() {
    try {
      return await this.db.find('competitors', { isActive: true });
    } catch (error) {
      console.error('Error getting all trackers:', error);
      return [];
    }
  }

  async stopTracker(userId, url) {
    try {
      await this.db.updateOne('competitors', { userId, url }, { isActive: false });
      return true;
    } catch (error) {
      console.error('Error stopping tracker:', error);
      return false;
    }
  }

  async getTrackerStats() {
    try {
      const allTrackers = await this.db.find('competitors', {});
      const activeTrackers = allTrackers.filter(t => t.isActive);
      
      return {
        total: allTrackers.length,
        active: activeTrackers.length,
        inactive: allTrackers.length - activeTrackers.length,
        uniqueUsers: [...new Set(allTrackers.map(t => t.userId))].length
      };

    } catch (error) {
      console.error('Error getting tracker stats:', error);
      return { total: 0, active: 0, inactive: 0, uniqueUsers: 0 };
    }
  }
}

module.exports = CompetitorTracker;
