const fs = require('fs');
const tmi = require('tmi.js');
const crypto = require('crypto');
const WebSocket = require('ws');
const twitchAPI = require('./utils/api');
const pubsubSocket = new WebSocket('wss://pubsub-edge.twitch.tv');
const { autoUpdater } = require('electron-updater');
const { botSettingsDB } = require('./utils/db/botSettingsDB');
const { commandsDB } = require('./utils/db/commandsDB');
const { channelPointsSoundsDB } = require('./utils/db/channelPointSoundsDB');
const { randomRadio, isGTAGame } = require('./utils/gta/gtaCmds');
const { loadSounds } = require('./utils/loadSounds');
const { getRandomOwnedGame } = require('./utils/ownedGames');
const { updateCommand } = require('./utils/updateCommand');
const { updateBotSettings } = require('./utils/updateBotSettings');
const { beatGame } = require('./utils/beatGame');
const { getMultiLink } = require('./utils/multiLink');
const { isMod } = require('./utils/isMod');
const { getSpreadsheetInfo } = require('./utils/getSpreadsheetInfo');
const { colorLoop } = require('./utils/hue/colorLoop');
const { getHueSettings } = require('./utils/hue/getHueSettings');
const { getLight } = require('./utils/hue/getLight');
const { createBridgeUser } = require('./utils/hue/createBridgeUser');
const { setLightColor} = require('./utils/hue/setLightColor');
const { getAllLights } = require('./utils/hue/getAllLights');
const hueColors = require('./utils/hue/hueColors.json');
const versionNumber = require('./package.json').version;

const { ipcMain, app, BrowserWindow } = require('electron');
const { createBrotliCompress } = require('zlib');
const { setHueSettings } = require('./utils/hue/setHueSettings');
const { randomNumber } = require('./utils/randomNumber');
// const ipcMain = ipcMain;
var win = null;

// TO DO - change to globals? 
let client = null;
let commands = {};
let botSettings = {};
var nonce;
var hueSettings = {};
var hueBitsAlertsSettings = {};
var hueSubsAlertsSettings = {};
var hueChannelPointsAlertsSettings = {};
let randomSounds = [];
let readyToConnect = true;
let channelPointsSounds = {};
let channelPointsFilenames = []; // add beat game sound to this
const soundsDir = `${app.getPath('appData')}\\varibot\\sounds`;
const hueSettingsFile = `${app.getPath('appData')}\\varibot\\hue\\hueSettings.json`;
const hueBitsAlertsSettingsFile = `${app.getPath('appData')}\\varibot\\hue\\hueBitsAlertsSettings.json`;
const hueSubsAlertsSettingsFile = `${app.getPath('appData')}\\varibot\\hue\\hueSubsAlertsSettings.json`;
const hueChannelPointsAlertsSettingsFile = `${app.getPath('appData')}\\varibot\\hue\\hueChannelPointsAlertsSettings.json`;

let googleCredsExist = false;
const googleCredsFilePath = `${app.getPath('appData')}\\varibot\\googleCreds.json`;

let lastRunTimestamp = new Date(); // hacky cooldown 

if (!fs.existsSync(soundsDir)){
    fs.mkdirSync(soundsDir);
}

function checkGoogleCreds() {
    if (fs.existsSync(googleCredsFilePath)) { 
        googleCreds = require(`${app.getPath('appData')}\\varibot\\googleCreds`);
        googleCredsExist = true;
    }
    else {
        googleCredsExist = false;
    }
}

