const fetch = require('node-fetch');

async function createBridgeUser(bridgeIP, deviceName) {
    let returnedBridgeUser = {
        created: false,
        message: 'unknown (invalid IP?)'
    };
    let bridgeUserBody = {
        devicetype: deviceName
    };
    const result = await fetch(`http://${bridgeIP}/api`, {
        method: 'post',
        body: JSON.stringify(bridgeUserBody)
    });
    const hueUser = await result.json();
    if(hueUser[0].hasOwnProperty('success')) {
        returnedBridgeUser.created = true;
        returnedBridgeUser.username = hueUser[0].success.username;
        returnedBridgeUser.message = 'user created';
    }
    if(hueUser[0].hasOwnProperty('error')) {
        returnedBridgeUser.message = hueUser[0].error.description;        
        // if((hueUser[0].error.description).includes('link button not pressed')) {
        //     returnedBridgeUser.message = hueUser[0].error.description;
        // }
    }
    return returnedBridgeUser;
}

module.exports.createBridgeUser = createBridgeUser;
