import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

// 翻訳先として選べる言語の一覧（Discordの上限は25個）
// 表示名は「現地表記 / 日本語名」の形にしてあるので、外国の人もそのまま選べます。
const CHOICES = [
  { name: '한국어 / 韓国語', value: 'ko' },
  { name: '日本語', value: 'ja' },
  { name: 'English / 英語', value: 'en' },
  { name: '简体中文 / 中国語（簡体字）', value: 'zh-CN' },
  { name: '繁體中文 / 中国語（繁体字）', value: 'zh-TW' },
  { name: 'ไทย / タイ語', value: 'th' },
  { name: 'Tiếng Việt / ベトナム語', value: 'vi' },
  { name: 'Bahasa Indonesia / インドネシア語', value: 'id' },
  { name: 'Filipino / フィリピン語', value: 'tl' },
  { name: 'Bahasa Melayu / マレー語', value: 'ms' },
  { name: 'Français / フランス語', value: 'fr' },
  { name: 'Español / スペイン語', value: 'es' },
  { name: 'Deutsch / ドイツ語', value: 'de' },
  { name: 'Português / ポルトガル語', value: 'pt' },
  { name: 'Italiano / イタリア語', value: 'it' },
  { name: 'Русский / ロシア語', value: 'ru' },
  { name: 'Українська / ウクライナ語', value: 'uk' },
  { name: 'Polski / ポーランド語', value: 'pl' },
  { name: 'Nederlands / オランダ語', value: 'nl' },
  { name: 'Türkçe / トルコ語', value: 'tr' },
  { name: 'العربية / アラビア語', value: 'ar' },
  { name: 'עברית / ヘブライ語', value: 'he' },
  { name: 'हिन्दी / ヒンディー語', value: 'hi' },
  { name: 'Ελληνικά / ギリシャ語', value: 'el' },
  { name: 'Монгол / モンゴル語', value: 'mn' }
];

const commands = [
  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('文章を自動で翻訳します')
    // サーバーへの追加（Guild Install）と、各自のアカウントへの追加（User Install）の両方に対応
    .setIntegrationTypes(0, 1) // 0 = GuildInstall, 1 = UserInstall
    // サーバー内・Botとの個人DM・他の人とのDMのすべてで使えるようにする
    .setContexts(0, 1, 2) // 0 = Guild, 1 = BotDM, 2 = PrivateChannel
    .addStringOption(option =>
      option
        .setName('text')
        .setDescription('翻訳したい文章')
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName('to')
        .setDescription('翻訳先の言語（省略時は韓国語。韓国語の入力なら日本語に自動変換）')
        .setRequired(false)
        // 候補はDiscord側が保持するので、ボットが動いていなくても選べます
        .addChoices(...CHOICES)
    )
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log('スラッシュコマンドを登録中...');

    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log('登録が完了しました！反映まで数分かかる場合があります。');
  } catch (error) {
    console.error('登録中にエラーが発生しました:', error);
  }
}

main();
