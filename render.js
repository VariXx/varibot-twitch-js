const ipc = require('electron').ipcRenderer;
const remote = require('electron').remote;
const { shell } = require('electron');

ipc.on('status', (event, msg) => {
    updateStatus(msg.type, msg.message);
});

ipc.on('updateRecentEvents', (event, msg) => {
    updateRecentEvents(msg);
});

async function loadGoogleCredsFile() {
    let win = remote.getCurrentWindow();
    let openOptions = {
        title: "Open Google Creds File",
        buttonLabel: "Open",
        filters: [{name: "JSON", extensions: ['json']}]
    };
    let selectedFile = await remote.dialog.showOpenDialogSync(win, openOptions);
    // console.log(selectedFile);
    let savedResult = await ipc.invoke('saveGoogleCredsFile', selectedFile[0]);
    console.log(savedResult);
    if(savedResult) {
        let googleCredsUploadButton = document.getElementById('googleCredsUploadButton'); 
        googleCredsUploadButton.innerHTML = `Google Creds File Saved &#10003;`
        googleCredsUploadButton.classList.add('btn-success');
        googleCredsUploadButton.classList.add('btn-secondary');
    }
    else {
        let googleCredsUploadButton = document.getElementById('googleCredsUploadButton'); 
        googleCredsUploadButton.innerHTML = `Error saving file &#10007;`
        googleCredsUploadButton.classList.add('btn-danger');
        googleCredsUploadButton.classList.add('btn-secondary');
    }
}

function updateRecentEvents(msg) {
    let recentList = document.getElementById('recentList');
    recentList.innerHTML = `<li class="list-group-item text-muted">${msg}</li> ${recentList.innerHTML}`;
}

function updateStatus(msgType, msg) {
    let msgColor = `text-white-75`;
    if(msgType == 'error') {        
        msgColor = `text-danger`;
    }
    else if(msgType == 'warning') {
        msgColor = `text-warning`;
    }
    else if(msgType == 'success') {
        msgColor = `text-success`;
    }
    else if(msgType == 'info') {
        msgColor = `text-white-75`;
    }    
    else if(msgType == 'special') {
        msgColor = `text-info`;
    }
    else if(msgType == 'reward') {
        msgColor = `text-info`;
    }
    else {
        msgColor = `text-white-75`;
    }
    
    let statusBox = document.getElementById('status')
    statusBox.innerHTML += `<span class="${msgColor}">${msg}</span><br>`;
    statusBox.scrollTop = statusBox.scrollHeight;
}

function minimizeWindow() {
    remote.getCurrentWindow().minimize();
}

async function loadSettings() {
    let result = ipc.sendSync('getSettings');
    return result;
}

function runAd() {
    ipc.invoke('runAd');
}

function createStreamMarker() {
    ipc.invoke('createStreamMarker');
}

function brb() {
    createStreamMarker();
    runAd();
}

async function updateSoundsList() { 
    let sounds = await ipc.invoke('loadSounds');
    let soundsHTML = ` `;
    if(sounds.length > 0){
        let buttonRowCount = 0;
        let buttonRows = 1;
        soundsHTML += `<table class="mx-auto">`;
        for(let s = 0; s < sounds.length; s++) {
            if(buttonRowCount == 3) {
                buttonRows++;
                buttonRowCount = 0;
                soundsHTML += `</tr><tr>`;
            }
            let soundName = sounds[s].replace('.mp3','');
            soundsHTML += `<td><button type="button" class="btn btn-secondary" style="height: 100%; width:100%;" onclick="playSound('${sounds[s]}')">${soundName}</button></td>`;
            buttonRowCount++;
        }
    }
    soundsHTML += `</tr></table>`;
    document.getElementById('soundsList').innerHTML = soundsHTML;
}

function playRandomSound() {
    ipc.invoke('playRandomSound');
}

async function playSound(sound) {
    let result = await ipc.invoke('getCurrentSettings');
    if(result !== undefined) {
        let audio = new Audio(`${result.soundsDir}\\${sound}`);
        try { audio.play(); }
        catch(err) { console.log(err); }
    }    
}

function checkWin() {
    ipc.send('checkWin');
}

