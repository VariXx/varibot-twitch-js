const fetch = require('node-fetch');

async function bridgePut(bridgeIP, username, pathString, payload) {
    let bridgeURL = `http://${bridgeIP}/api/${username}`;    
    const result = await fetch(`${bridgeURL}/${pathString}`, {method: 'PUT', body: JSON.stringify(payload)});   
    return result; 
}

module.exports.bridgePut = bridgePut;
