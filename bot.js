const { Client } = require('discord.js-selfbot-v13');
const prompt = require('prompt-sync')({ sigint: true });
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const CONFIG = {
  RANDOM_EMOJIS: [
    '<a:Z23:1298856059817168996>',
    '<a:Z24:1298856081388343308>',
    '<a:Z25:1298856104411005010>',
    '<a:Z26:1298856124736606229>'
  ],
  JOIN_CHANCE: 0.95,
  MULTI_EMOJI_CHANCE: 0.25,
  TARGET_CHANNEL_ID: '1213975152145072128',
  OG_CHANNEL_ID: '1500617731496480939',
  HAS_OG_ROLE: true,
  OG_ONLY_MODE: true,
  AUTO_TYPE_MESSAGES: ['ty'],
  
  AUTO_TYPE_OG_CHANCE: 1,
  AUTO_TYPE_OG_DELAY_MIN: 2000,
  AUTO_TYPE_OG_DELAY_MAX: 15000,
  AUTO_TYPE_OG_COOLDOWN_MIN: 180000,
  AUTO_TYPE_OG_COOLDOWN_MAX: 420000,
  
  AUTO_TYPE_MAIN_CHANCE: 0.9,
  AUTO_TYPE_MAIN_DELAY_MIN: 3000,
  AUTO_TYPE_MAIN_DELAY_MAX: 15000,
  AUTO_TYPE_MAIN_COOLDOWN_MIN: 480000,
  AUTO_TYPE_MAIN_COOLDOWN_MAX: 780000,
  
  REACTION_DELAY_MIN: 3000,
  REACTION_DELAY_MAX: 6700,
  IGNORE_BOTS: true,
  TARGET_USER_ID: '1344240724526235759',
  TRIGGER_TEXT: 'Enter by reacting to the message!',
  
  // Max gem amount to join in general/main channel (OG channel has no limit)
  MAIN_CHANNEL_MAX_AMOUNT: 100000000,
};