async function externalLink(destination) {
    let result = await ipc.invoke('getCurrentSettings');   
    if(destination == 'token') {
        shell.openExternal(`https://id.twitch.tv/oauth2/authorize?client_id=rq2a841j8f63fndu5lnbwzwmbzamoy&redirect_uri=https://acceptdefaults.com/twitch-oauth-token-generator/&response_type=token&scope=bits:read+channel:read:redemptions+channel:moderate+chat:edit+chat:read+user:edit:broadcast+channel:edit:commercial`);
    }
    else if(destination == 'manageRewards') {
        shell.openExternal(`https://dashboard.twitch.tv/u/${result.username.toLowerCase()}/community/channel-points/rewards`);
    }
    else if(destination == 'wiki') {
        shell.openExternal(`https://github.com/VariXx/varibot-twitch-js/wiki`);
    }
    else if(destination == 'discord') {
        shell.openExternal(`https://discord.gg/QNppY7T`);
    }
    else if(destination == 'botSettingsHelp') {
        shell.openExternal(`https://github.com/VariXx/varibot-twitch-js/wiki/Settings#general-settings`);
    }
    else if(destination == 'googleSheetsHelp') {
        shell.openExternal(`https://github.com/VariXx/varibot-twitch-js/wiki/Settings#google-spreadsheets-settings`);
    }
}

// async function openTokenPage() { 
//     let result = await ipc.invoke('getCurrentSettings');
//     shell.openExternal(`https://id.twitch.tv/oauth2/authorize?client_id=rq2a841j8f63fndu5lnbwzwmbzamoy&redirect_uri=https://acceptdefaults.com/twitch-oauth-token-generator/&response_type=token&scope=bits:read+channel:read:redemptions+channel:moderate+chat:edit+chat:read+user:edit:broadcast`);
// }

// async function openChannelRewardsPage() {
//     let result = await ipc.invoke('getCurrentSettings');
//     shell.openExternal(`https://dashboard.twitch.tv/u/${result.username}/community/channel-points/rewards`);
// }

async function openSoundsDir() {
    let result = await ipc.invoke('getCurrentSettings');
    if(result !== undefined) {
        shell.openPath(`${result.soundsDir}`);
    }
}

function changeActiveTab(activeTab) { 
    let navbar = document.getElementById('navBar-left');
    let navList = navbar.getElementsByTagName('li');
    for(let x = 0; x < navList.length; x++) {
        if(navList[x].classList.contains('active')) {
            navList[x].classList.remove('active');
        }
    }
    let newActive = document.getElementById(`${activeTab}Nav`);
    newActive.classList.add('active');
}

async function hueControls(lightID, command, enabled) {
    const hueSettings = await getHueSettings;
    let sendCommand = {
        lightID: lightID,
        command: command,
        enabled: enabled,
        bridgeIP: hueSettings.bridgeIP,
        username: hueSettings.username
    };
    ipc.invoke('hueControls', sendCommand);
}

async function setHueSettings(setting, newValue) {
    let sendMsg = {
        command: 'setHueSetting',
        setting: setting,
        newValue: newValue
    };
    let response = await ipc.invoke('hueSettings', sendMsg);
    return response;
}

async function getHueSettings() {
    let sendMsg = { command: 'getHueSettings' };
    let response = await ipc.invoke('hueSettings', sendMsg);
    return response.hueSettings;
}

async function getAllLights() { 
    let response = await ipc.invoke('getAllLights');
    if(response) {
        return response.hueLights;
    }
    else {
        return false;
    }
}

async function saveBridgeIP() {
    let newBridgeIP = document.getElementById('bridgeIP').value;
    if(newBridgeIP.length > 7) { // it's an IP - "0.0.0.0" is 7 characters
        const result = await setHueSettings('bridgeIP', newBridgeIP);
        if(result.success) {
            updateStatus('success', `Saved HUE bridge IP ${newBridgeIP} to HUE settings.`);
            showPage('hue');
        }
    }
}

