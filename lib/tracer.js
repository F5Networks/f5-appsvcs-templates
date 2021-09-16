/*
 * Copyright 2021. F5 Networks, Inc. See End User License Agreement ("EULA") for
 * license terms. Notwithstanding anything to the contrary in the EULA, Licensee
 * may copy and modify this software product for its internal business purposes.
 * Further, Licensee may upload, publish and distribute the modified version of
 * the software product on devcentral.f5.com.
 */

'use strict';

/* eslint-disable no-console */


// NOTE: See standards from pkg 'opentracing'.Tags
const Tags = {
    HTTP: {
        METHOD: 'http.method',
        STATUS_CODE: 'http.status_code',
        URL: 'http.url'
    },
    COMPONENT: 'component',
    SPAN: {
        KIND: 'span.kind',
        KIND_SERVER: 'server'
    },
    BIGIP: {
        VERSION: 'bigip.version'
    },
    APP: {
        VERSION: 'app.version'
    },
    ERROR: 'error'
};

class BaseSpan {
    log() {}

    logError() {}

    finish() {}

    addTag() {}

    tagHttpCode() {}

    addTags() {}

    get finished() {
        return !!this._finished;
    }

    get errored() {
        return !!this._errored;
    }
}

class Span extends BaseSpan {
    constructor(span, logger, debug) {
        super();
        Object.defineProperty(this, '_span', { value: span });
        Object.defineProperty(this, '_logger', { value: logger });
        this._errored = false;
        this._finished = false;
        this._debug = debug;
    }

    get logs() {
        return this._span._logs;
    }

    get tags() {
        return this._span._tags;
    }

    get serviceName() {
        return this._span.serviceName;
    }

    get operationName() {
        return this._span.operationName;
    }

    log(event, timestamp) {
        try {
            this._span.log(event, timestamp);
        } catch (e) {
            this._handleException(`Unable to log span event ${JSON.stringify(event)}`, e);
        }
    }

    logError(err, timestamp) {
        try {
            if (typeof err === 'string') {
                err = { message: err };
            }
            this._span.setTag(Tags.ERROR, true);
            this._span.log({
                event: 'error', 'error.object': err, message: err.message, stack: err.stack
            }, timestamp);
        } catch (e) {
            this._handleException(`Unable to tag and log error for span for error ${err.message}`, e);
        }
    }

    /**
     *  Complete span process
     * @returns {Void}
     */
    finish() {
        try {
            this._span.finish();
        } catch (err) {
            this._handleException('Error while finishing span. ', err);
        }
        this._finished = true;
    }

    tagHttpCode(code) {
        this.addTag(Tags.HTTP.STATUS_CODE, code);
    }

    addTag(tagKey, tagValue) {
        if (!tagKey) {
            this._handleException(`Unable to add tag. Missing tag key for value ${tagValue}`);
        }
        try {
            this._span.setTag(tagKey, tagValue);
        } catch (e) {
            this._handleException(`Unable to add tag ${tagKey}: ${tagValue}`);
        }
    }

    addTags(tags) {
        try {
            this._span.addTags(tags);
        } catch (e) {
            this._handleException(`Unable to add tags: ${JSON.stringify(tags)}`, e);
        }
    }

    _handleException(msgPrefix, err) {
        this._errored = true;
        if (this._debug) {
            const logMsg = err ? `${msgPrefix}: ${err.message} . stack: ${err.stack}` : msgPrefix;
            this._logger.fine(logMsg);
        }
    }
}

class Tracer {
    constructor(serviceName, options) {
        if (!serviceName) {
            throw new Error('serviceName is required');
        }

        options = options || {};
        this._enabled = typeof options.enabled !== 'undefined' ? options.enabled : (String(process.env.F5_PERF_TRACING_ENABLED).toLowerCase() === 'true');
        // read-only
        Object.defineProperties(this, {
            serviceName: { value: serviceName },
            _endpoint: { value: options.endpoint || process.env.F5_PERF_TRACING_ENDPOINT },
            _debug: { value: typeof options.debug !== 'undefined' ? options.debug : String(process.env.F5_PERF_TRACING_DEBUG).toLowerCase() === 'true' }
        });
        delete options.enabled;
        delete options.endpoint;
        delete options.debug;
        if (this._debug && !options.logger) {
            // provide default console when no logger present but debug enabled
            options.logger = {
                info: (msg) => {
                    console.log(`INFO: [${serviceName}] ${msg}`);
                },
                error: (msg) => {
                    console.log(`ERROR: [${serviceName}] ${msg}`);
                },
                fine: (msg) => {
                    console.log(`FINE: [${serviceName}] ${msg}`);
                }
            };
        }
        Object.defineProperty(this, '_logger', { value: options.logger });
        Object.defineProperty(this, '_tracer', { value: this._initTracer(options) });
    }

