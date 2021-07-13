// const FASTWorker = require('./nodejs/FASTWorkerBundle');
// const worker = new FASTWorker.FASTWorker();
// console.log(`Worker ${worker.isPublic} instantiated`);


const loadAndRegisterWorker = (filepath, importer) => {
    const inst = importer(filepath);
    console.log(`${inst.isPublic} has been imported`);
};

let WorkerDef;
try {
    WorkerDef = loadAndRegisterWorker('./nodejs/FASTWorkermain.js', require);
    console.log(WorkerDef);
}
catch (ex) {
    console.log(ex.message);
}

const worker = new WorkerDef();