async function createHueUser() {
    let sendMsg = { command: 'createUser' };    
    let response = await ipc.invoke('hueSettings', sendMsg);
    if(response.success) {
        showPage('hue');
    }
    else {
        if(response.message.includes('link button not pressed')) {
            document.getElementById('hueCreateUserError').innerHTML += 'Press link button on bridge and try again';
        }
    }    
}

async function populateSettings(settingsPage) {
    if(settingsPage.toLowerCase() == 'home') { 
        // no settings 
    }
    if(settingsPage.toLowerCase() == 'settings') {
        let settingsPageHTML = `<div class="card my-4">
        <div class="card-header">General Settings</div>              
        <div class="card-body">
            <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
            <path d="M5.25 6.033h1.32c0-.781.458-1.384 1.36-1.384.685 0 1.313.343 1.313 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.007.463h1.307v-.355c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.326 0-2.786.647-2.754 2.533zm1.562 5.516c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
          </svg></h4>
          <form id="settingsForm">
            <div class="form-group">
              <label for="botUsername">Username</label>
              <input type="text" class="form-control" id="botUsername" placeholder="Enter username">
              <small id="botUsernameHelp" class="form-text text-muted">Username used by the bot</small>
            </div>
            <div class="form-group">
              <label for="botToken">Token</label>
              <input type="password" class="form-control" id="botToken" placeholder="Enter token">
              <small id="botTokenHelp" class="form-text text-muted">Token (not password) used for the bot. See below for link to get token.</small>
            </div>
            <div class="form-group">
              <label for="clientId">Client ID</label>
              <input type="text" class="form-control" id="clientId" placeholder="Enter client ID" value="rq2a841j8f63fndu5lnbwzwmbzamoy">
              <small id="clientIdHelp" class="form-text text-muted">Client ID for the bot. If you don't know what this is you can leave it as default. (Default: rq2a841j8f63fndu5lnbwzwmbzamoy)</small>
            </div>              
            <div class="form-group">
              <label for="channel">Channel</label>
              <input type="text" class="form-control" id="channel" placeholder="Enter channel">
              <small id="channelHelp" class="form-text text-muted">Channel for the bot to join. Do not include #. (ex: varixx)</small>
            </div>      
        </div>  
      </div>
      <div class="card my-4">
        <div class="card-header">Google Spreadsheets Settings</div>              
        <div class="card-body">
            <!-- <h4 class="card-title">Google Spreadsheets Settings <svg width=".75em" height=".75em" viewBox="0 0 16 16" class="bi bi-question-circle" fill="currentColor" xmlns="http://www.w3.org/2000/svg" onclick="externalLink('googleSheetsHelp')"> -->
              <path fill-rule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
              <path d="M5.25 6.033h1.32c0-.781.458-1.384 1.36-1.384.685 0 1.313.343 1.313 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.007.463h1.307v-.355c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.326 0-2.786.647-2.754 2.533zm1.562 5.516c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z"/>
            </svg></h4>
            <div class="form-group">
              <label for="beatSpreadSheetUrl">Completed games spreadsheet URL</label>
              <input type="text" class="form-control" id="beatSpreadSheetUrl" placeholder="https://docs.google.com/spreadsheets/d/<spreadsheet-id>/edit#gid=<worksheet-id>">
              <small id="beatSpreadSheetUrlHelp" class="form-text text-muted">Full URL of completed games spreadsheet in Google Drive.</small>              
            </div>              
            <div class="form-group">
              <label for="beatGameSound">Beat game sound</label>
              <input type="text" class="form-control" id="beatGameSound" placeholder="Enter filename">
              <small id="beatGameSoundHelp" class="form-text text-muted">Sound played after adding game to completed games spreadsheet. This must be in the sounds directory listed above. Filename (including .mp3) only.</small>
            </div>     
            </form><button class="btn btn-primary btn-sm" onclick="saveSettingsFromForm()">Save</button><button class="btn btn-danger btn-sm ml-2" onclick="externalLink('token')">Get Token</button><button class="btn btn-secondary btn-sm ml-2" id="googleCredsUploadButton" onclick="loadGoogleCredsFile()">Save Google Creds File</button>
        </div>  
      </div>`;
      document.getElementById('settings').innerHTML = settingsPageHTML;      
        let result = await ipc.invoke('getCurrentSettings');
        if(result !== undefined) {
            document.getElementById('botUsername').value = result.username;
            document.getElementById('botToken').value = result.token;
            document.getElementById('clientId').value = result.clientId;
            document.getElementById('channel').value = result.channel;
            if(result.beatSpreadSheetID !== undefined && result.beatSpreadSheetID !== null) {
                if(result.beatSheetID !== undefined && result.beatSheetID !== null) {
                    if(result.beatSpreadSheetID.length > 1 && result.beatSheetID.length > 1) {
                        let spreadSheetUrl = `https://docs.google.com/spreadsheets/d/${result.beatSpreadSheetID}/edit#gid=${result.beatSheetID}`;
                        document.getElementById('beatSpreadSheetUrl').value = spreadSheetUrl; 
                    }
                }
            }
            document.getElementById('beatGameSound').value = result.beatGameSound;
        }
        if(result.clientId === null) {
            document.getElementById('clientId').value = `rq2a841j8f63fndu5lnbwzwmbzamoy`;
        }
    }
    if(settingsPage.toLowerCase() == 'sounds') {
        await ipc.invoke('loadSounds');        
        let result = await ipc.invoke('getSoundsSettings');
        let soundsPageHTML = `<div class="card"><div class="card-header">Sounds</div><div class="card-body">`;
        if(result !== undefined) {
            soundsPageHTML += `<button type="submit" class="btn btn-primary btn-sm mr-2 mb-4" onclick="saveSoundsForm()">Save</button><button class="btn btn-primary btn-sm mr-2 mb-4" onclick="openSoundsDir()"><svg class="bi bi-folder-symlink" width="1em" height="1em" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M9.828 4a3 3 0 0 1-2.12-.879l-.83-.828A1 1 0 0 0 6.173 2H2.5a1 1 0 0 0-1 .981L1.546 4h-1L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3v1z"/>
            <path fill-rule="evenodd" d="M13.81 4H2.19a1 1 0 0 0-.996 1.09l.637 7a1 1 0 0 0 .995.91h10.348a1 1 0 0 0 .995-.91l.637-7A1 1 0 0 0 13.81 4zM2.19 3A2 2 0 0 0 .198 5.181l.637 7A2 2 0 0 0 2.826 14h10.348a2 2 0 0 0 1.991-1.819l.637-7A2 2 0 0 0 13.81 3H2.19z"/>
            <path d="M8.616 10.24l3.182-1.969a.443.443 0 0 0 0-.742l-3.182-1.97c-.27-.166-.616.036-.616.372V6.7c-.857 0-3.429 0-4 4.8 1.429-2.7 4-2.4 4-2.4v.769c0 .336.346.538.616.371z"/>
          </svg> Open sounds folder</button><button class="btn btn-primary btn-sm mr-2 mb-4" onclick="externalLink('manageRewards')"> Manage Channel Rewards</button><form id="soundsForm"><table class="table table-hover"><thead><tr><th scope="col">Filename</th><th scope="col">Reward Name (leave unchecked for random)</th></tr></thead><tbody>`;
            let randomSounds = result.random; 
            if(Object.keys(result.rewards).length > 0) {
                for(let sound in result.rewards) {
                    soundsPageHTML += `<tr id="${result.rewards[sound].filename}"><td id="filename"><svg onclick="playSound('${result.rewards[sound].filename}')" width="20px" height="20px" viewBox="0 0 16 16" class="bi bi-play mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" d="M10.804 8L5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>
                  </svg>${result.rewards[sound].filename}</td><td><div class="input-group">
                    <div class="input-group-prepend"><div class="input-group-text"><input type="checkbox" checked>
                    </div></div>
                    <input type="text" class="form-control" value="${result.rewards[sound].name}"></div></td></tr>`;                    
                }
            }               
            if(randomSounds.length > 0) {
                for(let s = 0; s < randomSounds.length; s++) {
                    soundsPageHTML += `<tr id="${randomSounds[s]}"><td id="filename"><svg onclick="playSound('${randomSounds[s]}')" width="20px" height="20px" viewBox="0 0 16 16" class="bi bi-play mr-2" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <path fill-rule="evenodd" d="M10.804 8L5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>
                  </svg>${randomSounds[s]}</td><td><div class="input-group">
                    <div class="input-group-prepend"><div class="input-group-text"><input type="checkbox">
                    </div></div>
                    <input type="text" class="form-control"></div></td></tr>`;
                }
            }
            soundsPageHTML += `</tbody></table></form><button type="submit" class="btn btn-primary btn-sm" onclick="saveSoundsForm()">Save</button>`;
        }
        soundsPageHTML += `</div></div>`;
        document.getElementById('sounds').innerHTML = soundsPageHTML;
    }
    if(settingsPage.toLowerCase() == 'cmds') {
        let result = await ipc.invoke('getCurrentCommands');
        let cmdPageHTML = `<div class="card"><div class="card-header">Commands</div>`;
        if(result !== undefined) {
            cmdPageHTML += `<div class="card-body" id="cmdsBody">`;            
            if(Object.keys(result)) {                
                cmdPageHTML += `<form id="cmdForm"><table class="table table-hover" style="table-layout:auto;"><tbody>`;
                for(let cmd in result) { 
                    cmdPageHTML += `<tr id="${result[cmd].name}"><td style="width: 5px; text-align: center;">`;
                    if(result[cmd].enabled) {
                        cmdPageHTML += `<input type="checkbox" checked id="cmdStatus">`;
                    }
                    else {
                        cmdPageHTML += `<input type="checkbox" id="cmdStatus">`;
                    }
                    cmdPageHTML += `</td><td id="cmdName">${result[cmd].name}</td></tr>`;
                }
                cmdPageHTML += `</tbody></table></form><button type="submit" class="btn btn-primary btn-sm mt-2" onclick="saveCmdForm()">Save</button>`;
                
            }
            cmdPageHTML += `</div>`;
        }
        document.getElementById('cmds').innerHTML = cmdPageHTML;
    }
    if(settingsPage.toLowerCase() == 'hue') {
        // get and populate hue settings
        let huePageHTML = `<div class="card my-4"><div class="card-header">HUE</div><div class="card-body">`;
        const hueSettings = await getHueSettings();
        // console.log(hueSettings);   
        huePageHTML += `<div class="form-group><label for="bridgeIP">Bridge IP</label>
        <div class="input-group mb-3"><input type="text" class="form-control" placeholder="Bridge IP" id="bridgeIP">
            <div class="input-group-append"><button class="btn btn-primary" type="button" onclick="saveBridgeIP()">Save</button></div></div></div>`;    
        if(hueSettings !== undefined) {        
            if(hueSettings.bridgeIP !== undefined) {
                huePageHTML += `<button class="btn btn-primary btn-sm" onclick="createHueUser()">Create bridge user</button><span class="font-weight-bold text-danger ml-4" id="hueCreateUserError"></span>`; // you might still need this if it already exists
                if(hueSettings.username !== undefined) {
                    // huePageHTML += `                    
                    // <button class="btn btn-primary btn-sm" onclick="hueControls('colorLoop', true)">Color Loop on</button>
                    // <button class="btn btn-primary btn-sm" onclick="hueControls('colorLoop', false)">Color Loop off</button>`;
                    // <button class="btn btn-primary btn-sm" onclick="getHueLights()">Get Lights</button>
                    let hueLights = await getAllLights();
                    if(hueLights !== undefined) {
                        huePageHTML += `<table class="table table-hover mx-auto my-4" style="width:80%" id="lightsTable"><thead><tr><th>ID</th><th>Name</th><th>State</th><th>Bits</th><th>Subs</th><th>Channel points</th></thead></tr>`;
                        for(ID in hueLights) {
                            huePageHTML += `<tr><td>${ID}</td><td>${hueLights[ID].name}</td><td>${hueLights[ID].state.on}</td>
                            <td><div class="custom-control custom-switch mx-auto">
                            <input type="checkbox" class="custom-control-input" name="bitsAlertEnabled" id="bitsAlertsEnabled${ID}">
                            <label class="custom-control-label" for="bitsAlertsEnabled${ID}"></label>
                            </div></td>
                            <td><div class="custom-control custom-switch mx-auto">
                            <input type="checkbox" class="custom-control-input" name="subsAlertEnabled" id="subsAlertsEnabled${ID}">
                            <label class="custom-control-label" for="subsAlertsEnabled${ID}"></label>
                            </div></td>
                            <td><div class="custom-control custom-switch mx-auto">
                            <input type="checkbox" class="custom-control-input" name="channelPointsAlertEnabled" id="channelPointsAlertsEnabled${ID}">
                            <label class="custom-control-label" for="channelPointsAlertsEnabled${ID}"></label>
                            </div></td>
                            </tr>`;
                        }
                        huePageHTML += `</table>`;
                        huePageHTML += `<div class="row mx-auto my-4" style="width:80%">
                            <div class="col">
                                Bits Alert Mode
                                <select class="form-control" id="bitsAlertsMode">
                                <option value="solid">Solid color</option>
                                <option value="random">Random</option>
                                <option value="randomPerLight">Random (per light)</option>
                                </select>
                            </div>                        
                            <div class="col">
                                Sub Alert Mode
                                <select class="form-control" id="subsAlertsMode">
                                <option value="solid">Solid color</option>
                                <option value="random">Random</option>
                                <option value="randomPerLight">Random (per light)</option>
                                </select>
                            </div>
                            <div class="col">
                                Channel Points Alert Mode
                                <select class="form-control" id="channelPointsAlertsMode">
                                <option value="solid">Solid color</option>
                                <option value="random">Random</option>
                                <option value="randomPerLight">Random (per light)</option>         
                                </select>
                            </div>
                        </div>`;
                        huePageHTML += `<button class="btn btn-primary" onclick="saveHueSettings()">Save</button></div></div>`;
                    }
                }
            }
        }
        // huePageHTML += `

        // <button class="btn btn-primary btn-sm" onclick="getHueSettings()">Get Settings</button>
        // <button class="btn btn-primary btn-sm" onclick="setHueSettings('bridgeIP', '10.0.0.9')">Set bridge IP</button>
        
        // <span class="hueErrors"></span>
        // </div></div>`;
        document.getElementById('hue').innerHTML = huePageHTML;
        if(hueSettings !== undefined && hueSettings.bridgeIP !== undefined) { 
            document.getElementById('bridgeIP').value = `${hueSettings.bridgeIP}`;
        }
        // TO DO - make a function for these instead of repeating 
        let hueBitsAlerts = await getHueAlertsSettings('bits');
        for(x in hueBitsAlerts) {
            if(hueBitsAlerts[x]) {
                if(x == 'mode') {
                    let findElement = document.getElementById('bitsAlertsMode');
                    let findOption = findElement.getElementsByTagName('option');
                    for(let y = 0; y < findOption.length; y++) {
                        if(findOption[y].value == hueBitsAlerts.mode) {
                            findOption[y].selected = true;
                        }
                    }
                }
                else {
                    let findElement = document.getElementById(`bitsAlertsEnabled${x}`);               
                    if(findElement !== undefined) {
                        findElement.checked = true;
                    }
                }
            }
        }
        let hueSubsAlerts = await getHueAlertsSettings('subs');
        for(x in hueSubsAlerts) {
            if(hueSubsAlerts[x]) {
                if(x == 'mode') {
                    let findElement = document.getElementById('subsAlertsMode');
                    let findOption = findElement.getElementsByTagName('option');
                    for(let y = 0; y < findOption.length; y++) {
                        if(findOption[y].value == hueSubsAlerts.mode) {
                            findOption[y].selected = true;
                        }
                    }
                }
                else {
                    let findElement = document.getElementById(`subsAlertsEnabled${x}`);               
                    if(findElement !== undefined) {
                        findElement.checked = true;
                    }
                }
            }
        }
        let hueChannelPointsAlerts = await getHueAlertsSettings('channelPoints');
        for(x in hueChannelPointsAlerts) {
            if(hueChannelPointsAlerts[x]) {
                if(x == 'mode') {
                    let findElement = document.getElementById('channelPointsAlertsMode');
                    let findOption = findElement.getElementsByTagName('option');
                    for(let y = 0; y < findOption.length; y++) {
                        if(findOption[y].value == hueChannelPointsAlerts.mode) {
                            findOption[y].selected = true;
                        }
                    }
                }
                else {
                    let findElement = document.getElementById(`channelPointsAlertsEnabled${x}`);               
                    if(findElement !== undefined) {
                        findElement.checked = true;
                    }
                }
            }
        }
        // get current settings for all alert modes and change current option to selected. search for selects by id and add selected property to the option.        
    }
    if(settingsPage.toLowerCase() == 'about') {
        let result = await ipc.invoke('getAbout');
        let aboutPageHTML = `<div class="card"><div class="card-header">About</div>`;
        aboutPageHTML += `<div class="card-body text-muted">
        <p>VariBot v${result.versionNumber}</p>
        <p>Random sounds loaded: ${result.randomSoundsCount}</p>
        <p>Channel reward sounds loaded: ${result.channelPointsSoundsCount}</p>
        <p>Google creds file loaded: ${result.googleCredsExist}</p>
        </div></div>`;
        document.getElementById('about').innerHTML = aboutPageHTML;
    }

}

