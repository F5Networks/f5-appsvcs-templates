const ScriptFactory = require('./scripts/script-factory');
// import {Promise} from "bluebird";

var argv = require('minimist')(process.argv.slice(2));
var args: any[] = argv['_'];
console.log(`Program Running. Script = ${argv.script}, with args: `, args)


process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = '0';

const script = new ScriptFactory(argv.script, args);
script.execute();