    /**
     *  Start tracer span with provided options.
     *
     * @param {String} operation          - name of operation being performed
     * @param {Object} options            - span options
     * @param {Object} [options.childOf]  - span for parent/root tracing
     * @param {Object} [options.tags]     - key-value pairs of tags to associate span with
     *
     * @returns {Object} tracer span
     */
    startSpan(operation, options) {
        if (!this._enabled) {
            return new BaseSpan();
        }

        try {
            options = options || {};
            const defaultTags = { [Tags.SPAN.KIND]: Tags.SPAN.KIND_SERVER };
            options.tags = Object.assign(defaultTags, options.tags || {});
            const span = this._tracer.startSpan(operation, options);
            return new Span(span, this._logger, this._debug);
        } catch (e) {
            this._handleException(`Error creating span ${operation}. Returning no-op`, e);
            return new BaseSpan();
        }
    }

    /**
     *  Start tracer span for a HTTP request with default tags and provided options.
     *
     * @param {String} resourcePath       - resource path to group requests under (e.g. api/items/{itemid})
     * @param {String} url                - actual url of HTTP request (e.g. api/items/item1234)
     * @param {String} method             - HTTP method (defaults to GET)
     * @param {Object} options            - span options
     * @param {Object} [options.childOf]  - span for parent/root tracing
     * @param {Object} [options.tags]     - key-value pairs of tags to associate span with
     *
     * @returns {Object} tracer span
     */
    startHttpSpan(resourcePath, url, method, options) {
        if (!this._enabled) {
            return new BaseSpan();
        }

        method = method || 'GET';
        options = options || {};
        const httpTags = {
            [Tags.SPAN.KIND]: Tags.SPAN.KIND_SERVER,
            [Tags.COMPONENT]: 'net/http',
            [Tags.HTTP.METHOD]: method.toUpperCase(),
            [Tags.HTTP.URL]: url
        };
        options.tags = Object.assign(httpTags, options.tags || {});
        return this.startSpan(resourcePath, options);
    }

    /**
     *  Configure tracer instance. For jaeger instance options, refer to [doc]((https://github.com/jaegertracing/jaeger-client-node/blob/v3.18.1/src/configuration.js#L188)
     *
     * @param {Object} options              - tracer options
     * @param {Object} [options.logger]     - tracer logger
     * @param {Object} [options.tags]       - key-value pairs of tracer level tags
     *
     * @returns {Object} - tracer or undefined if disabled or errored.
     */
    _initTracer(options) {
        let tracer;
        if (!this._enabled) {
            process.env.JAEGER_DISABLED = true;
            return tracer;
        }

        try {
            if (this._debug) {
                this._logger.fine('Initializing Jaeger Client');
            }
            // support for node < v10 drops after jaeger-client 3.18.1 version
            // jaeger client has dependency with packages that do not work in strict mode
            // (package 'error' sets a read-only property name)

            // eslint-disable-next-line global-require
            const JaegerClient = require('jaeger-client');
            const tracerConf = {
                serviceName: this.serviceName,
                sampler: {
                    type: 'const',
                    param: 1
                },
                reporter: {
                    logSpans: true
                }
            };
            process.env.JAEGER_DISABLED = false;
            process.env.JAEGER_ENDPOINT = this._endpoint;
            tracer = JaegerClient.initTracerFromEnv(tracerConf, options);
            if (this._debug) {
                this._logger.fine(`Initialized tracer. enabled: ${this._enabled} api: ${this._endpoint}`);
            }
        } catch (err) {
            this._handleException('Failed to initialize Jaeger Client tracer. Using noop tracer.', err);
            this._enabled = false;
        }
        return tracer;
    }

    close() {
        if (this._tracer) {
            try {
                this._tracer.close();
            } catch (e) {
                this._handleException('Error encountered while attempting to close tracer', e);
            }
        }
    }

    _handleException(msgPrefix, err) {
        if (this._debug) {
            const logMsg = err ? `${msgPrefix}: ${err.message} . stack: ${err.stack}` : msgPrefix;
            this._logger.fine(logMsg);
        }
    }
}

module.exports = {
    Tracer,
    Tags,
    BaseSpan,
    Span
};