async function updateHueAlertsSettings(alertType, newAlertsSettings) {
    let sendMsg = {
        type: alertType,
        newSettings: newAlertsSettings
    };
    ipc.invoke('setHueAlertsSettings', sendMsg);
}

async function getHueAlertsSettings(alertType) {
    const result = await ipc.invoke('getHueAlertsSettings', alertType);
    return result;
}

async function saveHueSettings() {
    
    let bitsAlertSettings = {};
    let bitsAlerts = document.getElementsByName('bitsAlertEnabled');
    for(let x = 0; x < bitsAlerts.length; x++) {
        let lightID = (bitsAlerts[x].id).replace('bitsAlertsEnabled', '');
        if(bitsAlerts[x].checked) {            
            bitsAlertSettings[lightID] = true;
        }
        else {
            bitsAlertSettings[lightID] = false;
        }
    }
    let bitsAlertsMode = document.getElementById('bitsAlertsMode').value;
    bitsAlertSettings.mode = bitsAlertsMode;
    console.log(bitsAlertSettings);
    updateHueAlertsSettings('bits', bitsAlertSettings);

    let subsAlertSettings = {};
    let subsAlerts = document.getElementsByName('subsAlertEnabled');
    for(let x = 0; x < subsAlerts.length; x++) {
        let lightID = (subsAlerts[x].id).replace('subsAlertsEnabled', '');
        if(subsAlerts[x].checked) {            
            subsAlertSettings[lightID] = true;
        }
        else {
            subsAlertSettings[lightID] = false;
        }
    }
    let subsAlertsMode = document.getElementById('subsAlertsMode').value;
    subsAlertSettings.mode = subsAlertsMode;
    console.log(subsAlertSettings);
    updateHueAlertsSettings('subs', subsAlertSettings);

    let channelPointsAlertSettings = {};
    let channelPointsAlerts = document.getElementsByName('channelPointsAlertEnabled');
    for(let x = 0; x < channelPointsAlerts.length; x++) {
        let lightID = (channelPointsAlerts[x].id).replace('channelPointsAlertsEnabled', '');
        if(channelPointsAlerts[x].checked) {            
            channelPointsAlertSettings[lightID] = true;
        }
        else {
            channelPointsAlertSettings[lightID] = false;
        }
    }
    let channelPointsAlertsMode = document.getElementById('channelPointsAlertsMode').value;
    channelPointsAlertSettings.mode = channelPointsAlertsMode;
    console.log(channelPointsAlertSettings);
    updateHueAlertsSettings('channelPoints', channelPointsAlertSettings);

    // create functions commented out above to save alert settings in main and render 

}

