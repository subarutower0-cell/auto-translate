import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

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
        .setDescription('翻訳先の言語（日本語名・English・한국어・中文などで入力可。省略時は自動）')
        .setRequired(false)
        // 固定リストではなく、入力に合わせて候補を出す方式にする
        .setAutocomplete(true)
    )
].map(command => command.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log('スラッシュコマンドを登録中...');

    // User Installタイプのコマンドはサーバー単位ではなく常にグローバル登録
    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

    console.log('登録が完了しました！反映まで数分かかる場合があります。');
  } catch (error) {
    console.error('登録中にエラーが発生しました:', error);
  }
}

main();
