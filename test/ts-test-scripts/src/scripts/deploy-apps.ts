const HttpsService = require('../services/https-service');
const SimpleUdpDefaults = require('../templates/simple-udp-defaults');
const BigIpHttp = require('../templates/big-ip-http');
const Utils = require('../utils/utils');

import { Template } from '../templates/template';

module.exports = class DeployApps implements IScript {
    static scriptName = 'deployApps';
    amount: number;
    isComplete = false;
    https = new HttpsService();
    templates = new Array<Template>();
    completed = 0;
    curTemplatePos = 0;
    operationInProgress = false;

    constructor(args: any[]) {
        console.log('args: ', args);
        if(typeof(args[0]) !== 'number') {
            throw new Error(`${DeployApps.scriptName}, required arg1 (amount) must be a number! arg1=${args[0]}`);
        }
        if(args[1] && typeof(args[1]) !== 'string') {
            throw new Error(`${DeployApps.scriptName}, optional arg2 (tenantTarget) must be a string! arg2=${args[1]}`);
        }
        this.amount = args[0];
        this.templates.push(new BigIpHttp());
        this.templates.push(new SimpleUdpDefaults());

        if(args[1]) {
            console.log('this.templates: ', this.templates);
            this.templates.forEach(template => template.setTargetTenant(args[1]));
        }
    }

    async execute() {
        console.log(`In DeployApps.execute(), deploying ${this.amount} applications to FAST\n`);
        
        var curTemplatePos = 0;

        while(this.completed !== this.amount) {
            console.log(`APPLICATION DEPLOYMENT REQUEST #${this.completed} OF ${this.amount}`);
            let success = await this.https.deployApp(this.templates[this.curTemplatePos].baseTemplate).catch((err) => { console.log('in execute. err: ', err); return false; });

            if(success) {
                console.log(`APPLICATION DEPLOYMENT REQUEST #${this.completed} OF ${this.amount} SUCCESSFUL!\n`);
            }
            else {
                console.log(`APPLICATION DEPLOYMENT REQUEST #${this.completed} OF ${this.amount} FAILED!\n`);
            }

            this.completed++;

            if(this.templates.length > 1 && ++this.curTemplatePos > this.templates.length - 1) {
                this.curTemplatePos = 0;
            }

            this.templates[this.curTemplatePos].incrementBaseTemplate();

            console.log(`Waiting 5 seconds before next deploy request...\n`);
            await Utils.delay(5000);
        }
    }
}