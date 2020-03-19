'use strict';

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

    enter(transaction) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        const enterTime = this._getTime();
        this.onEnterCb(transaction, enterTime);
        this.transactions[transaction] = enterTime;
    }

    exit(transaction) {
        if (!transaction) {
            throw new Error('Missing required argument transaction');
        }
        if (!this.transactions[transaction]) {
            throw new Error('exit() called without enter()');
        }
        const exitTime = this._getTime();
        const enterTime = this.transactions[transaction];
        this.onExitCb(transaction, exitTime, this._deltaTime(enterTime, exitTime));
        delete this.transactions[transaction];
    }

    enterPromise(transaction, promise) {
        this.enter(transaction);
        return promise
            .finally(() => this.exit(transaction));
    }
}

module.exports = TransactionLogger;
