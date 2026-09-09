import {
  Client,
  GatewayIntentBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const MAX_REPLY_LENGTH = 1900; // Discordの2000文字制限に余裕を持たせる
const PENDING_TTL_MS = 10 * 60 * 1000; // 送信ボタンの有効期限（10分）

// ボタンが押されるまでの間、翻訳結果を一時的に保存しておくメモリ上のキャッシュ
const pendingTranslations = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of pendingTranslations) {
    if (now - value.createdAt > PENDING_TTL_MS) {
      pendingTranslations.delete(key);
    }
  }
}, 5 * 60 * 1000);

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
  if (interaction.isChatInputCommand() && interaction.commandName === 'translate') {
    await handleTranslateCommand(interaction);
  } else if (interaction.isButton() && interaction.customId.startsWith('send:')) {
    await handleSendButton(interaction);
  }
});

async function handleTranslateCommand(interaction) {
  const text = interaction.options.getString('text', true);
  const explicitTarget = interaction.options.getString('to');

  const targetLang = explicitTarget ?? decideTargetLang(text);

  // 自分にしか見えない返信にする（プレビュー）
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const { translated, detectedLang } = await translateText(text, targetLang);

    const previewContent =
      `**原文** (${detectedLang}): ${truncate(text, MAX_REPLY_LENGTH / 2)}\n` +
      `**翻訳** (${targetLang}): ${truncate(translated, MAX_REPLY_LENGTH / 2)}`;

    const sentMessage = await interaction.editReply(previewContent);

    pendingTranslations.set(sentMessage.id, {
      text: translated,
      userId: interaction.user.id,
      createdAt: Date.now()
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`send:${sentMessage.id}`)
        .setLabel('このままチャットに送信')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.editReply({ content: previewContent, components: [row] });
  } catch (error) {
    console.error('翻訳エラー:', error);
    await interaction.editReply('翻訳に失敗しました…もう一度試してみてください。');
  }
}

async function handleSendButton(interaction) {
  const msgId = interaction.customId.split(':')[1];
  const pending = pendingTranslations.get(msgId);

  if (!pending) {
    await interaction.reply({
      content: '送信の有効期限が切れました。もう一度 /translate を実行してください。',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  if (interaction.user.id !== pending.userId) {
    await interaction.reply({
      content: 'この操作は翻訳を実行した本人のみ行えます。',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  try {
    await interaction.channel.send(pending.text);
    pendingTranslations.delete(msgId);
    await interaction.update({ content: '✅ チャットに送信しました。', components: [] });
  } catch (error) {
    console.error('送信エラー:', error);
    await interaction.reply({
      content: '送信に失敗しました。このチャットへの送信権限がない可能性があります。',
      flags: MessageFlags.Ephemeral
    });
  }
}

client.login(process.env.DISCORD_TOKEN);
