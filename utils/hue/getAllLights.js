const { bridgeGet } = require('./bridgeGet');

async function getAllLights(bridgeIP, username) {
    let result = await bridgeGet(bridgeIP, username, `lights/`);
    return result;
}

module.exports.getAllLights = getAllLights;
