
process.AFL_TW_ROOT = './src'
const TemplateWorker = require('../src/nodejs/templateWorker.js');

describe('template worker tests', function() {
  it('get', function(done) {
    const worker = new TemplateWorker();
    worker.logger = {
      info: console.log,
      severe: console.log,
      fine: console.log,
    }
    worker.completeRestOperation = () => {};
    worker.onStart(() => {
      worker.onGet({
        setHeaders: () => {},
        setBody: (body) => { console.log('hi', body) },
        getUri: () => ({ path: '/a/b/list' }),
        getBody: () => {},
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
