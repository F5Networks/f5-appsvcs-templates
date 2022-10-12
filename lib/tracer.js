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

    close() {
        if (this._tracer) {
            this._tracer.close();
        }
    }

    setLogger(logger) {
        this._logger = logger;
    }

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

    getContext(opOrId) {
        const reqid = opOrId.requestId || opOrId;
        return this._contexts[reqid];
    }

    startSpan(restOp) {
        const ctx = this._createContext(restOp);
        this._contexts[restOp.requestId] = ctx;
    }

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

    startChildSpan(reqid, msg) {
        const ctx = this.getContext(reqid);

        if (ctx) {
            const span = this._tracer.startChildSpan(msg, ctx.span);
            ctx.childSpans[msg] = span;
        }
    }

    endChildSpan(reqid, msg) {
        const ctx = this.getContext(reqid);
        if (ctx && ctx.childSpans[msg]) {
            ctx.childSpans[msg].finish();
            delete ctx.childSpans[msg];
        }
    }

    recordChildSpan(reqid, msg, promise) {
        this.startChildSpan(reqid, msg);

        return promise
            .then((retval) => {
                this.endChildSpan(reqid, msg);
                return retval;
            });
    }

    logEvent(idOrOp, eventMsg) {
        const ctx = this.getContext(idOrOp);

        if (!ctx) {
            throw new Error('logEvent(): no context found');
        }

        ctx.span.log({
            event: eventMsg
        });
    }

    logError(idOrOp, errMsg) {
        const ctx = this.getContext(idOrOp);

        if (!ctx) {
            throw new Error('logError(): no context found');
        }

        ctx.span.logError(errMsg);
    }
}

module.exports = Tracer;
