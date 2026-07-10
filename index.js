// index.js

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { ensureItemsCatalog } = require('./bitjitaItems');
const { loadItemCatalog } = require('./itemCatalog');
const { Client, Intents, Collection } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { startAutoMemberSync } = require('./autoSync');

// Create a new Discord client (discord.js v13 style)
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,          // Server-related events
    Intents.FLAGS.GUILD_MESSAGES,  // Message events in servers
  ],
});

// Store commands in a Collection for runtime execution
client.commands = new Collection();

// Load command files from ./commands
function loadCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if (!command.data || !command.execute) {
      console.warn(`Skipping command file ${file} because it does not export data/execute.`);
      continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
  }

  return commands;
}

client.once('ready', async () => {
  console.log(`Disbit is online as ${client.user.tag}!`);

  try {
    const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_TOKEN);

    const guildId = process.env.TEST_GUILD_ID;
    const clientId = client.user.id;

    if (!guildId) {
      console.warn('TEST_GUILD_ID is not set in .env. Skipping command clear/registration.');
    } else {
      // 1) Clear all existing guild commands
      console.log(`Clearing all commands for guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: [] },
      );
      console.log('Guild commands cleared.');

      // 2) Load current commands from files
      const commands = loadCommands();

      // 3) Register current commands
      console.log(`Registering slash commands for guild ${guildId}...`);
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log('Slash commands registered successfully!');
    }

    // 4) Start automatic empire member sync (runs in the background)
    startAutoMemberSync();

  } catch (error) {
    console.error('Error managing slash commands:', error);
  }
});

// Handle interactions (slash commands)
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: 'There was an error while executing this command!',
        ephemeral: true,
      });
    }
  }
});

// Start the bot: first ensure items catalog, then log in
async function start() {
  try {
    // 1) Ensure items.json is current (refresh if item count changed)
    const catalog = await ensureItemsCatalog();

    // 2) Load catalog into memory so commands can use getItemName()
    loadItemCatalog(catalog);

    // 3) Log in to Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('Failed to start bot:', err);
    process.exit(1);
  }
}

start();