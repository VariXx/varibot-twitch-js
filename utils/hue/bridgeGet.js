const fetch = require('node-fetch');

async function bridgeGet(bridgeIP, username, pathString) {
    let bridgeURL = `http://${bridgeIP}/api/${username}`;    
    const result = await fetch(`${bridgeURL}/${pathString}`, {method: 'GET'});
    const data = await result.json();    
    return data;
}

module.exports.bridgeGet = bridgeGet;
