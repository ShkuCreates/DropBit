const { EmbedBuilder } = require('discord.js');
const Helpers = require('../utils/helpers');

class InvitesModule {
  constructor(client, db, config) {
    this.client = client;
    this.db = db;
    this.config = config;
    this.inviteCache = new Map();
  }

  async initialize() {
    console.log('📦 Invite tracking module initialized');
    await this.cacheInvites();
  }

  async cacheInvites() {
    try {
      const guild = this.client.guilds.cache.get(process.env.GUILD_ID);
      if (!guild) return;

      const invites = await guild.invites.fetch();
      this.inviteCache.clear();

      for (const invite of invites.values()) {
        this.inviteCache.set(invite.code, {
          code: invite.code,
          uses: invite.uses,
          inviter: invite.inviter,
          maxUses: invite.maxUses,
          expires: invite.expiresTimestamp,
          created: invite.createdTimestamp
        });
      }

      console.log(`Cached ${this.inviteCache.size} invites`);
    } catch (error) {
      console.error('Error caching invites:', error);
    }
  }

  async handleMemberJoin(member) {
    if (!this.config.get('invites.enabled')) return null;

    try {
      const guild = member.guild;
      const invites = await guild.invites.fetch();
      
      let inviter = null;
      let inviteCode = null;

      for (const invite of invites.values()) {
        const cached = this.inviteCache.get(invite.code);
        
        if (cached && invite.uses > cached.uses) {
          inviter = invite.inviter;
          inviteCode = invite.code;
          break;
        }
      }

      if (!inviter) {
        const vanityInvite = guild.vanityURLCode;
        if (vanityInvite) {
          inviter = null;
          inviteCode = vanityInvite;
        }
      }

      await this.updateInviteData(inviter, member, inviteCode);
      await this.cacheInvites();

      return inviter;

    } catch (error) {
      console.error('Error handling member join for invite tracking:', error);
      return null;
    }
  }

  async handleMemberLeave(member) {
    if (!this.config.get('invites.enabled')) return;

    try {
      await this.handleFakeInvite(member);
    } catch (error) {
      console.error('Error handling member leave for invite tracking:', error);
    }
  }

  async updateInviteData(inviter, member, inviteCode) {
    if (!inviter) return;

    try {
      let inviteData = await this.db.findOne('invites', {
        inviterId: inviter.id,
        guildId: member.guild.id
      });

      if (!inviteData) {
        inviteData = await this.db.create('invites', {
          inviterId: inviter.id,
          guildId: member.guild.id,
          inviteCount: 1,
          validInvites: 1,
          fakeInvites: 0,
          leaves: 0,
          invitedUsers: [member.id]
        });
      } else {
        inviteData.inviteCount++;
        inviteData.validInvites++;
        inviteData.invitedUsers.push(member.id);

        await this.db.updateById('invites', inviteData._id, {
          inviteCount: inviteData.inviteCount,
          validInvites: inviteData.validInvites,
          invitedUsers: inviteData.invitedUsers
        });

        await this.sendInviteTrackingMessage(member, inviter, inviteData);

        if (this.config.get('invites.rewardInvites')) {
          await this.checkInviteRewards(inviter, member.guild);
        }

      }

    } catch (error) {
      console.error('Error updating invite data:', error);
    }
  }

  async handleFakeInvite(member) {
    try {
      const allInvites = await this.db.find('invites', { guildId: member.guild.id });
      
      for (const inviteData of allInvites) {
        if (inviteData.invitedUsers.includes(member.id)) {
          inviteData.fakeInvites++;
          inviteData.validInvites = Math.max(0, inviteData.validInvites - 1);
          inviteData.leaves++;

          const updatedUsers = inviteData.invitedUsers.filter(id => id !== member.id);

          await this.db.updateById('invites', inviteData._id, {
            fakeInvites: inviteData.fakeInvites,
            validInvites: inviteData.validInvites,
            leaves: inviteData.leaves,
            invitedUsers: updatedUsers
          });

          break;
        }
      }
    } catch (error) {
      console.error('Error handling fake invite:', error);
    }
  }

  async checkInviteRewards(inviter, guild) {
    try {
      const inviteData = await this.db.findOne('invites', {
        inviterId: inviter.id,
        guildId: guild.id
      });

      if (!inviteData) return;

      const rewards = this.config.get('invites.rewards') || {};
      const member = await guild.members.fetch(inviter.id).catch(() => null);

      if (!member) return;

      for (const [requiredInvites, roleId] of Object.entries(rewards)) {
        const reqInvites = parseInt(requiredInvites);
        
        if (inviteData.validInvites >= reqInvites && !member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(() => {});
          
          const logger = require('../utils/logger');
          const Logger = new logger(this.client, this.db, this.config);
          await Logger.log('roleAdd', {
            member,
            role: { id: roleId, name: `Invite Reward (${reqInvites} invites)` },
            executor: this.client.user
          }, guild);
        }
      }

    } catch (error) {
      console.error('Error checking invite rewards:', error);
    }
  }

