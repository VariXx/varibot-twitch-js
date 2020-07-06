const tmi = require('tmi.js');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { botSettingsDB } = require('./utils/db/botSettingsDB');
const { commandsDB } = require('./utils/db/commandsDB');
const { channelPointsSoundsDB } = require('./utils/db/channelPointSoundsDB');
const { randomNumber } = require('./utils/randomNumber');
const { randomRadio, isGTAGame } = require('./utils/gta/gtaCmds');
const { loadSounds } = require('./utils/loadSounds');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { getRandomOwnedGame } = require('./utils/ownedGames');
const twitchAPI = require('./utils/api');
const WebSocket = require('ws');
const pubsubSocket = new WebSocket('wss://pubsub-edge.twitch.tv');
const { ipcMain, app, BrowserWindow } = require('electron');
const ipc = ipcMain;
var win = null;

const { updateCommand } = require('./utils/updateCommand');
const { updateBotSettings } = require('./utils/updateBotSettings');
const { beatGame } = require('./utils/beatGame');
const { getMultiLink } = require('./utils/multiLink');

// TO DO - change to globals? 
let client = null;
let commands = {};
let botSettings = {};
let randomSounds = [];
let readyToConnect = true;
let channelPointsSounds = {};
let channelPointsFilenames = []; // add beat game sound to this
const soundsDir = `${app.getPath('appData')}\\varibot\\sounds`;

let googleCredsExist = false;
const googleCredsFile = `${app.getPath('appData')}\\varibot\\googleCreds.json`; // TO DO - allow user to change filename in settings

let lastRunTimestamp = new Date(); // hacky cooldown 

if (!fs.existsSync(soundsDir)){
    fs.mkdirSync(soundsDir);
}

if (fs.existsSync(googleCredsFile)) { 
    googleCreds = require(`${app.getPath('appData')}\\varibot\\googleCreds`);
    googleCredsExist = true;
}

console.log(`VariBot`);

async function runCommand(targetChannel, fromMod, context, inputCmd, args) {   
    let cmd = inputCmd.toLowerCase();
    // check if command is enabled when checking cooldown 
    // let checked = await checkCooldown(lastRunTimestamp);
    // if(checked) {  
    if(commands[cmd] !== undefined) {
        if(!commands[cmd].enabled) { 
            console.log(`Command ${cmd} is disabled`);
            return;
        }        
        lastRunTimestamp = new Date();
        if(cmd in commands) {
            // if(!commands[cmd].enabled) { 
            //     console.log(`Found command ${cmd} but it is disabled. Skipping.`);            
            //     return;
            // }
            if(commands[cmd].scope == 'mods' && !fromMod) {
                console.log(`User ${context['display-name']} tried to use the mod only command ${cmd}`);
                return;
            }
            else {
                if(commands[cmd].cmdType == 'simple') {
                    client.say(targetChannel, commands[cmd].result);
                    return; 
                }
            }
        }
        if(cmd == 'shuffle') { 
            // TO DO - check that the spreadsheet is not called template
            let searchPlatform = '';
            args.forEach(searchString => searchPlatform += searchString);
            if(searchPlatform.length > 0) {
                searchPlatform = searchPlatform.trim();
            }
            else {
                searchPlatform = 'genesis';
            }
            let randomGame = await getRandomOwnedGame(botSettings.googleSheetsClientEmail, botSettings.googleSheetsPrivateKey, botSettings.ownedGamesSpreadSheetID,searchPlatform);
            randomGame ? client.say(targetChannel, `${randomGame}`) : console.log('could not find game');
        }
        else if(cmd == 'list') {
            client.say(targetChannel, `https://docs.google.com/spreadsheets/d/${botSettings.beatSpreadSheetID}`);
        }
        else if(cmd == 'multi') { 
            let multiLink = await getMultiLink(botSettings.channel, botSettings.clientId, botSettings.token);
            if(multiLink !== undefined) {
                client.say(targetChannel,`${multiLink}`);
            }
        }
        else if(cmd == 'beat') {
            if(googleCredsExist) {
                if(fromMod) {           
                    let beatMsg = await beatGame(args, targetChannel, botSettings.beatSpreadSheetID, botSettings.beatSheetID, botSettings.clientId, botSettings.token, googleCredsFile)
                    .catch(error => {console.log(error);});
                    client.say(targetChannel, beatMsg);
                    statusMsg('success', beatMsg);
                    win.webContents.executeJavaScript(`playSound('${botSettings.beatGameSound}')`);
                }
                else{
                    client.say(targetChannel, `${context['display-name']} does not have permission to run this command`);
                }
            }
            else {
                statusMsg('error', `Could not find Google creds file.`);
            }
        }
        else if(cmd == 'radio') {
            let lookupChannel = targetChannel.substr(1);
            let channelId = await twitchAPI.getChannelID(lookupChannel, botSettings.clientId, botSettings.token);
            let currentGame = await twitchAPI.getCurrentGame(channelId, botSettings.clientId, botSettings.token);            
            if(isGTAGame(currentGame)) {
                try {
                    let radioResult = randomRadio(currentGame);
                    client.say(targetChannel, radioResult);
                    statusMsg('special', `Random radio: ${radioResult}`);
                }
                catch(error){console.log(error);}         
                return;   
            }
            else {
                statusMsg('error', `${currentGame} is not a GTA game`);
                return;
            }
        }
        else {
            console.log(`Read command ${cmd} (args: ${args}) from ${context['display-name']}, command not found.`);
            return;
        }
    }
    else { 
        console.log(`Command ${cmd} not found`);
    }
}

