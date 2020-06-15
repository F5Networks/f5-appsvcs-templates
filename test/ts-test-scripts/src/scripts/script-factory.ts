const IScript = require('./iscript');
const DeployApps = require('./deploy-apps');

module.exports = function ScriptFactory(scriptName:string, args:any[]): IScript {
    switch(scriptName) {
        case DeployApps.scriptName: {
            return new DeployApps(args);
        }
        default: {
            throw new Error(`Script does not exist! scriptName=${scriptName}`);
        }
    }
}