process.AFL_TW_ROOT = '../';
process.AFL_HE_ROOT_DIR = '../html/';
const TemplateWorker = require('../nodejs/templateWorker.js');

describe('template worker tests', () => {
    it('get', (done) => {
        const worker = new TemplateWorker();
        worker.logger = {
            info: console.log,
            severe: console.log,
            fine: console.log,
            log: console.log
        };
        worker.completeRestOperation = () => {};
        worker.onStart(() => {
            worker.onGet({
                setHeaders: () => {},
                setBody: (body) => { console.log('hi', body); },
                getUri: () => ({ path: '/a/b/list' }),
                getBody: () => {}
            })
                .then((result) => {
                    done();
                });
        },
        (e) => {
            console.log(e);
            throw new Error('error');
        });
    });
});