const DATA_DIR = path.join(__dirname, 'Data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

const UI_STATE = {
  ShowConfig: false,
  ShowEarnings: true,
  ShowGlobalWinLog: true,
  ShowControls: true,
  SelectedAccountIndex: 0,
  GlobalWinLog: [],
};

const Accounts = [];

const Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RandomDelay = () => {
  const min = CONFIG.REACTION_DELAY_MIN;
  const max = CONFIG.REACTION_DELAY_MAX;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const GetRandomEmoji = () => {
  return CONFIG.RANDOM_EMOJIS[Math.floor(Math.random() * CONFIG.RANDOM_EMOJIS.length)];
};

const GetRandomEmojis = () => {
  if (Math.random() < CONFIG.MULTI_EMOJI_CHANCE) {
    const count = Math.random() < 0.5 ? 2 : 3;
    const emojis = [];
    const used = new Set();
    
    while (emojis.length < count) {
      const emoji = GetRandomEmoji();
      if (!used.has(emoji)) {
        emojis.push(emoji);
        used.add(emoji);
      }
    }
    return emojis;
  }
  
  return [GetRandomEmoji()];
};

const ShouldJoinGiveaway = () => {
  return Math.random() < CONFIG.JOIN_CHANCE;
};

const GetRandomMessage = () => {
  return CONFIG.AUTO_TYPE_MESSAGES[Math.floor(Math.random() * CONFIG.AUTO_TYPE_MESSAGES.length)];
};

const GetRandomCooldown = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const CanAutoType = (account, channelType) => {
  if (channelType === 'OG') {
    const timeSinceLastType = Date.now() - account.stats.LastAutoTypeTimeOG;
    return timeSinceLastType >= account.stats.NextOGCooldown;
  } else {
    const timeSinceLastType = Date.now() - account.stats.LastAutoTypeTimeMain;
    return timeSinceLastType >= account.stats.NextMainCooldown;
  }
};

const ClearConsole = () => {
  process.stdout.write('\x1Bc');
  console.clear();
};

const Ask = (query) => prompt(query);
const AskHidden = (query) => prompt(query, { echo: '*' });

const FormatTime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours.toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
};

const FormatNumber = (number) => {
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const FormatShortNumber = (number) => {
  if (number >= 1e9) return `${(number / 1e9).toFixed(2)}b`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(2)}m`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(2)}k`;
  return number.toString();
};

const PrintBanner = () => {
  console.log(`${COLORS.red}${COLORS.bright}╔═══════════════════════════════════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.red}${COLORS.bright}║${COLORS.reset}                    ${COLORS.bright}EXP Multi-Account Bot${COLORS.reset}                         ${COLORS.red}${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.red}${COLORS.bright}║${COLORS.reset}                                ${COLORS.red}by kinja${COLORS.reset}                           ${COLORS.red}${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.red}${COLORS.bright}║${COLORS.reset}                                                                   ${COLORS.red}${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.red}${COLORS.bright}║${COLORS.reset}                     ${COLORS.yellow}send kinja 10% of profits 🤑${COLORS.reset}                  ${COLORS.red}${COLORS.bright}║${COLORS.reset}`);
  console.log(`${COLORS.red}${COLORS.bright}╚═══════════════════════════════════════════════════════════════════╝${COLORS.reset}\n`);
};

const DisplayUI = () => {
  ClearConsole();
  PrintBanner();

  if (Accounts.length === 0) {
    console.log(`  ${COLORS.yellow}No accounts added yet. Press 'A' to add an account.${COLORS.reset}\n`);
    console.log(`  ${COLORS.dim}A: add account | CTRL+C: exit${COLORS.reset}`);
    return;
  }

  console.log(`  ${COLORS.bright}${COLORS.blue}------ ACCOUNTS (${Accounts.length}) ------${COLORS.reset}\n`);
  Accounts.forEach((acc, idx) => {
    const isSelected = idx === UI_STATE.SelectedAccountIndex;
    const arrow = isSelected ? `${COLORS.yellow}→${COLORS.reset}` : ' ';
    const statusCircle = acc.stats.IsRunning ? `${COLORS.green}●${COLORS.reset}` : `${COLORS.red}●${COLORS.reset}`;
    const username = acc.client.user ? acc.client.user.tag : 'Connecting...';
    const elapsed = Date.now() - acc.stats.StartTime;
    
    console.log(`  ${arrow} ${statusCircle} ${COLORS.bright}${username}${COLORS.reset} ${COLORS.dim}(${FormatTime(elapsed)})${COLORS.reset}`);
    console.log(`     ${COLORS.gray}Entries:${COLORS.reset} ${COLORS.yellow}${FormatNumber(acc.stats.SessionReactions)}${COLORS.reset} | ${COLORS.gray}Wins:${COLORS.reset} ${COLORS.green}${acc.stats.SessionWins}${COLORS.reset} | ${COLORS.gray}OG:${COLORS.reset} ${COLORS.magenta}${FormatShortNumber(acc.stats.SessionEarningsOG)}${COLORS.reset} | ${COLORS.gray}Gen:${COLORS.reset} ${COLORS.cyan}${FormatShortNumber(acc.stats.SessionEarningsMain)}${COLORS.reset}`);
  });
  console.log();

  const account = Accounts[UI_STATE.SelectedAccountIndex];
  const elapsed = Date.now() - account.stats.StartTime;
  const reactionRate = account.stats.SessionReactions > 0 ? (account.stats.SessionReactions / (elapsed / 3.6e6)).toFixed(1) : '0';

  console.log(`  ${COLORS.bright}${COLORS.cyan}------ SELECTED ACCOUNT ------${COLORS.reset}\n`);

  const statusCircle = account.stats.IsRunning ? `${COLORS.green}●${COLORS.reset}` : `${COLORS.red}●${COLORS.reset}`;
  const username = account.client.user ? `${statusCircle} ${COLORS.bright}${account.client.user.tag}${COLORS.reset}` : 'Loading...';
  
  const timeSinceLastTypeOG = Date.now() - account.stats.LastAutoTypeTimeOG;
  const timeUntilNextTypeOG = Math.max(0, account.stats.NextOGCooldown - timeSinceLastTypeOG);
  const autoTypeStatusOG = timeUntilNextTypeOG > 0 
    ? `${COLORS.yellow}${FormatTime(timeUntilNextTypeOG)}${COLORS.reset}` 
    : `${COLORS.green}✓ Ready${COLORS.reset}`;
  
  const timeSinceLastTypeMain = Date.now() - account.stats.LastAutoTypeTimeMain;
  const timeUntilNextTypeMain = Math.max(0, account.stats.NextMainCooldown - timeSinceLastTypeMain);
  const autoTypeStatusMain = timeUntilNextTypeMain > 0 
    ? `${COLORS.yellow}${FormatTime(timeUntilNextTypeMain)}${COLORS.reset}` 
    : `${COLORS.green}✓ Ready${COLORS.reset}`;
  
  console.log(`  ${COLORS.gray}┌─ User${COLORS.reset}           ${username}`);
  console.log(`  ${COLORS.gray}├─ Runtime${COLORS.reset}        ${COLORS.bright}${FormatTime(elapsed)}${COLORS.reset}`);
  console.log(`  ${COLORS.gray}├─ Mode${COLORS.reset}           ${CONFIG.OG_ONLY_MODE ? `${COLORS.magenta}OG Only${COLORS.reset}` : `${COLORS.cyan}All Channels${COLORS.reset}`}`);
  console.log(`  ${COLORS.gray}├─ Auto-Types${COLORS.reset}     ${COLORS.bright}${account.stats.AutoTypeCount}${COLORS.reset}`);
  console.log(`  ${COLORS.gray}│  ├─ OG${COLORS.reset}          ${autoTypeStatusOG}`);
  if (!CONFIG.OG_ONLY_MODE) {
    console.log(`  ${COLORS.gray}│  └─ Gen${COLORS.reset}         ${autoTypeStatusMain}`);
  } else {
    console.log(`  ${COLORS.gray}│  └─ Gen${COLORS.reset}         ${COLORS.dim}Disabled${COLORS.reset}`);
  }
  console.log(`  ${COLORS.gray}├─ Entries${COLORS.reset}        ${COLORS.bright}${COLORS.yellow}${FormatNumber(account.stats.SessionReactions)}${COLORS.reset} ${COLORS.dim}(${reactionRate}/hr)${COLORS.reset}`);
  console.log(`  ${COLORS.gray}└─ All Entries${COLORS.reset}    ${COLORS.bright}${COLORS.green}${FormatNumber(account.stats.TotalReactions)}${COLORS.reset}\n`);

  if (account.stats.LastReaction) {
    console.log(`  ${COLORS.gray}Last Entry:${COLORS.reset} ${account.stats.LastReaction} ${COLORS.dim}${account.stats.LastReactionTime}${COLORS.reset}\n`);
  }

  if (UI_STATE.ShowEarnings) {
    console.log(`  ${COLORS.bright}${COLORS.blue}------ EARNINGS ------${COLORS.reset}\n`);
    console.log(`  ${COLORS.gray}Session:${COLORS.reset}`);
    console.log(`    ${COLORS.magenta}OG:${COLORS.reset}            ${COLORS.bright}${FormatShortNumber(account.stats.SessionEarningsOG)}${COLORS.reset} ${COLORS.dim}(${account.stats.SessionWinsOG} wins)${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Gen:${COLORS.reset}           ${COLORS.bright}${FormatShortNumber(account.stats.SessionEarningsMain)}${COLORS.reset} ${COLORS.dim}(${account.stats.SessionWinsMain} wins)${COLORS.reset}`);
    console.log(`    ${COLORS.green}Total:${COLORS.reset}         ${COLORS.bright}${FormatShortNumber(account.stats.SessionEarningsOG + account.stats.SessionEarningsMain)}${COLORS.reset} ${COLORS.dim}(${account.stats.SessionWins} wins)${COLORS.reset}`);
    console.log();
    console.log(`  ${COLORS.gray}All Time:${COLORS.reset}`);
    console.log(`    ${COLORS.magenta}OG:${COLORS.reset}            ${COLORS.bright}${FormatShortNumber(account.stats.TotalEarningsOG)}${COLORS.reset} ${COLORS.dim}(${account.stats.TotalWinsOG} wins)${COLORS.reset}`);
    console.log(`    ${COLORS.cyan}Gen:${COLORS.reset}           ${COLORS.bright}${FormatShortNumber(account.stats.TotalEarningsMain)}${COLORS.reset} ${COLORS.dim}(${account.stats.TotalWinsMain} wins)${COLORS.reset}`);
    console.log(`    ${COLORS.green}Total:${COLORS.reset}         ${COLORS.bright}${FormatShortNumber(account.stats.TotalEarningsOG + account.stats.TotalEarningsMain)}${COLORS.reset} ${COLORS.dim}(${account.stats.TotalWins} wins)${COLORS.reset}\n`);
  }
  
  if (UI_STATE.ShowGlobalWinLog && UI_STATE.GlobalWinLog.length > 0) {
    console.log(`  ${COLORS.bright}${COLORS.blue}------ ALL ACCOUNTS WIN LOG ------${COLORS.reset}\n`);
    UI_STATE.GlobalWinLog.slice(-15).forEach(win => {
      const channelTag = win.channel === 'OG' ? `${COLORS.magenta}[OG]${COLORS.reset}` : `${COLORS.cyan}[GEN]${COLORS.reset}`;
      const accountTag = `${COLORS.blue}[${win.accountName}]${COLORS.reset}`;
      console.log(`  ${accountTag} ${channelTag} ${COLORS.green}${win.username}${COLORS.reset} ${COLORS.bright}+${FormatShortNumber(win.amount)}${COLORS.reset} ${COLORS.dim}${win.time}${COLORS.reset}`);
    });
    console.log();
  }
  
  if (UI_STATE.ShowConfig) {
    console.log(`  ${COLORS.bright}${COLORS.blue}------ CONFIG ------${COLORS.reset}\n`);
    console.log(`  ${COLORS.gray}Mode:${COLORS.reset}             ${CONFIG.OG_ONLY_MODE ? `${COLORS.magenta}OG Only${COLORS.reset}` : `${COLORS.cyan}All Channels${COLORS.reset}`}`);
    console.log(`  ${COLORS.gray}Join Rate:${COLORS.reset}        ${COLORS.bright}${(CONFIG.JOIN_CHANCE * 100).toFixed(0)}%${COLORS.reset}`);
    console.log(`  ${COLORS.gray}OG Access:${COLORS.reset}        ${CONFIG.HAS_OG_ROLE ? `${COLORS.green}Yes${COLORS.reset}` : `${COLORS.red}No${COLORS.reset}`}`);
    console.log(`  ${COLORS.gray}Multi-Emoji:${COLORS.reset}      ${COLORS.bright}${(CONFIG.MULTI_EMOJI_CHANCE * 100).toFixed(0)}%${COLORS.reset}`);
    console.log(`  ${COLORS.gray}Reaction Delay:${COLORS.reset}   ${COLORS.bright}${CONFIG.REACTION_DELAY_MIN}-${CONFIG.REACTION_DELAY_MAX}ms${COLORS.reset}`);
    console.log(`  ${COLORS.gray}OG Auto-Type:${COLORS.reset}     ${COLORS.bright}${(CONFIG.AUTO_TYPE_OG_CHANCE * 100).toFixed(0)}%${COLORS.reset} ${COLORS.dim}(${(CONFIG.AUTO_TYPE_OG_COOLDOWN_MIN/60000).toFixed(1)}-${(CONFIG.AUTO_TYPE_OG_COOLDOWN_MAX/60000).toFixed(1)}min cooldown)${COLORS.reset}`);
    if (!CONFIG.OG_ONLY_MODE) {
      console.log(`  ${COLORS.gray}Main Auto-Type:${COLORS.reset}   ${COLORS.bright}${(CONFIG.AUTO_TYPE_MAIN_CHANCE * 100).toFixed(0)}%${COLORS.reset} ${COLORS.dim}(${(CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MIN/60000).toFixed(1)}-${(CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MAX/60000).toFixed(1)}min cooldown)${COLORS.reset}`);
      console.log(`  ${COLORS.gray}Gen Max Amount:${COLORS.reset}   ${COLORS.bright}${FormatShortNumber(CONFIG.MAIN_CHANNEL_MAX_AMOUNT)}${COLORS.reset}`);
    }
    console.log();
  }
  
  if (UI_STATE.ShowControls) {
    console.log(`  ${COLORS.dim}SPACE: pause/resume | ↑↓: switch | A: add | D: delete | C: config | E: earnings | W: wins | H: help${COLORS.reset}`);
  } else {
    console.log(`  ${COLORS.dim}Press H to show controls${COLORS.reset}`);
  }
};

const LoadAccounts = () => {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      return data.accounts || [];
    }
  } catch {}
  return [];
};