  async getInviteLeaderboard(guild, limit = 10) {
    try {
      const allInvites = await this.db.find('invites', { guildId: guild.id });
      const sortedInvites = allInvites
        .sort((a, b) => b.validInvites - a.validInvites)
        .slice(0, limit);

      const leaderboard = [];
      for (const inviteData of sortedInvites) {
        try {
          const user = await this.client.users.fetch(inviteData.inviterId);
          leaderboard.push({
            user,
            totalInvites: inviteData.inviteCount,
            validInvites: inviteData.validInvites,
            fakeInvites: inviteData.fakeInvites,
            leaves: inviteData.leaves
          });
        } catch (error) {
          console.error(`Error fetching user ${inviteData.inviterId}:`, error);
        }
      }

      return leaderboard;
    } catch (error) {
      console.error('Error getting invite leaderboard:', error);
      return [];
    }
  }

  createLeaderboardEmbed(guild, limit = 10) {
    return new Promise(async (resolve) => {
      const leaderboard = await this.getInviteLeaderboard(guild, limit);

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle(`🏆 ${guild.name} Invite Leaderboard`)
        .setDescription(`Top ${limit} members by valid invites`)
        .setTimestamp();

      if (leaderboard.length === 0) {
        embed.setDescription('No invite data available yet.');
      } else {
        let description = '';
        for (const entry of leaderboard) {
          const medal = entry.position === 1 ? '🥇' : entry.position === 2 ? '🥈' : entry.position === 3 ? '🥉' : '🎖️';
          description += `${medal} **${entry.user.tag}** - ${entry.validInvites} valid invites (${entry.totalInvites} total)\n`;
        }
        embed.setDescription(description);
      }

      resolve(embed);
    });
  }

  async getUserInviteStats(user, guild) {
    try {
      const inviteData = await this.db.findOne('invites', {
        inviterId: user.id,
        guildId: guild.id
      });

      if (!inviteData) {
        return {
          totalInvites: 0,
          validInvites: 0,
          fakeInvites: 0,
          leaves: 0,
          rank: await this.getUserRank(user, guild)
        };
      }

      const rank = await this.getUserRank(user, guild);

      return {
        totalInvites: inviteData.inviteCount,
        validInvites: inviteData.validInvites,
        fakeInvites: inviteData.fakeInvites,
        leaves: inviteData.leaves,
        rank
      };

    } catch (error) {
      console.error('Error getting user invite stats:', error);
      return null;
    }
  }

  async getUserRank(user, guild) {
    try {
      const allInvites = await this.db.find('invites', { guildId: guild.id });
      const sortedInvites = allInvites.sort((a, b) => b.validInvites - a.validInvites);
      return sortedInvites.findIndex(invite => invite.inviterId === user.id) + 1;
    } catch (error) {
      console.error('Error getting user rank:', error);
      return 0;
    }
  }

  async resetUserInvites(user, guild) {
    try {
      await this.db.deleteOne('invites', {
        inviterId: user.id,
        guildId: guild.id
      });

      const rewards = this.config.get('invites.rewards') || {};
      const member = await guild.members.fetch(user.id).catch(() => null);
      
      if (member) {
        const rolesToRemove = Object.values(rewards);
        if (rolesToRemove.length > 0) {
          await member.roles.remove(rolesToRemove).catch(() => {});
        }
      }

    } catch (error) {
      console.error('Error resetting user invites:', error);
    }
  }

  async sendInviteTrackingMessage(member, inviter, inviteData) {
    try {
      const inviteTrackingChannelId = this.config.get('channels.inviteTracking');
      if (!inviteTrackingChannelId) return;

      const channel = await this.client.channels.fetch(inviteTrackingChannelId);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setColor(0x000000) // Black embed
        .setTitle('🎯 New Invite Tracked')
        .addFields(
          {
            name: '◻️ USER',
            value: member.user.tag,
            inline: false
          },
          {
            name: '◻️ INVITED BY',
            value: inviter.tag,
            inline: false
          },
          {
            name: '◻️ INVITE COUNT',
            value: `${inviteData.validInvites} Valid Invites`,
            inline: false
          }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error sending invite tracking message:', error);
    }
  }

  async getGuildStats(guild) {
    try {
      const allInvites = await this.db.find('invites', { guildId: guild.id });
      
      const totalInvites = allInvites.reduce((sum, invite) => sum + invite.inviteCount, 0);
      const validInvites = allInvites.reduce((sum, invite) => sum + invite.validInvites, 0);
      const fakeInvites = allInvites.reduce((sum, invite) => sum + invite.fakeInvites, 0);
      const totalLeaves = allInvites.reduce((sum, invite) => sum + invite.leaves, 0);

      return {
        totalInvites,
        validInvites,
        fakeInvites,
        totalLeaves,
        totalInviters: allInvites.length
      };

    } catch (error) {
      console.error('Error getting guild stats:', error);
      return null;
    }
  }
}

module.exports = InvitesModule;
