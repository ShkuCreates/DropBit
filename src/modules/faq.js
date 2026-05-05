const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class FAQModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.faqKeywords = new Map();
    this.userCooldowns = new Map();
  }

  async initialize() {
    console.log('📦 FAQ module initialized');
    this.loadFAQKeywords();
  }

  loadFAQKeywords() {
    const faqConfig = this.config.get('faq.keywords') || {};
    this.faqKeywords.clear();

    for (const [keyword, answer] of Object.entries(faqConfig)) {
      this.faqKeywords.set(keyword.toLowerCase(), answer);
    }

    console.log(`Loaded ${this.faqKeywords.size} FAQ keywords`);
  }

  async handleMessage(message) {
    if (!this.config.get('faq.enabled')) return;
    
    if (message.author.bot) return;
    if (!message.guild) return;

    const cooldownKey = `${message.author.id}_faq`;
    const now = Date.now();
    const lastResponse = this.userCooldowns.get(cooldownKey) || 0;

    if (now - lastResponse < 30000) return;

    const content = this.config.get('faq.caseSensitive') ? message.content : message.content.toLowerCase();
    
    for (const [keyword, answer] of this.faqKeywords.entries()) {
      const searchKeyword = this.config.get('faq.caseSensitive') ? keyword : keyword.toLowerCase();
      
      if (content.includes(searchKeyword)) {
        await this.respondToFAQ(message, keyword, answer);
        this.userCooldowns.set(cooldownKey, now);
        break;
      }
    }
  }

  async respondToFAQ(message, keyword, answer) {
    try {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('❓ Frequently Asked Question')
        .setDescription(`**Keyword:** ${keyword}`)
        .addFields(
          {
            name: 'Answer',
            value: answer,
            inline: false
          }
        )
        .setFooter({
          text: 'This is an automated response. If you need more help, contact staff.'
        })
        .setTimestamp();

      await message.reply({ embeds: [embed] });

    } catch (error) {
      console.error('Error responding to FAQ:', error);
    }
  }

  async reloadFAQ() {
    this.config.reload();
    this.loadFAQKeywords();
  }

  getFAQCount() {
    return this.faqKeywords.size;
  }

  getAllFAQs() {
    return Array.from(this.faqKeywords.entries()).map(([keyword, answer]) => ({
      keyword,
      answer
    }));
  }

  async searchFAQ(query) {
    const results = [];
    const searchQuery = this.config.get('faq.caseSensitive') ? query : query.toLowerCase();

    for (const [keyword, answer] of this.faqKeywords.entries()) {
      const searchKeyword = this.config.get('faq.caseSensitive') ? keyword : keyword.toLowerCase();
      
      if (searchKeyword.includes(searchQuery) || answer.toLowerCase().includes(searchQuery.toLowerCase())) {
        results.push({ keyword, answer });
      }
    }

    return results;
  }

  createFAQEmbed(title = '📚 FAQ System') {
    const faqs = this.getAllFAQs();
    
    if (faqs.length === 0) {
      return Helpers.createInfoEmbed(title, 'No FAQ entries are currently configured.');
    }

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(title)
      .setDescription(`**${faqs.length}** FAQ entries available`)
      .setTimestamp();

    let description = '';
    for (const faq of faqs.slice(0, 10)) {
      const truncatedAnswer = Helpers.truncateString(faq.answer, 60);
      description += `**${faq.keyword}** → ${truncatedAnswer}\n`;
    }

    if (faqs.length > 10) {
      description += `\n... and ${faqs.length - 10} more`;
    }

    embed.setDescription(description);
    embed.setFooter({ text: 'Type any keyword to get an automated response!' });

    return embed;
  }

  async addFAQKeyword(keyword, answer) {
    this.faqKeywords.set(keyword.toLowerCase(), answer);
    
    const currentKeywords = this.config.get('faq.keywords') || {};
    currentKeywords[keyword] = answer;
    this.config.set('faq.keywords', currentKeywords);
  }

  async removeFAQKeyword(keyword) {
    this.faqKeywords.delete(keyword.toLowerCase());
    
    const currentKeywords = this.config.get('faq.keywords') || {};
    delete currentKeywords[keyword];
    this.config.set('faq.keywords', currentKeywords);
  }

  async updateFAQKeyword(keyword, newAnswer) {
    this.faqKeywords.set(keyword.toLowerCase(), newAnswer);
    
    const currentKeywords = this.config.get('faq.keywords') || {};
    currentKeywords[keyword] = newAnswer;
    this.config.set('faq.keywords', currentKeywords);
  }

  clearCooldowns() {
    this.userCooldowns.clear();
  }

  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - 300000; // 5 minutes
      
      for (const [key, timestamp] of this.userCooldowns.entries()) {
        if (timestamp < cutoff) {
          this.userCooldowns.delete(key);
        }
      }
    }, 60000); // Check every minute
  }
}

module.exports = FAQModule;
