import {
  Client,
  GatewayIntentBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { franc } from 'franc';
import 'dotenv/config';

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// 想定外のエラーでプロセス全体が落ちないようにする（落ちると再起動でデータが消えるため）
process.on('unhandledRejection', reason => {
  console.error('Unhandled Rejection:', reason);
});

client.on('error', error => {
  console.error('Discordクライアントエラー:', error);
});

client.on('shardError', error => {
  console.error('シャードエラー:', error);
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

// タイ文字が含まれていればタイ語とみなす簡易判定
function looksThai(text) {
  return /[\u0e00-\u0e7f]/.test(text);
}

// franc（ISO 639-3）の判定結果をMyMemory用の言語コードに変換
const FRANC_TO_LANG = {
  eng: 'en',
  fra: 'fr',
  spa: 'es',
  deu: 'de',
  vie: 'vi',
  ind: 'id',
  cmn: 'zh-CN'
};

// 文章から翻訳元の言語を推測する
function detectSourceLang(text) {
  if (looksJapanese(text)) return 'ja';
  if (looksKorean(text)) return 'ko';
  if (looksThai(text)) return 'th';

  const francCode = franc(text); // 短い文章は 'und'（判定不能）になることがある
  return FRANC_TO_LANG[francCode] ?? 'en'; // 判定できない場合は英語として扱う
}

// 翻訳先の自動決定: デフォルトは韓国語。ただし韓国語の入力なら日本語に変換する
function decideTargetLang(sourceLang) {
  return sourceLang === 'ko' ? 'ja' : 'ko';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// MyMemory API（登録・クレジットカード不要の無料翻訳API）で翻訳する
async function translateText(text, sourceLang, targetLang, attempt = 1) {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`
  });
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;

  const res = await fetch(url);

  if ((res.status === 429 || res.status === 503) && attempt < 4) {
    await sleep(attempt * 1500); // 混雑時は少し待って自動で再試行
    return translateText(text, sourceLang, targetLang, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`翻訳APIエラー: ${res.status}`);
  }

  const data = await res.json();

  if (data.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(`翻訳APIエラー: ${data.responseStatus} ${data.responseDetails ?? ''}`);
  }

  const translated = data.responseData?.translatedText;
  if (!translated) {
    throw new Error('翻訳APIエラー: レスポンスが不正です');
  }

  return translated;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

client.once('clientReady', () => {
  console.log(`ログインしました: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'translate') {
      await handleTranslateCommand(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('send:')) {
      await handleSendButton(interaction);
    }
  } catch (error) {
    // ここで最終的に受け止めることで、何が起きてもプロセス全体は落とさない
    console.error('interactionCreateハンドラエラー:', error);
  }
});

async function handleTranslateCommand(interaction) {
  const text = interaction.options.getString('text', true);
  const explicitTarget = interaction.options.getString('to');

  const sourceLang = detectSourceLang(text);
  const targetLang = explicitTarget ?? decideTargetLang(sourceLang);

  // 自分にしか見えない返信にする（プレビュー）
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const translated =
      sourceLang === targetLang ? text : await translateText(text, sourceLang, targetLang);

    const previewContent =
      `**原文** (${sourceLang}): ${truncate(text, MAX_REPLY_LENGTH / 2)}\n` +
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
    const isRateLimited = error.message.includes('429') || error.message.includes('503');
    const errorMessage = isRateLimited
      ? '翻訳サービスが混み合っています。少し時間をおいてもう一度試してください。'
      : '翻訳に失敗しました…もう一度試してみてください。';
    try {
      await interaction.editReply(errorMessage);
    } catch (innerError) {
      console.error('エラー通知の送信にも失敗:', innerError);
    }
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
    await interaction.update({ content: '✅ チャットに送信しました。', components: [] });
    await interaction.followUp(pending.text);
    pendingTranslations.delete(msgId);
  } catch (error) {
    console.error('送信エラー:', error);
    try {
      const errorMessage = { content: '送信に失敗しました。もう一度お試しください。', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage);
      } else {
        await interaction.reply(errorMessage);
      }
    } catch (innerError) {
      console.error('エラー通知の送信にも失敗:', innerError);
    }
  }
}

client.login(process.env.DISCORD_TOKEN);