const SaveAccounts = () => {
  try {
    const data = {
      accounts: Accounts.map(acc => ({
        token: acc.token,
        nickname: acc.nickname,
        stats: {
          TotalReactions: acc.stats.TotalReactions + acc.stats.SessionReactions,
          TotalEarningsOG: acc.stats.TotalEarningsOG + acc.stats.SessionEarningsOG,
          TotalEarningsMain: acc.stats.TotalEarningsMain + acc.stats.SessionEarningsMain,
          TotalWinsOG: acc.stats.TotalWinsOG + acc.stats.SessionWinsOG,
          TotalWinsMain: acc.stats.TotalWinsMain + acc.stats.SessionWinsMain,
          TotalWins: acc.stats.TotalWins + acc.stats.SessionWins,
          TotalGiveawaysJoined: acc.stats.TotalGiveawaysJoined + acc.stats.SessionGiveawaysJoined,
        }
      }))
    };
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save accounts:', err);
  }
};

const CreateAccountStats = (savedStats = {}) => {
  return {
    TotalReactions: savedStats.TotalReactions || 0,
    SessionReactions: 0,
    StartTime: Date.now(),
    IsRunning: true,
    SessionEarningsOG: 0,
    SessionEarningsMain: 0,
    TotalEarningsOG: savedStats.TotalEarningsOG || 0,
    TotalEarningsMain: savedStats.TotalEarningsMain || 0,
    SessionWinsOG: 0,
    SessionWinsMain: 0,
    SessionWins: 0,
    TotalWinsOG: savedStats.TotalWinsOG || 0,
    TotalWinsMain: savedStats.TotalWinsMain || 0,
    TotalWins: savedStats.TotalWins || 0,
    LastReaction: null,
    LastReactionTime: null,
    EnteredGiveaways: new Set(),
    SessionGiveawaysJoined: 0,
    TotalGiveawaysJoined: savedStats.TotalGiveawaysJoined || 0,
    AutoTypeCount: 0,
    LastAutoTypeTimeOG: 0,
    LastAutoTypeTimeMain: 0,
    NextOGCooldown: GetRandomCooldown(CONFIG.AUTO_TYPE_OG_COOLDOWN_MIN, CONFIG.AUTO_TYPE_OG_COOLDOWN_MAX),
    NextMainCooldown: GetRandomCooldown(CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MIN, CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MAX),
  };
};