console.log(`VariBot ${versionNumber}`);

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
        else if(cmd == 'colors') {
            client.say(targetChannel, `https://docs.google.com/spreadsheets/d/1pV2oCgOZOfMm1vHQecCnAkcVc3txb4fPgF3nfzG-vZ4`);
        }
        else if(cmd == 'multi') { 
            let multiLink = await getMultiLink(botSettings.channel, botSettings.clientId, botSettings.token);
            if(multiLink !== undefined) {
                client.say(targetChannel,`${multiLink}`);
            }
        }
        else if(cmd == 'beat') {
            checkGoogleCreds();
            if(googleCredsExist) {
                if(fromMod) {           
                    let beatMsg = await beatGame(args, targetChannel, botSettings.beatSpreadSheetID, botSettings.beatSheetID, botSettings.clientId, botSettings.token, googleCredsFilePath)
                    .catch(error => {console.log(error);});
                    client.say(targetChannel, beatMsg);
                    statusMsg('success', beatMsg);
                    updateRecentEvents(beatMsg);
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
    let botset = await botSettingsDB.findOrCreate({where: {id: 1}}); 
    botSettings = botset[0];
    checkGoogleCreds();
    await reloadHueSettings();
    if(googleCredsExist) {
        botSettings.googleSheetsClientEmail = googleCreds.client_email;
        botSettings.googleSheetsPrivateKey = googleCreds.private_key;
    }

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
            // console.log('Invalid auth token. Please use the link below to authorize the bot and get a token.');
            // console.log(`https://id.twitch.tv/oauth2/authorize?client_id=${botSettings.clientId}&redirect_uri=https://acceptdefaults.com/twitch-oauth-token-generator/&response_type=token&scope=bits:read+channel:read:redemptions+channel:moderate+chat:edit+chat:read+user:edit:broadcast`);
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
        client.connect()
        .catch((error) => {
            if(error.includes('Login authentication failed')) {
                let errorString = `Invalid token. Please get a new token and update bot settings.`;
                statusMsg('error', errorString);
                win.webContents.executeJavaScript(`showPage('settings')`);
                win.webContents.executeJavaScript(`alertMsg(true, 'error', '${errorString}')`);        
            }
            else {
                statusMsg('error', `Error connecting: ${error}`);
            }
            return;
        });
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

        pubsubSocket.onopen = async function(e) {
            await botSettingsDB.sync();
            let botset = await botSettingsDB.findOrCreate({where: {id: 1}}); 
            botSettings = botset[0];  
            
            if(botSettings !== undefined) {
                try {
                    let channelId = await twitchAPI.getChannelID(botSettings.channel, botSettings.clientId, botSettings.token);
                    nonce = crypto.randomBytes(32).toString('hex');
                    console.log(nonce);       
                    // nonce: "44h1k13746815ab1r2",
                    let connectMsg =  {
                        type: "LISTEN",
                        nonce: nonce,
                        data:  {
                        topics: [`channel-points-channel-v1.${channelId}`, `channel-bits-events-v2.${channelId}`],
                        // topics: [`channel-points-channel-v1.${channelId}`, `channel-bits-events-v2.${channelId}`, `channel-subscribe-events-v1.${channelId}`], // token doesn't have scope
                        auth_token: botSettings.token
                        }
                    };
                    pubsubSocket.send(JSON.stringify(connectMsg));
                    console.log(`Pubsub connected. Listed topics: ${connectMsg.data.topics}`);
                    pubsubPings();
                }
                catch(error) {console.log(error);}
            }
        };
        
        win.webContents.executeJavaScript(`updateSoundsList()`);
        // win.webContents.executeJavaScript(`showPage('home')`);        
        win.webContents.executeJavaScript(`showPage('hue')`);
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

    win.loadFile('index.html');
    win.setMenu(null);
    win.webContents.openDevTools(); // TO DO - comment out before commit 
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

async function reloadHueSettings() {
    hueSettings = {};
    hueBitsAlertsSettings = {};
    hueSubsAlertsSettings = {};
    hueChannelPointsAlertsSettings = {};    

    hueSettings = await getHueSettings(hueSettingsFile);
    hueBitsAlertsSettings = await getHueSettings(hueBitsAlertsSettingsFile);
    hueSubsAlertsSettings = await getHueSettings(hueSubsAlertsSettingsFile);
    hueChannelPointsAlertsSettings = await getHueSettings(hueChannelPointsAlertsSettingsFile);
}

ipcMain.handle('setHueAlertsSettings', async(event, args) => {
    let settingsFileToChange = null;
    let newSettings = args.newSettings;
    if(args.type == 'bits') {
        settingsFileToChange = hueBitsAlertsSettingsFile;
    }
    else if(args.type == 'subs') {
        settingsFileToChange = hueSubsAlertsSettingsFile;
    }
    else if(args.type == 'channelPoints') {
        settingsFileToChange = hueChannelPointsAlertsSettingsFile;
    }
    if(settingsFileToChange !== null) {
        for(x in newSettings) {
            await setHueSettings(settingsFileToChange, x, newSettings[x]);
        }
    }
});

ipcMain.handle('getHueAlertsSettings', async(event, args) => {
    let settingsFileToRead = null;
    if(args == 'bits') {
        settingsFileToRead = hueBitsAlertsSettingsFile;
    }
    else if(args == 'subs') {
        settingsFileToRead = hueSubsAlertsSettingsFile;
    }
    else if(args == 'channelPoints') {
        settingsFileToRead = hueChannelPointsAlertsSettingsFile;
    }    
    if(settingsFileToRead !== undefined || settingsFileToRead !== null) {
        let hueBitsAlertsSettings = await getHueSettings(settingsFileToRead);
        return hueBitsAlertsSettings;
    }
});

ipcMain.handle('getAllLights', async(event) => {
    await reloadHueSettings();
    let lights = await getAllLights(hueSettings.bridgeIP, hueSettings.username);
    let returnResult = {};
    if(lights !== undefined) {
        returnResult = {
            success: true,
            hueLights: lights
        };
    }
    else {
        returnResult = { success: false };
    }
    return returnResult;
});

ipcMain.handle('hueSettings', async (event, args) => {
    let returnResult = {};
    await reloadHueSettings();
    if(hueSettings === undefined && args.command != 'setHueSetting') {
        returnResult.success = false;
        returnResult.message = 'HUE settings file does not exist. Please set an IP and create a bridge user.';
        return returnResult;
    }
    if(args.command == 'setHueSetting') {
        let result = await setHueSettings(hueSettingsFile, args.setting, args.newValue);
        await reloadHueSettings();
        if(result) {
            returnResult.success = true;
        }   
        else {
            returnResult.success = false;
        }
    }    
    if(args.command == 'getHueSettings') {
        await reloadHueSettings();
        // console.log(hueSettings);
        if(hueSettings !== undefined) {
            returnResult.success = true,
            returnResult.hueSettings = hueSettings
        }
        else {
            returnResult.success = false
        }
    }
    else if(args.command == 'createUser') {
        let newHueUser = await createBridgeUser(hueSettings.bridgeIP, `VariBot`); 
        if(newHueUser.created) {
            hueSettings.username = newHueUser.username;
            // console.log(`Created hue username ${hueSettings.username}`);
            await setHueSettings(hueSettingsFile, 'username', hueSettings.username);
            await reloadHueSettings();
            returnResult.success = true;
            returnResult.hueSettings = hueSettings;
        }
        else {
            returnResult.success = false;
            returnResult.message = newHueUser.message;
        }
    }
    return returnResult;
});

ipcMain.handle('hueControls', async (event, args) => {

    if(args.command == 'colorLoop') {
        await colorLoop(args.bridgeIP, args.username, args.light, args.enabled);
    }
});

ipcMain.handle('runAd', async (event) => {
    let channelId = await twitchAPI.getChannelID(botSettings.channel, botSettings.clientId, botSettings.token);    
    if(channelId !== undefined) {
        const adResult = await twitchAPI.runAd(channelId, botSettings.clientId, botSettings.token, 90);
        // console.log(adResult);
        if(adResult.result) {
            statusMsg(`success`, `Running a ${adResult.adLength} second ad`);
            updateRecentEvents(`You ran a ${adResult.adLength} second ad. Next ad can run in ${adResult.retry_after} seconds.`);            
        }
        else {
            statusMsg(`error`, `Error running ad: ${adResult.message}`);
            if((adResult.message).search(`Missing scope`) !== -1) { 
                statusMsg(`error`, `Missing scope for command. Please create a new token by clicking Get Token in the settings page. DO NOT DO THIS WHILE LIVE!`);
            }
            updateRecentEvents(`Error running ad. Check status box below for details`);
        }
    }
});

ipcMain.handle('createStreamMarker', async (event) => {
    let channelId = await twitchAPI.getChannelID(botSettings.channel, botSettings.clientId, botSettings.token);    
    if(channelId !== undefined) {
        const markerResult = await twitchAPI.createStreamMarker(channelId, botSettings.clientId, botSettings.token, `Created from VariBot quick actions`)
        if(markerResult.result) { 
            statusMsg(`success`, `Created stream marker (ID: ${markerResult.id}) at ${markerResult.position_seconds} seconds`);
            updateRecentEvents(`You created a stream marker`);
        }
        else {
            statusMsg(`error`, `Error creating stream marker: ${markerResult.message}`);
            if((markerResult.message).search(`Missing scope`) !== -1) { 
                statusMsg(`error`, `Missing scope for command. Please create a new token by clicking Get Token in the settings page. DO NOT DO THIS WHILE LIVE!`);
            }            
            updateRecentEvents(`Error creating stream marker. Check status box below for details`);
        }
    }
});

ipcMain.handle('newSoundsSettings', async (event, args) => {
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

ipcMain.handle('botSettingsFromForm', async (event, args) => {
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
    if(args.beatSpreadSheetUrl !== undefined && args.beatSpreadSheetUrl.length > 1) {  
        try {
            let beatSheetInfo = getSpreadsheetInfo(args.beatSpreadSheetUrl);
            await updateBotSettings('beatSheetID', beatSheetInfo.worksheetId);
            await updateBotSettings('beatSpreadSheetID', beatSheetInfo.spreadsheetId);
        }
        catch(error) {
            console.log(error);
        }
    }
    if(args.beatGameSound.length > 1) {
        await updateBotSettings('beatGameSound', args.beatGameSound);
    }
    await botSettingsDB.sync();
    let updateMsg = `Settings updated. You will need to restart if your token was added or changed.`;
    statusMsg(`success`, updateMsg);
    updateRecentEvents(updateMsg);
    win.webContents.executeJavaScript(`alertMsg('true','success', '${updateMsg}')`);
    return true;
});

ipcMain.handle('loadSounds', async (event, args) => {
    await loadChannelPointsSounds();
    if(soundsDir.length > 1) {
        randomSounds = await loadSounds(soundsDir, channelPointsFilenames);
    }    
    let returnSounds = [...randomSounds, ...channelPointsFilenames];
    return returnSounds;
});

ipcMain.handle('getCurrentCommands', async (event, args) => {
    await loadCommands();
    return commands;
});

ipcMain.handle('getAbout', async (event, args) => {
    checkGoogleCreds();
    let aboutInfo = {
        versionNumber: versionNumber,
        randomSoundsCount: randomSounds.length,
        channelPointsSoundsCount: channelPointsFilenames.length,
        googleCredsExist: googleCredsExist,
        nonce: nonce
    }
    return aboutInfo;
});

ipcMain.handle('updateCmdSettings', async (event, args) => {
    let newCmdSettings = args;
    for(key in newCmdSettings) {
        await updateCommand(newCmdSettings[key].name, 'enabled', newCmdSettings[key].enabled); 
    }
});

ipcMain.handle('getCurrentSettings', async (event, args) => {
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

ipcMain.handle('getSoundsSettings', async (event, args) => {

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

ipcMain.handle('playRandomSound', (event) => {
    let soundName = playRandomSound();
    updateRecentEvents(`You played random sound ${soundName}`);
});

ipcMain.handle('saveGoogleCredsFile', (event, args) => {
    try {
        fs.copyFileSync(args, googleCredsFilePath);
        statusMsg('success', 'Google creds file saved.');
        win.webContents.executeJavaScript(`alertMsg(true, 'success', 'Google creds file saved.')`);
        checkGoogleCreds();
        return true;
    }
    catch(error) {
        statusMsg('error', `Error saved google creds file: ${error}`);
        win.webContents.executeJavaScript(`alertMsg(true, 'error', 'Error saving Google creds file. See status box for details.')`);
        checkGoogleCreds();
        return false;
    }
});

function statusMsg(msgType, msg) { 
    let sendMsg = {
        type: msgType,
        message: msg
    }
    win.webContents.send('status', sendMsg);
    console.log(msg);
}

function updateRecentEvents(msg) {
    win.webContents.send('updateRecentEvents', msg);
}

// electron end

// pubsub start

function playRandomSound() { 
    let randomIndex = Math.floor(Math.random() * Math.floor(randomSounds.length));
    let randomSound = randomSounds[randomIndex];
    win.webContents.executeJavaScript(`playSound('${randomSound}')`);
    statusMsg(`info`, `Playing sound ${randomSound}`); 
    return randomSound;
}

async function proecssReward(reward) {
    statusMsg(`reward`, 'Reward ' + reward.data.redemption.reward.title + ' was redeemed by ' + reward.data.redemption.user.display_name + ' for ' + reward.data.redemption.reward.cost + ' points');
    if(reward.data.redemption.reward.title.toLowerCase() == 'random sound') {
        // add a while loop to re-roll random if it picks the same sound twice or the beat game sound
        let soundName = playRandomSound();
        updateRecentEvents(`${reward.data.redemption.user.display_name} played random sound ${soundName}`);
    }
    else {
        for(let x in channelPointsSounds) {
            if(channelPointsSounds[x].name.toLowerCase() == reward.data.redemption.reward.title.toLowerCase()) {
                win.webContents.executeJavaScript(`playSound('${channelPointsSounds[x].filename}')`);
                statusMsg(`info`, `Playing sound ${channelPointsSounds[x].name} (${channelPointsSounds[x].filename})`);
                updateRecentEvents(`${reward.data.redemption.user.display_name} played sound ${channelPointsSounds[x].filename}`);
                break;
            }   
        }
    }
    if(reward.data.redemption.reward.title.toLowerCase() == 'color loop') {
        await reloadHueSettings();
        for(light in hueChannelPointsAlertsSettings) {
            if(light != 'mode' && hueChannelPointsAlertsSettings[light]) {
                await colorLoop(hueSettings.bridgeIP, hueSettings.username, light, true);
                statusMsg('info', `Enabled color loop on light ${light}`);                
                setTimeout((x) => {
                    statusMsg('info', `Disabled color loop on light ${x}`);
                    colorLoop(hueSettings.bridgeIP, hueSettings.username, x, false);
                }, 60000, light);
            }
        }
    }
    if(reward.data.redemption.reward.title.toLowerCase() == 'light color') {
        if(reward.data.redemption.user_input !== undefined) {
            let userColor = reward.data.redemption.user_input.toLowerCase();
            console.log(`Searching for ${userColor}`);
            let colorMatches = [];
            let colorMatchesCount = 0;
            for(let searchColor in hueColors) {
                if(searchColor.toLowerCase().includes(userColor)) {
                    // console.log(`Match: ${searchColor} (${hueColors[searchColor]})`);
                    colorMatchesCount++;
                    colorMatches.push(hueColors[searchColor]);
                }
            }
            // console.log(colorMatches);
            if(colorMatchesCount > 0) {
                newColor = colorMatches[randomNumber(0, (colorMatches.length - 1))];
            }
            else { 
                console.log(`Can't find color ${userColor}, picking a random color instead.`);
                let allColors = [];
                for(let searchColor in hueColors) {
                    allColors.push(hueColors[searchColor]);
                }
                newColor = allColors[randomNumber(0, (allColors.length -1))];                
            }
        }
        else {
            // no text so pick a random color - reward should require text. you should not get here. 
            let allColors = [];
            for(let searchColor in hueColors) {
                allColors.push(hueColors[searchColor]);
            }
            newColor = allColors[randomNumber(0, (allColors.length -1))];                
        }
        // console.log(`Picked color ${newColor}`);        
        await reloadHueSettings();
        for(light in hueChannelPointsAlertsSettings) {
            if(light != 'mode' && hueChannelPointsAlertsSettings[light]) {
                let oldLightInfo = await getLight(hueSettings.bridgeIP, hueSettings.username, light);
                let oldLightColor = oldLightInfo.state.xy;
                // console.log(`Old light color: ${oldLightColor}`);
                statusMsg('info', `Changing light ${light} color to ${newColor}`);
                await setLightColor(hueSettings.bridgeIP, hueSettings.username, newColor, light);
                setTimeout((light, oldLightColor) => {
                    statusMsg('info', `Resetting light ${light} to ${oldLightColor}`);
                    setLightColor(hueSettings.bridgeIP, hueSettings.username, oldLightColor, light);
                }, 60000, light, oldLightColor);             
            }
        }
    }
}

async function pubsubHandle(msg) {
    // console.log(msg);
    if(msg.type == 'MESSAGE') {
        pubsubMessage = JSON.parse(msg.data.message);
        if(pubsubMessage.type == 'reward-redeemed') {
            await proecssReward(pubsubMessage);
        }
        if(msg.data.topic.includes('channel-bits-events-v2')) {
            console.log(pubsubMessage);
            console.log(`message was a cheer`);
            let bitsUser = pubsubMessage.user_name; 
            let bitsAmount = pubsubMessage.bits_used;
            console.log(`${bitsUser} cheered ${bitsAmount}`);
        }
        if(msg.data.topic.includes('channel-subscribe-events-v1')) {
            console.log(pubsubMessage);
            console.log(`message was a sub`);
            let subGift = pubsubMessage.is_gift;            
            let subContext = pubsubMessage.context; // resub, subgift (different from is_gift), anonsubgift            
            if(subGift) { 
                let subGiftedTo = pubsubMessage.recipient_user_name;   
                // anon gifts do not have the user_name field 
                console.log(`Subscription: ${subGiftedTo} was gifted a sub`);
            }
            else {
                let subUser = pubsubMessage.user_name;
                let subMonths = pubsubMessage.cumulative_months; // gifted might not have this (outdated docs?)
                let subMonthsStreak = pubsubMessage.streak_months; // gifted might not have this (outdated docs?)
                console.log(`Subscription: ${subUser} ${subMonths} Months (Streak: ${subMonthsStreak})`);                
            }
            
        }
    }
}

function pubsubPings() {
    pubsubSocket.send(JSON.stringify({type:"PING"}));
    setTimeout(pubsubPings,120000); // 2 minutes
}

pubsubSocket.onmessage = async function(event)  {
    pubsubResonse = JSON.parse(event.data);
    await pubsubHandle(pubsubResonse);
};

// pubsub end

app.on('ready', () => {
    autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on('update-available', () => {
    statusMsg(`info`, `Update available. Starting download.`);
});

autoUpdater.on('update-downloaded', () => {
    updateRecentEvents(`Update downloaded. Update will be installed next time the bot is closed.`);
});

startBot();