async function saveCmdForm() {
    let cmdForm = document.getElementById('cmdForm');
    let cmdTRs = cmdForm.getElementsByTagName('tr');
    let cmdChanges = {};
    for(let x = 0; x < cmdTRs.length; x++) { 
        let cmdName = cmdTRs[x].getElementsByTagName('td')['cmdName'].innerText.trim();
        let cmdStatus = cmdTRs[x].getElementsByTagName('input')['cmdStatus'].checked;
        cmdChanges[cmdName] = {
            name: cmdName,
            enabled: cmdStatus
        }
    }
    await ipc.invoke('updateCmdSettings', cmdChanges);
    alertMsg(true, 'success', 'Commands updated');
    showPage('cmds');
}

function alertMsg(status, eventType, msg) {
    let alertBox = document.getElementById('alertBox');
    let alertBoxText = document.getElementById('alertBoxText');
    let alertMessage = '';
    alertBox.classList.remove('alert-primary');
    alertBox.classList.remove('alert-success');
    alertBox.classList.remove('alert-danger');
    alertBox.classList.remove('alert-warning');
    if(eventType == 'error') {
        
        alertBox.classList.add('alert-danger');
        alertMessage = 'Error: ';
    }
    else if(eventType == 'warning') {
        alertBox.classList.add('alert-warning');
        alertMessage = 'Warning: ';
    }
    else if(eventType == 'success') {
        alertBox.classList.add('alert-success');
    }
    else if(eventType == 'info') {
        alertBox.classList.add('alert-primary');
    }    
    else {
        alertBox.classList.add('alert-primary');
    }
    alertMessage += msg;    
    alertBoxText.innerText = alertMessage;    
    if(status) {
        alertBox.style.display = 'block';
    }
    else {
        alertBox.style.display = 'none';
    }
}