const SetupMessageHandler = (account) => {
  account.client.on('messageCreate', async (message) => {
    if (message.author.id === account.client.user.id) {
      if (message.channel.id === CONFIG.OG_CHANNEL_ID) {
        account.stats.LastAutoTypeTimeOG = Date.now();
        account.stats.NextOGCooldown = GetRandomCooldown(CONFIG.AUTO_TYPE_OG_COOLDOWN_MIN, CONFIG.AUTO_TYPE_OG_COOLDOWN_MAX);
      } else if (message.channel.id === CONFIG.TARGET_CHANNEL_ID) {
        account.stats.LastAutoTypeTimeMain = Date.now();
        account.stats.NextMainCooldown = GetRandomCooldown(CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MIN, CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MAX);
      }
    }
    
    if (message.author.id === CONFIG.TARGET_USER_ID) {
      let fullText = message.content;
      if (message.embeds && message.embeds.length > 0) {
        const embedTexts = message.embeds.map(e => `${e.title || ''} ${e.description || ''}`).join(' ');
        fullText += ' ' + embedTexts;
      }
      
      const yourUsername = account.client.user.username.toLowerCase();
      const winPattern = new RegExp(`${yourUsername}[^\\n]*\\+(\\d{1,3}(?:,\\d{3})*)`, 'i');
      const match = fullText.match(winPattern);
      
      if (match) {
        const amount = parseInt(match[1].replace(/,/g, ''), 10);
        
        const isOGWin = message.channel.id === CONFIG.OG_CHANNEL_ID;
        const channelName = isOGWin ? 'OG' : 'MAIN';
        
        if (isOGWin) {
          account.stats.SessionEarningsOG += amount;
          account.stats.SessionWinsOG++;
        } else {
          account.stats.SessionEarningsMain += amount;
          account.stats.SessionWinsMain++;
        }
        
        account.stats.SessionWins++;
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        
        const winEntry = {
          username: account.client.user.username,
          accountName: account.nickname || account.client.user.username,
          amount: amount,
          time: timeString,
          channel: channelName
        };
        
        UI_STATE.GlobalWinLog.push(winEntry);
        
        SaveAccounts();
        DisplayUI();
      }
    }
    
    if (!account.stats.IsRunning) return;
    if (message.author.id === account.client.user.id) return;
    
    if (CONFIG.TARGET_USER_ID && message.author.id !== CONFIG.TARGET_USER_ID) return;
    
    if (CONFIG.TRIGGER_TEXT) {
      let textToCheck = message.content;
      
      if (message.embeds && message.embeds.length > 0) {
        const embedTexts = message.embeds.map(e => `${e.title || ''} ${e.description || ''}`).join(' ');
        textToCheck += ' ' + embedTexts;
      }
      
      const cleanContent = textToCheck.replace(/\*\*/g, '').replace(/\*/g, '').trim();
      if (!cleanContent.includes(CONFIG.TRIGGER_TEXT)) return;
    }
    
    const isMainChannel = message.channel.id === CONFIG.TARGET_CHANNEL_ID;
    const isOGChannel = CONFIG.HAS_OG_ROLE && message.channel.id === CONFIG.OG_CHANNEL_ID;
    
    if (CONFIG.OG_ONLY_MODE) {
      if (!isOGChannel) return;
    } else {
      if (!isMainChannel && !isOGChannel) return;
    }

    // In all-channels mode, skip main channel giveaways over MAIN_CHANNEL_MAX_AMOUNT
    // OG channel giveaways are always joined regardless of amount
    if (!CONFIG.OG_ONLY_MODE && isMainChannel && !isOGChannel) {
      let fullTextForAmount = message.content;
      if (message.embeds && message.embeds.length > 0) {
        const embedTexts = message.embeds.map(e => `${e.title || ''} ${e.description || ''}`).join(' ');
        fullTextForAmount += ' ' + embedTexts;
      }
      
      const amountMatch = fullTextForAmount.match(/Amount:\s*([\d,]+)/i);
      if (amountMatch) {
        const giveawayAmount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
        if (giveawayAmount > CONFIG.MAIN_CHANNEL_MAX_AMOUNT) return;
      }
    }

    if (!ShouldJoinGiveaway()) return;

    const delay = RandomDelay();
    await Sleep(delay);

    const emojisToUse = GetRandomEmojis();

    try {
      for (const emojiToUse of emojisToUse) {
        const existingReaction = message.reactions.cache.find(r => {
          const emojiId = r.emoji.id || r.emoji.name;
          const targetId = emojiToUse.match(/:(\d+)>/)?.[1] || emojiToUse;
          return emojiId === targetId || r.emoji.name === emojiToUse;
        });

        if (existingReaction) {
          await message.react(existingReaction.emoji);
        } else {
          await message.react(emojiToUse);
        }
        
        if (emojisToUse.length > 1) {
          await Sleep(300 + Math.random() * 200);
        }
      }
      
      account.stats.SessionReactions++;
      account.stats.SessionGiveawaysJoined++;
      account.stats.EnteredGiveaways.add(message.id);
      
      const now = new Date();
      const timeString = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      account.stats.LastReaction = `${message.author.tag} in #${message.channel.name}`;
      account.stats.LastReactionTime = timeString;
      
      if (isOGChannel && CONFIG.HAS_OG_ROLE && CanAutoType(account, 'OG') && Math.random() < CONFIG.AUTO_TYPE_OG_CHANCE) {
        const typeDelay = Math.floor(
          Math.random() * (CONFIG.AUTO_TYPE_OG_DELAY_MAX - CONFIG.AUTO_TYPE_OG_DELAY_MIN + 1)
        ) + CONFIG.AUTO_TYPE_OG_DELAY_MIN;
        
        setTimeout(async () => {
          try {
            if (!account.stats.IsRunning) return;
            
            const thankYouMsg = GetRandomMessage();
            const channel = await account.client.channels.fetch(CONFIG.OG_CHANNEL_ID);
            await channel.send(thankYouMsg);
            account.stats.AutoTypeCount++;
            account.stats.LastAutoTypeTimeOG = Date.now();
            account.stats.NextOGCooldown = GetRandomCooldown(CONFIG.AUTO_TYPE_OG_COOLDOWN_MIN, CONFIG.AUTO_TYPE_OG_COOLDOWN_MAX);
            
            DisplayUI();
          } catch (error) {
            console.error(`[AUTO-TYPE OG] Error: ${error.message}`);
          }
        }, typeDelay);
      }
      
      if (isMainChannel && CanAutoType(account, 'Main') && Math.random() < CONFIG.AUTO_TYPE_MAIN_CHANCE) {
        const typeDelay = Math.floor(
          Math.random() * (CONFIG.AUTO_TYPE_MAIN_DELAY_MAX - CONFIG.AUTO_TYPE_MAIN_DELAY_MIN + 1)
        ) + CONFIG.AUTO_TYPE_MAIN_DELAY_MIN;
        
        setTimeout(async () => {
          try {
            if (!account.stats.IsRunning) return;
            
            const thankYouMsg = GetRandomMessage();
            const channel = await account.client.channels.fetch(CONFIG.TARGET_CHANNEL_ID);
            await channel.send(thankYouMsg);
            account.stats.AutoTypeCount++;
            account.stats.LastAutoTypeTimeMain = Date.now();
            account.stats.NextMainCooldown = GetRandomCooldown(CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MIN, CONFIG.AUTO_TYPE_MAIN_COOLDOWN_MAX);
            
            DisplayUI();
          } catch (error) {
            console.error(`[AUTO-TYPE MAIN] Error: ${error.message}`);
          }
        }, typeDelay);
      }
      
      if (account.stats.SessionReactions % 3 === 0) {
        SaveAccounts();
        DisplayUI();
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  });
};

const AddAccount = async () => {
  ClearConsole();
  PrintBanner();
  
  console.log(`${COLORS.yellow}!${COLORS.reset} ${COLORS.bright}Add New Account${COLORS.reset}\n`);
  
  const nickname = Ask(`${COLORS.gray}Nickname (optional):${COLORS.reset} `).trim() || null;
  const token = AskHidden(`${COLORS.gray}Token:${COLORS.reset} `).trim();

  if (!token) {
    console.log(`\n${COLORS.red}X${COLORS.reset} Invalid token`);
    await Sleep(2000);
    DisplayUI();
    return;
  }

  console.log(`\n${COLORS.cyan}Connecting to Discord...${COLORS.reset}`);

  const client = new Client({ checkUpdate: false });

  try {
    const readyPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Failed to connect - took too long'));
      }, 30000);

      client.once('ready', () => {
        clearTimeout(timeout);
        console.log(`${COLORS.green}✓${COLORS.reset} Connected as ${COLORS.bright}${client.user.tag}${COLORS.reset}`);
        resolve();
      });
    });

    const loginPromise = client.login(token);
    
    await Promise.all([loginPromise, readyPromise]);

    const account = {
      token,
      nickname,
      client,
      stats: CreateAccountStats()
    };

    SetupMessageHandler(account);
    Accounts.push(account);
    SaveAccounts();
    
    console.log(`${COLORS.green}✓${COLORS.reset} Account added successfully!\n`);
    await Sleep(1500);
    DisplayUI();

  } catch (error) {
    console.log(`\n${COLORS.red}X${COLORS.reset} Failed: ${error.message}`);
    console.log(`${COLORS.dim}Make sure your token is valid${COLORS.reset}`);
    try {
      client.destroy();
    } catch {}
    await Sleep(3000);
    DisplayUI();
  }
};

