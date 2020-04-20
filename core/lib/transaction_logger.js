'use strict';

const uuid4 = require('uuid').v4;

class TransactionLogger {
    constructor(onEnter, onExit) {
        this.onEnterCb = onEnter || (() => {});
        this.onExitCb = onExit || (() => {});
        this.transactions = {};
    }

    _getTime() {
        return new Date();
    }

    _deltaTime(startTime, endTime) {
        return endTime.getTime() - startTime.getTime();
    }

    enter(transaction, tid) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        tid = tid || 0;
        const enterTime = this._getTime();
        this.onEnterCb(transaction, enterTime);
        this.transactions[`${transaction}-${tid}`] = enterTime;
    }

    exit(transaction, tid) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        tid = tid || 0;
        const tkey = `${transaction}-${tid}`;
        if (!this.transactions[tkey]) {
            throw new Error('exit() called without enter()');
        }
        const exitTime = this._getTime();
        const enterTime = this.transactions[tkey];
        this.onExitCb(transaction, exitTime, this._deltaTime(enterTime, exitTime));
        delete this.transactions[tkey];
    }

    enterPromise(transaction, promise) {
        const tid = uuid4();
        this.enter(transaction, tid);
        return promise
            .finally(() => this.exit(transaction, tid));
    }
}

module.exports = TransactionLogger;
