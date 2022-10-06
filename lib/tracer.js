const atgTracer = require('@f5devcentral/atg-shared-utilities').tracer;

class Tracer {
    constructor(options) {
        this._name = options.name;
        this._version = options.version;
        this._spanNameFromRestOp = options.spanNameFromRestOp;
        this._logger = options.logger;
        this._tracer = null;

        this._contexts = {};

        this.setOptions();
    }

    /**
     * close this Performance Tracing object
     */
    close() {
        if (this._tracer) {
            this._tracer.close();
        }
    }

    /**
     * set this Performance Tracing object's logger
     * @param {Object} logger - Logger object
     */
    setLogger(logger) {
        this._logger = logger;
    }

    /**
     * set Options for Performance Tracing
     * @param {Object} deviceInfo - BIG-IP device config
     * @param {Object} as3Info - AS3 config
     * @param {Object} tracerOpts - Performance Tracing config
     */
    setOptions(deviceInfo, as3Info, tracerOpts) {
        const opts = {
            logger: this._logger,
            tags: {
                [atgTracer.TraceTags.APP.VERSION]: this._version,
                'as3.version': (as3Info ? as3Info.version : '')
            }
        };

        if (deviceInfo) {
            Object.assign(
                opts.tags,
                atgTracer.TraceUtil.buildDeviceTags(deviceInfo)
            );
        }

        Object.assign(opts, tracerOpts);

        this.close();
        this._tracer = new atgTracer.Tracer(this._name, opts);
    }

    /**
     * create Performance Tracing Context and start Span
     * @param {Object} restOp - restOperation
     * @returns {Object}
     */
    _createContext(restOp) {
        let spanName = restOp.message;
        const pathName = restOp.getUri ? restOp.getUri().pathname : 'None';
        const methodName = restOp.getMethod ? restOp.getMethod() : 'None';

        if (restOp.getUri && this._spanNameFromRestOp) {
            spanName = this._spanNameFromRestOp(restOp);
        }

        return ({
            span: this._tracer.startHttpSpan(spanName, pathName, methodName),
            childSpans: {}
        });
    }

    /**
     * get Context with request ID
     * @param {(Object|number)} opOrId - restOperation or request ID
     * @returns {Object}
     */
    getContext(opOrId) {
        const reqid = opOrId.requestId || opOrId;
        return this._contexts[reqid];
    }

    /**
     * create Performance Tracing context to start time span
     * @param {Object} restOp - restOperation
     */
    startSpan(restOp) {
        const ctx = this._createContext(restOp);
        this._contexts[restOp.requestId] = ctx;
    }

    /**
     * finish Performance Tracing time span
     * @param {Object} restOp - restOperation
     */
    endSpan(restOp) {
        const ctx = this.getContext(restOp);

        if (!ctx) {
            throw new Error('endSpan() called without corresponding startSpan(): no context found');
        }

        if (restOp.getStatusCode) {
            ctx.span.tagHttpCode(restOp.getStatusCode());
        }
        ctx.span.finish();
    }

    /**
     * start Performance Tracing child span
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} msg - name of the operation being performed
     */
    startChildSpan(reqid, msg) {
        const ctx = this.getContext(reqid);

        if (ctx) {
            const span = this._tracer.startChildSpan(msg, ctx.span);
            ctx.childSpans[msg] = span;
        }
    }

    /**
     * finish Performance Tracing child span
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} msg - name of the operation that is ending
     */
    endChildSpan(reqid, msg) {
        const ctx = this.getContext(reqid);
        if (ctx && ctx.childSpans[msg]) {
            ctx.childSpans[msg].finish();
            delete ctx.childSpans[msg];
        }
    }

    /**
     * record Performance Tracing child span
     * @param {number} reqid - FASTWorker process id, identifying the request
     * @param {string} msg - name of the operation being performed
     * @param {Promise} promise - promise being traced
     * @returns {Promise}
     */
    recordChildSpan(reqid, msg, promise) {
        this.startChildSpan(reqid, msg);

        return promise
            .then((retval) => {
                this.endChildSpan(reqid, msg);
                return retval;
            });
    }

    /**
     * log Performance Tracing Event
     * @param {(number|Object)} idOrOp - restOperation or request ID
     * @param {string} eventMsg - description of the event
     */
    logEvent(idOrOp, eventMsg) {
        const ctx = this.getContext(idOrOp);

        if (!ctx) {
            throw new Error('logEvent(): no context found');
        }

        ctx.span.log({
            event: eventMsg
        });
    }

    /**
     * log Error for Performance Tracing context
     * @param {(number|Object)} idOrOp - restOperation or request ID
     * @param {string} errMsg - message from Error
     */
    logError(idOrOp, errMsg) {
        const ctx = this.getContext(idOrOp);

        if (!ctx) {
            throw new Error('logError(): no context found');
        }

        ctx.span.logError(errMsg);
    }
}

module.exports = Tracer;
