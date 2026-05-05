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
      const currentContent = await this.fetchPageContent(tracker.url);
      
      if (currentContent !== tracker.lastContent) {
        // Change detected
        await this.notifyUser(tracker, currentContent);
        
        // Update tracker
        await this.db.updateById('competitors', tracker._id, {
          lastContent: currentContent,
          lastChecked: new Date()
        });

        console.log(`🔄 Change detected for ${tracker.url} - Notified user ${tracker.userId}`);
      } else {
        // No change, just update check time
        await this.db.updateById('competitors', tracker._id, {
          lastChecked: new Date()
        });
      }

    } catch (error) {
      console.error(`❌ Error checking tracker ${tracker.url}:`, error);
    }
  }

  async notifyUser(tracker, newContent) {
    try {
      const user = await this.client.users.fetch(tracker.userId);
      
      if (!user) {
        console.error(`❌ Could not find user ${tracker.userId}`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x000000)
        .setTitle('🔔 Competitor Update Detected!')
        .setDescription(`Changes detected on the tracked URL`)
        .addFields(
          {
            name: '◻️ URL',
            value: tracker.url,
            inline: false
          },
          {
            name: '◻️ TITLE',
            value: tracker.title,
            inline: false
          },
          {
            name: '◻️ CHANGE TIME',
            value: new Date().toLocaleString(),
            inline: false
          },
          {
            name: '◻️ STATUS',
            value: 'Content has been updated',
            inline: false
          }
        )
        .addFields(
          {
            name: '🔗 VISIT NOW',
            value: `[Check Changes](${tracker.url})`,
            inline: false
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Dropbit Engine • Competitor Tracker' });

      await user.send({ embeds: [embed] });

    } catch (error) {
      console.error(`❌ Error notifying user ${tracker.userId}:`, error);
    }
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