const DeleteAccount = () => {
  if (Accounts.length === 0) return;
  
  const account = Accounts[UI_STATE.SelectedAccountIndex];
  account.client.destroy();
  Accounts.splice(UI_STATE.SelectedAccountIndex, 1);
  
  if (UI_STATE.SelectedAccountIndex >= Accounts.length && Accounts.length > 0) {
    UI_STATE.SelectedAccountIndex = Accounts.length - 1;
  }
  
  SaveAccounts();
  DisplayUI();
};

process.on('SIGINT', () => {
  SaveAccounts();
  Accounts.forEach(acc => acc.client.destroy());
  console.log(`\n${COLORS.yellow}Shutting down...${COLORS.reset}`);
  process.exit(0);
});

readline.emitKeypressEvents(process.stdin);
if (process.stdin.isTTY) process.stdin.setRawMode(true);

process.stdin.on('keypress', (str, key) => {
  if (key.name === 'space' && Accounts.length > 0) {
    const account = Accounts[UI_STATE.SelectedAccountIndex];
    account.stats.IsRunning = !account.stats.IsRunning;
    DisplayUI();
  }
  if (key.name === 'up' && Accounts.length > 0) {
    UI_STATE.SelectedAccountIndex = (UI_STATE.SelectedAccountIndex - 1 + Accounts.length) % Accounts.length;
    DisplayUI();
  }
  if (key.name === 'down' && Accounts.length > 0) {
    UI_STATE.SelectedAccountIndex = (UI_STATE.SelectedAccountIndex + 1) % Accounts.length;
    DisplayUI();
  }
  if (key.name === 'a' && !key.ctrl) {
    AddAccount();
  }
  if (key.name === 'd' && !key.ctrl && Accounts.length > 0) {
    DeleteAccount();
  }
  if (key.name === 'c' && !key.ctrl) {
    UI_STATE.ShowConfig = !UI_STATE.ShowConfig;
    DisplayUI();
  }
  if (key.name === 'e') {
    UI_STATE.ShowEarnings = !UI_STATE.ShowEarnings;
    DisplayUI();
  }
  if (key.name === 'w') {
    UI_STATE.ShowGlobalWinLog = !UI_STATE.ShowGlobalWinLog;
    DisplayUI();
  }
  if (key.name === 'h') {
    UI_STATE.ShowControls = !UI_STATE.ShowControls;
    DisplayUI();
  }
  if (key.name === 'r' && !key.ctrl && Accounts.length > 0) {
    const account = Accounts[UI_STATE.SelectedAccountIndex];
    account.stats.TotalReactions = 0;
    account.stats.TotalEarningsOG = 0;
    account.stats.TotalEarningsMain = 0;
    account.stats.TotalWinsOG = 0;
    account.stats.TotalWinsMain = 0;
    account.stats.TotalWins = 0;
    account.stats.TotalGiveawaysJoined = 0;
    account.stats.SessionReactions = 0;
    account.stats.SessionEarningsOG = 0;
    account.stats.SessionEarningsMain = 0;
    account.stats.SessionWinsOG = 0;
    account.stats.SessionWinsMain = 0;
    account.stats.SessionWins = 0;
    account.stats.SessionGiveawaysJoined = 0;
    account.stats.AutoTypeCount = 0;
    account.stats.LastAutoTypeTimeOG = 0;
    account.stats.LastAutoTypeTimeMain = 0;
    SaveAccounts();
    DisplayUI();
  }
  if (key.ctrl && key.name === 'c') {
    SaveAccounts();
    Accounts.forEach(acc => acc.client.destroy());
    process.exit(0);
  }
});