async function checkCooldown(lastRun) { 
    let now = new Date();
    let lastRunDate = new Date(lastRun);
    let nextRunDate = new Date(lastRunDate.getTime() + (botSettings.cooldown * 1000));

    if(now > nextRunDate) { 
        return true;
    }
    return false;
}

function isMod(checkMsg) {
    if(checkMsg.mod){return true;}
    else if(checkMsg.badges && checkMsg.badges.broadcaster) {return true;}
    else{return false;}
}

async function loadChannelPointsSounds() { 
    await channelPointsSoundsDB.sync();
    channelPointsSounds = {};
    channelPointsFilenames = [];
    let dbResult = await channelPointsSoundsDB.findAll();
    for(let x = 0; x < dbResult.length; x++) {
        channelPointsSounds[dbResult[x].name] = {
            name: dbResult[x].name,
            filename: dbResult[x].filename
        }
        channelPointsFilenames.push(dbResult[x].filename);        
    }
    console.log(`Loaded ${dbResult.length} channel reward sounds`);
}

async function loadCommands() {
    await commandsDB.sync();
    let dbResult = await commandsDB.findAll();
    for(let x = 0; x < dbResult.length; x++) {
        commands[dbResult[x].name] = {
            name: dbResult[x].name,
            scope: dbResult[x].scope,
            cooldown: dbResult[x].cooldown,
            enabled: dbResult[x].enabled,
            result: dbResult[x].result,
            cmdType: dbResult[x].cmdType
        }
    }
    let missingCommands = false;
    if(!('shuffle' in commands)) { 
        console.log(`Built in command shuffle was not found in commands. Creating command in DB.`);
        commandsDB.create({
            name: 'shuffle',
            scope: 'all',
            cooldown: 'TODO',
            enabled: false,
            cmdType: 'builtin'
        });
        missingCommands = true;
    }
    if(!('list' in commands)) { 
        console.log(`Built in command list was not found in commands. Creating command in DB.`);
        commandsDB.create({
            name: 'list',
            scope: 'all',
            cooldown: 'TODO',
            enabled: false,
            cmdType: 'builtin'
        });
        missingCommands = true;
    }
    if(!('multi' in commands)) { 
        console.log(`Built in command multi was not found in commands. Creating command in DB.`);
        commandsDB.create({
            name: 'multi',
            scope: 'all',
            cooldown: 'TODO',
            enabled: false,
            cmdType: 'builtin'
        });
        missingCommands = true;
    }
    if(!('beat' in commands)) { 
        console.log(`Built in command beat was not found in commands. Creating command in DB.`);
        commandsDB.create({
            name: 'beat',
            scope: 'all',
            cooldown: 'TODO',
            enabled: false,
            cmdType: 'builtin'
        });
        missingCommands = true;
    }
    if(!('radio' in commands)) { 
        console.log(`Built in command radio was not found in commands. Creating command in DB.`);
        commandsDB.create({
            name: 'radio',
            scope: 'all',
            cooldown: 'TODO',
            enabled: false,
            cmdType: 'builtin'
        });
        missingCommands = true;
    }
    if(missingCommands) { 
        await loadCommands();
        return;
    }
    console.log(`Loaded ${dbResult.length} commands`);
}   

