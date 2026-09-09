import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('translate')
    .setDescription('文章を自動で翻訳します')
    // ユーザー自身のアカウントにインストールする「User Install」タイプにする（サーバーへの招待は不要）
    .setIntegrationTypes(1) // 1 = UserInstall
    // Botとの個人DM・自分とのDM(Notes)・他の人とのDMで使えるようにする（サーバー内(0)は除外）
    .setContexts(1, 2) // 1 = BotDM, 2 = PrivateChannel
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
        .addChoices(
          { name: '韓国語', value: 'ko' },
          { name: '日本語', value: 'ja' },
          { name: '英語', value: 'en' },
          { name: '中国語（簡体字）', value: 'zh-CN' },
          { name: '中国語（繁体字）', value: 'zh-TW' },
          { name: 'タイ語', value: 'th' },
          { name: 'ベトナム語', value: 'vi' },
          { name: 'インドネシア語', value: 'id' },
          { name: 'フランス語', value: 'fr' },
          { name: 'スペイン語', value: 'es' },
          { name: 'ドイツ語', value: 'de' }
        )
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
