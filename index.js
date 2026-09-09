import { Client, GatewayIntentBits, MessageFlags } from 'discord.js';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const MAX_REPLY_LENGTH = 1900; // Discordの2000文字制限に余裕を持たせる

// ひらがな・カタカナ・漢字が含まれていれば日本語とみなす簡易判定
function looksJapanese(text) {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

// ハングルが含まれていれば韓国語とみなす簡易判定
function looksKorean(text) {
  return /[\uac00-\ud7a3]/.test(text);
}

// 翻訳先の自動決定: デフォルトは韓国語。ただし韓国語の入力なら日本語に変換する
function decideTargetLang(text) {
  if (looksKorean(text) && !looksJapanese(text)) return 'ja';
  return 'ko';
}

// Google翻訳の非公式エンドポイントを利用（APIキー不要・個人利用向け）
async function translateText(text, targetLang) {
  const url =
    'https://translate.googleapis.com/translate_a/single' +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`翻訳APIエラー: ${res.status}`);
  }

  const data = await res.json();
  const translated = data[0].map(chunk => chunk[0]).join('');
  const detectedLang = data[2];

  return { translated, detectedLang };
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

client.once('ready', () => {
  console.log(`ログインしました: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'translate') return;

  const text = interaction.options.getString('text', true);
  const explicitTarget = interaction.options.getString('to');

  const targetLang = explicitTarget ?? decideTargetLang(text);

  // 自分にしか見えない返信にする
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { translated, detectedLang } = await translateText(text, targetLang);

    const reply =
      `**原文** (${detectedLang}): ${truncate(text, MAX_REPLY_LENGTH / 2)}\n` +
      `**翻訳** (${targetLang}): ${truncate(translated, MAX_REPLY_LENGTH / 2)}`;

    await interaction.editReply(reply);
  } catch (error) {
    console.error('翻訳エラー:', error);
    await interaction.editReply('翻訳に失敗しました…もう一度試してみてください。');
  }
});

client.login(process.env.DISCORD_TOKEN);