(async () => {
  ClearConsole();
  PrintBanner();
  
  console.log(`${COLORS.cyan}Loading...${COLORS.reset}\n`);
  
  const savedAccounts = LoadAccounts();
  
  if (savedAccounts.length === 0) {
    console.log(`${COLORS.yellow}No saved accounts found.${COLORS.reset}`);
    console.log(`${COLORS.dim}Press 'A' to add your first account...${COLORS.reset}\n`);
    await Sleep(1000);
    DisplayUI();
  } else {
    console.log(`${COLORS.green}Found ${savedAccounts.length} saved account(s)${COLORS.reset}`);
    console.log(`${COLORS.cyan}Logging in...${COLORS.reset}\n`);
    
    for (const savedAcc of savedAccounts) {
      const client = new Client({ checkUpdate: false });
      
      try {
        const readyPromise = new Promise((resolve) => {
          client.once('ready', () => {
            console.log(`${COLORS.green}✓${COLORS.reset} ${client.user.tag}`);
            resolve();
          });
        });
        
        await client.login(savedAcc.token);
        await readyPromise;
        
        const account = {
          token: savedAcc.token,
          nickname: savedAcc.nickname,
          client,
          stats: CreateAccountStats(savedAcc.stats)
        };
        
        SetupMessageHandler(account);
        Accounts.push(account);
        
      } catch (error) {
        console.log(`${COLORS.red}X${COLORS.reset} Failed to login: ${savedAcc.nickname || 'Unknown'} - ${error.message}`);
      }
    }
    
    await Sleep(1500);
    DisplayUI();
  }
})();