async function startBot() { 
    await botSettingsDB.sync(); // TO DO - move this to a function 
    // let botset = await botSettingsDB.findAll(); 
    let botset = await botSettingsDB.findOrCreate({where: {id: 1}}); 
    botSettings = botset[0];
    if(googleCredsExist) {
        botSettings.googleSheetsClientEmail = googleCreds.client_email;
        botSettings.googleSheetsPrivateKey = googleCreds.private_key;
    }
    // botSettings.soundsDir = soundsDir;

    await loadCommands();

    if(botSettings === undefined) { 
        console.log('Bot settings are empty. Please run setup.');
        readyToConnect = false;
    }
    else {
        if(botSettings.clientId === undefined || botSettings.clientId.length < 1) { 
            console.log('Invalid client ID in bot settings. Please run setup.');
            readyToConnect = false;
        }

        if(botSettings.token === undefined || botSettings.token.length < 1) { 
            console.log('Invalid auth token. Please use the link below to authorize the bot and get a token.');
            console.log(`https://id.twitch.tv/oauth2/authorize?client_id=${botSettings.clientId}&redirect_uri=https://acceptdefaults.com/twitch-oauth-token-generator/&response_type=token&scope=bits:read+channel:read:redemptions+channel:moderate+chat:edit+chat:read+user:edit:broadcast`);
            readyToConnect = false;
            statusMsg(`error`,`Invalid bot settings. Please run setup.`);        
        } 

        if(botSettings.channel === undefined || botSettings.channel.length < 1) { 
            console.log('Invalid channel in bot settings. Please run setup.');
            readyToConnect = false;
        }
        await loadChannelPointsSounds();
        if(soundsDir === undefined || soundsDir.length > 1) {
            randomSounds = await loadSounds(soundsDir, channelPointsFilenames);
        }
        else {
            console.log(`No sounds directory found in settings. Skipping loading random sounds.`);
        }        
    }

    if(readyToConnect) {
        const options = {
            identity: {
                username: botSettings.username,
                password: botSettings.token
            },
            channels: [botSettings.channel]
        }; 
        client = new tmi.client(options);    
        client.connect();
        client.on('connected', (address, port) => {
            console.log(`Chatbot (${options.identity.username}) connected to ${address}:${port}`);
        });

        client.on('message', async (target, context, msg, self) => {
            if(self) { return; }
            let msgTime = new Date();
            statusMsg(`info`, `[${msgTime.getHours()}:${msgTime.getMinutes()}]${context['display-name']}: ${msg}`);
            if(msg.startsWith('!')) { 
                cmdArray = msg.slice(1).split(' ');
                if(isMod(context)) {
                    await runCommand(target, true, context, cmdArray[0], cmdArray.slice(1));
                }
                else {
                    await runCommand(target, false, context, cmdArray[0], cmdArray.slice(1));
                }
            }
        });    
        win.webContents.executeJavaScript(`updateSoundsList()`);
        win.webContents.executeJavaScript(`showPage('home')`);        
    }
    else {
        win.webContents.executeJavaScript(`showPage('settings')`);
        win.webContents.executeJavaScript(`alertMsg(true, 'error', 'Invalid bot settings. Please update settings and restart bot.')`);        
    }
}

// electron start

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.loadFile('index.htm');
    win.setMenu(null);
    // win.webContents.openDevTools(); // TO DO - comment out before commit 
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
app.on('activate', () => {
if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
}
});

ipc.handle('newSoundsSettings', async (event, args) => {
    await channelPointsSoundsDB.sync(); // sync channel points sounds   
    await channelPointsSoundsDB.findAll().then(result => {
        for(x = 0; x < result.length; x++) {
            result[x].destroy(); // clear channel points sounds table
        }
    });
    await channelPointsSoundsDB.sync();    
    for(let key in args[0]) {
        await channelPointsSoundsDB.create({
            name: args[0][key].name,
            filename: args[0][key].filename
        });
    }
    await channelPointsSoundsDB.sync(); // update channel points sounds with new values
    await loadChannelPointsSounds(); // load channel points sounds     
    if(soundsDir.length > 1) {
        randomSounds = []; // clear random sounds array
        randomSounds = await loadSounds(soundsDir, channelPointsFilenames); // rebuild random sounds array
    }
});

ipc.handle('botSettingsFromForm', async (event, args) => {
    // TO DO - change names to match and run this through a loop - skip any blank values
    if(args.botUsername.length > 1) {
        await updateBotSettings('username', args.botUsername);
    }
    if(args.botToken.length > 1) {
        await updateBotSettings('token', args.botToken);
    }
    if(args.clientId.length > 1) {        
        await updateBotSettings('clientId', args.clientId);
    }
    if(args.channel.length > 1) {        
        await updateBotSettings('channel', args.channel);
    }
    if(args.beatSheetID.length > 1) {    
        await updateBotSettings('beatSheetID', args.beatSheetID);
    }
    if(args.beatSpreadSheetID.length > 1) {
        await updateBotSettings('beatSpreadSheetID', args.beatSpreadSheetID);
    }
    if(args.beatSheetID.length > 1) {
        await updateBotSettings('beatSheetID', args.beatSheetID);
    }
    if(args.beatGameSound.length > 1) {
        await updateBotSettings('beatGameSound', args.beatGameSound);
    }
    await botSettingsDB.sync();
    let updateMsg = `Settings updated. You will need to restart if your token was added or changed.`;
    statusMsg(`success`, updateMsg);
    win.webContents.executeJavaScript(`alertMsg('true','success', '${updateMsg}')`);
    return true;
});