async function saveSoundsForm() {
    let soundsForm = document.getElementById('soundsForm');
    let soundsTRs = soundsForm.getElementsByTagName('tr');
    let newChannelPointsSounds = {};
    let newRandomSounds = [];
    for(let x = 1; x < soundsTRs.length; x++) { // skip 0, it's the header
        let filename = (soundsTRs[x].childNodes[0].innerText).trim();
        let rewardName = (soundsTRs[x].childNodes[1].childNodes[0].childNodes[3].value).trim();
        let rewardEnabled = soundsTRs[x].childNodes[1].childNodes[0].childNodes[1].childNodes[0].childNodes[0].checked;
        if(rewardEnabled) {
            newChannelPointsSounds[rewardName] = {
                name: rewardName,
                filename: filename
            }
        }
        else {
            newRandomSounds.push(filename);
        }    
    }
    let newSoundsSettings = [newChannelPointsSounds, newRandomSounds];
    await ipc.invoke('newSoundsSettings', newSoundsSettings);
    alertMsg(true, 'success', 'Sounds updated');
    showPage('sounds');
}

async function showPage(page) {
    let pages = ['home','settings','sounds','cmds', 'hue', 'about'];
    let showPage;
    for(let p = 0; p < pages.length; p++) { 
        if(pages[p] == page.toLowerCase()) {
            showPage = pages[p];
        }
        document.getElementById(pages[p]).style.display = 'none';
    }
    await populateSettings(showPage);
    changeActiveTab(showPage);
    document.getElementById(showPage).style.display = 'block';
}

function saveSettingsFromForm() {
    let settingsForm = document.getElementById('settingsForm');
    let botSettingsFromForm = {
        botUsername: botUsername.value,
        botToken: botToken.value,
        clientId: clientId.value,
        channel: channel.value,
        beatGameSound: beatGameSound.value
    }
    if(beatSpreadSheetUrl.value !== undefined && beatSpreadSheetUrl.value.length > 1) {
        let checkSpreadSheetUrl = beatSpreadSheetUrl.value.search(`https://docs.google.com/spreadsheets/d/`);
        if(checkSpreadSheetUrl !== -1) {
            botSettingsFromForm.beatSpreadSheetUrl = beatSpreadSheetUrl.value;
        }
        else {
            updateStatus('error', 'Invalid Google Spreadsheet URL');
        }
    }    
    let result = ipc.invoke('botSettingsFromForm', botSettingsFromForm);
    showPage('home');
}

function closeBot() {
    const botWindow = remote.getCurrentWindow();
    botWindow.close();
}

// async function closeBot() {
//     alertMsg(true, 'info', 'Shutting down...');
//     await ipc.invoke('closeBot');
// }
