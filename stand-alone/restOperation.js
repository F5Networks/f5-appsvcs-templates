/* Copyright 2021 F5 Networks, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

class RestOperation {
    constructor() {
        this.uri = null;
        this.body = null;
        this.method = 'Get';
        this.statusCode = 200;
        this.headers = { Referer: 'restnoded', 'Content-Type': 'application/json' };
        this.allow = '';
        this._httpResponse = null;
        this.isSetBasicAuthHeader = false;
        this.identifiedDeviceRequest = false;
        this.identifiedDeviceGroupName = null;
        this.isFailed = false;
        this.httpsRejectUnauthorized = false;
    }

    setUri(uri) {
        this.uri = uri;
        return this;
    }

    getReferer() {
        return this.getHeader('Referer');
    }

    setReferer(referer) {
        this.setHeader('Referer', referer);
        return this;
    }

    getUri() {
        return this.uri;
    }

    getBody() {
        return this.body;
    }

    getBodyAsString() {
        let originalBody = this.getBody();
        if (originalBody) {
            try {
                originalBody = JSON.stringify(originalBody);
            } catch (e) {
                originalBody = '';
            }
        } else {
            return '';
        }

        return originalBody;
    }

    setBody(requestBody) {
        // NOTE: This should force setting to string always.  This will ensure that getBody() always returns a String.
        // NOTE: This should always clone the incoming data to ensure it is immutable
        this.body = requestBody;
        return this;
    }

    setMethod(method) {
        this.method = method;
        return this;
    }

    getMethod() {
        return this.method;
    }

    setStatusCode(statusCode) {
        this.statusCode = statusCode;
        return this;
    }

    getStatusCode() {
        return this.statusCode;
    }

    setContentType(contentType) {
        if (contentType) {
            this.setHeader('Content-Type', contentType.toLowerCase());
        }
        return this;
    }

    getContentType() {
        return this.getHeader('Content-Type');
    }

    setAllow(allow) {
        this.allow = allow;
        return this;
    }

    getBasicAuthorization() {
        return this.getHeader('Authorization');
    }

    setBasicAuthorization(basicAuthorization) {
        this.setHeader('Authorization', basicAuthorization);
        return this;
    }

    getAllow() {
        return this.allow;
    }

    setHttpResponse(httpResp) {
        this._httpResponse = httpResp;
        return this;
    }

    getHttpResponse() {
        return this._httpResponse;
    }

    getIsSetBasicAuthHeader() {
        return this.isSetBasicAuthHeader;
    }

    setIsSetBasicAuthHeader(val) {
        this.isSetBasicAuthHeader = val;
        return this;
    }

    isIdentifiedDeviceRequest() {
        return this.identifiedDeviceRequest;
    }

    setIdentifiedDeviceRequest(val) {
        this.identifiedDeviceRequest = val;
        return this;
    }

    setHttpsRejectUnauthorized(val) {
        this.httpsRejectUnauthorized = val;
        return this;
    }

    getHttpsRejectUnauthorized() {
        return this.httpsRejectUnauthorized;
    }

    getIdentifiedDeviceGroupName() {
        return this.identifiedDeviceGroupName;
    }

    setIdentifiedDeviceGroupName(val) {
        this.identifiedDeviceGroupName = val;
        return this;
    }

    getDecodedUriPath() {
        const uri = this.getUri();
        return decodeURIComponent(uri.path);
    }

    setHeaders(headers) {
        this.headers = headers;
        return this;
    }

    getHeaders() {
        return this.headers;
    }

    setHeader(name, value) {
        if (!name || !value) {
            return this;
        }
        this.headers[name] = value;
        return this;
    }

    getAllResponseHeaders() {
        if (this._httpResponse) {
            return this._httpResponse.headers;
        }

        return {};
    }

    getHeader(name) {
        return this.headers[name];
    }

    removeHeader(name) {
        if (this.headers[name]) {
            delete this.headers[name];
        }
    }

    clearHeaders() {
        this.headers = {};
    }

    clone() {
        const copy = new RestOperation();
        copy.uri = this.uri;
        copy.method = this.method;
        copy.accept = this.accept;
        copy.headers = this.headers;
        copy.body = this.body;
        copy.statusCode = this.statusCode;
        copy.allow = this.allow;
        copy._httpResponse = this._httpResponse;
        copy.isSetBasicAuthHeader = this.isSetBasicAuthHeader;
        copy.identifiedDeviceRequest = this.identifiedDeviceRequest;
        copy.identifiedDeviceGroupName = this.identifiedDeviceGroupName;
        copy.httpsRejectUnauthorized = this.httpsRejectUnauthorized;
        return copy;
    }

    complete() {}
}

RestOperation.Methods = {
    GET: 'Get',
    POST: 'Post',
    PUT: 'Put',
    PATCH: 'Patch',
    DELETE: 'Delete',
    OPTIONS: 'Options'
};

module.exports = RestOperation;
