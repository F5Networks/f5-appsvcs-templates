const https = require('https');

import { Template } from '../templates/template';

class HttpsRequestOptions {
    hostname: string = '10.145.70.171';
    port: number = 8443;
    auth: string = 'admin:f5site02';
    path: string = '/';
    method: string;
    json: boolean;

    public constructor(init?:Partial<HttpsRequestOptions>) {
        const Utils = require('../utils/utils');
        let config = JSON.parse(Utils.getFileFromRootDir('devconfig.json'));
        if(config) {
            this.hostname = config.hostname;
            this.port = config.port;
            this.auth = config.auth;
        }
        
        Object.assign(this, init);
    }
}

module.exports = class HttpsService {
    options: HttpsRequestOptions;
    constructor() {
        this.options = new HttpsRequestOptions();
    }

    async deployApp(template:Template) {
            console.log('in deployApp()');

            this.options = new HttpsRequestOptions({
                path: '/mgmt/shared/fast/applications',
                method: 'POST',
                json: true
            });

            let response:any = await this.request(this.options, template).catch(err => {
                console.log('in deployApp. err: ', err);
                return Promise.reject(false);
            });

            if(response === null || typeof(response) === 'undefined') {
                console.log('response is null or undefined. return false to deploy-apps');
                return Promise.reject(false);
            }
            
            if(response.code === 202) {
                console.log('response is 202. returning true to deploy-apps');
                return Promise.resolve(true);
            }
            else {
                console.log(`response is ${response.code}. returning false to deploy-apps`);
                return Promise.reject(false);
            }
    } 

    async request(options: HttpsRequestOptions, postBody?:any) {
        return new Promise((resolve, reject) => {
            console.log('OPTIONS: ', options);
            console.log('POSTBODY: ', postBody);
            const request = https.request(options, (response) => {

                if (response.statusCode < 200 || response.statusCode >= 300) {
                    reject(new Error(`Request Rejected with status code: ${response.statusCode}`));
                }
    
                let body = [];
                response.on('data', (chunk) => {
                    body.push(chunk);
                });
                
                response.on('end', () => {
                    try {
                        body = JSON.parse(Buffer.concat(body).toString());
                    } catch (e) {
                        reject(e);
                    }
                    resolve(body);
                });
              });
              
              request.on('error', (e) => {
                console.log(`In request. Error ${e}`);
                reject(e);
              });
    
              if(postBody) {
                request.write(JSON.stringify(postBody));
              }
              
              request.end();
        });
    }
}