ipc.handle('loadSounds', async (event, args) => {
    await loadChannelPointsSounds();
    if(soundsDir.length > 1) {
        randomSounds = await loadSounds(soundsDir, channelPointsFilenames);
    }    
    let returnSounds = [...randomSounds, ...channelPointsFilenames];
    return returnSounds;
});

ipc.handle('getCurrentCommands', async (event, args) => {
    await loadCommands();
    return commands;
});

ipc.handle('updateCmdSettings', async (event, args) => {
    let newCmdSettings = args;
    for(key in newCmdSettings) {
        await updateCommand(newCmdSettings[key].name, 'enabled', newCmdSettings[key].enabled); 
    }
});

ipc.handle('getCurrentSettings', async (event, args) => {
    await botSettingsDB.sync();
    let dbSettings = await botSettingsDB.findOrCreate({where: {id: 1}}); 
    if(dbSettings[0] !== undefined) {
        let result = {
            username: dbSettings[0].username,
            token: dbSettings[0].token,
            clientId: dbSettings[0].clientId,
            channel: dbSettings[0].channel,
            cooldown: dbSettings[0].cooldown,
            soundsDir: soundsDir,
            googleSheetsClientEmail: dbSettings[0].googleSheetsClientEmail,
            googleSheetsPrivateKey: dbSettings[0].googleSheetsPrivateKey,
            beatSheetID: dbSettings[0].beatSheetID,
            beatSpreadSheetID: dbSettings[0].beatSpreadSheetID,
            beatGameSound: dbSettings[0].beatGameSound,
            ownedGamesSpreadSheetID: dbSettings[0].ownedGamesSpreadSheetID
        }
        return result;
    }
});

ipc.handle('getSoundsSettings', async (event, args) => {

    await loadChannelPointsSounds();
    let randSounds = [];
    if(soundsDir.length > 1) {
         randSounds = await loadSounds(soundsDir, channelPointsFilenames);
    }
    let returnSounds = {
        rewards: channelPointsSounds,
        random: randomSounds
    }
    return returnSounds; 
});

function statusMsg(msgType, msg) { 
    let sendMsg = {
        type: msgType,
        message: msg
    }
    win.webContents.send('status', sendMsg);
    console.log(msg);
}

// electron end

// pubsub start

function proecssReward(reward) {
    statusMsg(`reward`, 'Reward ' + reward.data.redemption.reward.title + ' was redeemed by ' + reward.data.redemption.user.display_name + ' for ' + reward.data.redemption.reward.cost + ' points');
    if(reward.data.redemption.reward.title.toLowerCase() == 'random sound') {
        // add a while loop to re-roll random if it picks the same sound twice or the beat game sound
        let randomIndex = Math.floor(Math.random() * Math.floor(randomSounds.length));
        win.webContents.executeJavaScript(`playSound('${randomSounds[randomIndex]}')`);
        statusMsg(`info`, `Playing sound ${randomSounds[randomIndex]}`);
    }
    else {
        for(let s in channelPointsSounds) {
            if(channelPointsSounds[s].name.toLowerCase() == reward.data.redemption.reward.title.toLowerCase()) {
                win.webContents.executeJavaScript(`playSound('${channelPointsSounds[s].filename}')`);
                statusMsg(`info`, `Playing sound ${channelPointsSounds[s].name} (${channelPointsSounds[s].filename})`);
                break;
            }   
        }
    }
}

function pubsubHandle(msg) {
    if(msg.type == 'MESSAGE') {
        pubsubMessage = JSON.parse(msg.data.message);
        if(pubsubMessage.type == 'reward-redeemed') {
            proecssReward(pubsubMessage);
        }
    }
}

function pubsubPings() {
    pubsubSocket.send(JSON.stringify({type:"PING"}));
    setTimeout(pubsubPings,120000); // 2 minutes
}

pubsubSocket.onopen = async function(e) {
    await botSettingsDB.sync();
    let botset = await botSettingsDB.findOrCreate({where: {id: 1}}); 
    botSettings = botset[0];  
    // TO DO - move bot settings to a command or load it all before starting these 
    if(botSettings !== undefined) {
        let channelId = await twitchAPI.getChannelID(botSettings.channel, botSettings.clientId, botSettings.token);
        let connectMsg =  {
            type: "LISTEN",
            nonce: "44h1k13746815ab1r2",
            data:  {
            topics: ["channel-points-channel-v1." + channelId],
            auth_token: botSettings.token
            }
        };
        pubsubSocket.send(JSON.stringify(connectMsg));
        console.log(`Pubsub connected. Listed topics: ${connectMsg.data.topics}`);
        pubsubPings();
    }
};

pubsubSocket.onmessage = function(event)  {
    pubsubResonse = JSON.parse(event.data);
    pubsubHandle(pubsubResonse);
};

// pubsub end

app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});

startBot();

