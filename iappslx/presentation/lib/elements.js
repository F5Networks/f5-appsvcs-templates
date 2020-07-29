/* eslint-env browser */
/* eslint-disable no-console */

'use strict';

class Elem {
    constructor(elemType = 'div', id = null, classList = null) {
        this.elem = document.createElement(elemType);
        if (this.id) this.elem.id = id;
        if (classList) this.setClassList(classList);
    }

    html() {
        return this.elem;
    }

    onRender(func) {
        let elem = this.elem;
        if (elem instanceof Elem) elem = elem.html();
        const observer = new MutationObserver(() => {
            if (document.contains(elem)) {
                func();
                observer.disconnect();
            }
        });
        observer.observe(document, {
            attributes: false, childList: true, characterData: false, subtree: true
        });
        return this;
    }

    addEventListener(setupFunc, alternateElem = null) {
        let element = alternateElem || this.elem;
        if (element instanceof Elem) element = element.html();
        if (document.getElementById('app').contains(element)) setupFunc();
        else this.onRender(setupFunc);

        return this;
    }

    setToolstrip(text, direction = 'right') {
        const parent = (this.elem.parentElement) ? this.elem.parentElement : null;
        const toolstrip = new Span(['tooltip', `tooltip-${direction}`]);
        if (parent) {
            parent.replaceChild(toolstrip, this.elem);
            toolstrip.appendChild(this.elem);
            this.elem = toolstrip.html();
        } else {
            // const clone = this.elem.cloneNode(true);
            const span = new Span(['tooltip', `tooltip-${direction}`]).setChildren(this.elem).html();
            this.elem = span; // new Span(['tooltip', `tooltip-${direction}`]).setChildren(clone).html();
        }
        this.html().setAttribute('data-tooltip', text);

        return this;
    }

    safeAppend(element, position = 'beforeend', classList = null) { // can append either Elem, string, or Html Element
        if (!element) return this;
        if (element instanceof Elem) {
            element = element.html();
        }
        if (typeof (element) === 'string') this.elem.insertAdjacentHTML(position, element);
        else this.elem.insertAdjacentElement(position, element);
        if (classList) {
            classList = this.sanitizeList(classList);
            for (let i = 0; i < classList.length; i++) {
                element.classList.add(classList[i]);
            }
        }
        return this;
    }

    appendToParent(parent, position = 'beforeend') {
        if (parent instanceof Elem) parent = parent.html();
        parent.insertAdjacentElement(position, this.elem);
        return this;
    }

    destroyChildren() {
        if (this.elem) {
            while (this.elem.firstChild) {
                this.elem.lastChild.remove();
            }
        }
        return this;
    }

    destroyItself() {
        if (this.elem) {
            while (this.elem.firstChild) {
                this.elem.lastChild.remove();
            }
            this.elem.parentElement.removeChild(this.elem);
            this.elem = null;
        }
    }

    setAttr(attr, val) {
        this.elem.setAttribute(attr, val);
        return this;
    }

    setClassList(classList, overwrite = false) {
        if (!classList) return this;
        classList = this.sanitizeList(classList);
        if (overwrite) this.elem.className = '';
        for (let i = 0; i < classList.length; i += 1) {
            this.elem.className += ` ${classList[i]}`;
        }
        this.elem.className = this.elem.className.trim();
        return this;
    }

    removeClass(className) {
        this.elem.classList.remove(className);
    }

    setChildren(children) { // Can be either a string or element Elem, or list
        children = this.sanitizeList(children);
        if (children) {
            for (let i = 0; i < children.length; i += 1) {
                if (children[i] instanceof Function) children[i] = children[i]();
                this.safeAppend(children[i]);
            }
        }
        return this;
    }

    setInnerText(text) {
        this.elem.insertAdjacentHTML('beforeend', text);
        return this;
    }

    setId(id) {
        this.elem.id = id;
        return this;
    }

    sanitizeList(list) { // To overload params to accept both single and list values
        if (list && !Array.isArray(list)) return [list];
        return list;
    }
}

class Popover extends Elem {
    constructor(elem) {
        super('div');
        this.setClassList('popover');
        this.direction = null;
        this.style = 'normal';
        this.wrappedElem = elem;
        this.wrappedElem.style.marginLeft = '-2px;';
    }

    html() {
        if (!this.direction) {
            console.error('PopoverElem build wrong');
        }
        return this.elem;
    }

    setStyle(style) {
        if (style !== 'normal' && style !== 'danger') console.error('Only \'normal\' and \'danger\' supported for Popover. style = ', style);

        this.style = style;
        return this;
    }

    setDirection(direction) { // Only left currently works
        if (direction !== 'right' && direction !== 'bottom' && direction !== 'left') console.error('Popover direction must be either right/bottom/left. direction = ', direction);
        this.direction = direction;
        this.setClassList(`popover-${direction}`);
        return this;
    }

    setData(title, message) {
        const popoverContainer = new Div('popover-container').setChildren([
            new Div('popover-header').setChildren(title).html(),
            new Div('popover-body').setChildren(message).html(),
            new Div('popover-arrow-right').html()
        ]).appendToParent(this.elem);

        if (this.style === 'danger') {
            const container = popoverContainer.html();
            container.children[0].style.backgroundColor = '#2b1111e6';
            container.children[1].style.backgroundColor = '#442222f0';
            container.children[2].classList.add('arrow-danger');
        }

        if (this.wrappedElem instanceof Elem) this.wrappedElem.appendToParent(this.elem, 'afterbegin');
        else this.elem.insertAdjacentElement('afterbegin', this.wrappedElem);

        this.addEventListener(() => {
            const popoverContainerElem = popoverContainer.html();
            const arrowReposition = (entries) => {
                Array.from(entries).forEach((entry) => { // entry.target = popover-container
                    const rect = entry.contentRect;

                    const arrow = entry.target.children[2];
                    const neededHeightMove = (rect.height / 2) - 4; // (arrow.style.height / 2) always returns zero. Needs fixing?

                    arrow.style.top = `-${neededHeightMove}px`;
                });
            };
            const arrowObserver = new ResizeObserver(arrowReposition);
            arrowObserver.observe(popoverContainerElem);
        }, popoverContainer.html());

        return this;
    }
}

class Div extends Elem {
    constructor(classList = '') {
        super('div', '', classList);
    }
}

class Span extends Elem {
    constructor(classList = null) {
        super('span', '', classList);
    }
}

class Clickable extends Elem { // btnType === 'a' || 'button' || 'icon:{icon-type}'
    constructor(btnType = 'a', classList = null) {
        if (btnType === 'a' || btnType === 'button') super(btnType, null, classList);
        else if (btnType.split(':').length === 2) {
            super('a');
            this.elem = new Icon(btnType.split(':')[1], true).setClassList(classList).html();
        } else console.error('Clickable contructor has illegal param btnType: ', btnType);
    }

    setHref(href) {
        this.elem.href = href;
        return this;
    }

    setOnClick(onclick) {
        this.elem.onclick = onclick;
        return this;
    }
}

class Copyable extends Elem {
    constructor(text, UiWorker) {
        super('div');
        this.text = text;
        this.uiWorker = UiWorker;
        this.elem = null;
        this.elem = new Clickable().setInnerText(text).addEventListener(() => {
            this.elem.onclick = () => {
                const input = document.createElement('textarea');
                input.innerHTML = this.text;
                document.body.appendChild(input);
                input.select();
                const success = document.execCommand('copy');
                document.body.removeChild(input);

                document.getElementById('app').scrollIntoView({ behavior: 'smooth' });

                if (success) new SnackBar('TaskId Successfully Copied').setIcon('fa-clipboard-check').setClassList('snackbar-positive').show();
                else new SnackBar('Failed to Copy TaskId').setIcon('fa-clipboard-check').setClassList('snackbar-positive').show();
            };
        }).html();
    }
}

class SnackBar extends Elem {
    constructor(message) {
        super();
        this.elem = document.getElementById('snackbar');
        this.elem.insertAdjacentHTML('beforeend', message);
    }

    setIcon(icon) {
        this.safeAppend(new Icon(icon).html(), 'afterbegin');
        return this;
    }

    show() {
        this.elem.classList.add('show');

        setTimeout(() => {
            this.destroyChildren();
            this.elem.className = '';
        }, 2200);

        return this;
    }
}

class Icon extends Elem {
    constructor(iconClassIdentifier, isClickable) {
        super('a');
        this.elem.className += `fas ${iconClassIdentifier}`;
        this.elem.className += !isClickable ? ' icon' : ' btn-icon';
    }
}

class P extends Elem {
    constructor(text, classList = '', id = '') {
        super('p', id, classList);
        this.setChildren(text);
    }
}

class Svg extends Elem {
    constructor(classList) {
        super('div');
        classList = this.sanitizeList(classList);
        this.elem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        for (let i = 0; i < classList.length; i++) {
            this.elem.classList.add(classList[i]);
        }
    }
}

class Expandable extends Elem {
    constructor(title, titleClass = '') {
        super('div');
        this.angle = new Icon('fa-angle-right').html();
        this.titleStr = title;
        this.titleClass = titleClass;
        this.title = new Div().setClassList(titleClass).setChildren([this.angle, this.titleStr]).html();
        this.setChildren(this.title);
        this.childList = [];
    }

    addExpandable(elem) {
        if (elem instanceof Elem) elem = elem.html();
        this.childList.push(elem);
        return this;
    }

    completeSetup() {
        this.elem.onclick = () => {
            if (this.elem.classList.contains('expanded')) {
                this.destroyChildren();
                this.setChildren(new Div().setClassList(this.titleClass).setChildren([this.angle, this.titleStr]));
                this.elem.classList.remove('expanded');
                this.angle.classList.remove('fa-angle-down');
                this.angle.classList.add('fa-angle-right');
            } else {
                this.angle.classList.remove('fa-angle-right');
                this.angle.classList.add('fa-angle-down');
                this.elem.classList.add('expanded');
                this.destroyChildren();
                const contentHolder = new Div('expandable-holder');
                this.setChildren(new Div().setClassList(this.titleClass).setChildren([
                    this.angle,
                    new Divider(this.titleStr).setClassList('divider-after').html(),
                    contentHolder
                ]).html());

                for (let i = 0; i < this.childList.length; i++) {
                    contentHolder.safeAppend(this.childList[i]);
                }
            }
        };
        return this;
    }
}

class Row extends Elem {
    constructor(classList = 'tr') {
        super('div', '', classList);
        this.columns = 0;
    }

    makeExpandable(childrenClassName) {
        this.elem.onclick = () => {
            const children = document.getElementsByClassName(childrenClassName);
            if (this.elem.classList.contains('expanded')) {
                for (let i = 0; i < children.length; i++) {
                    children[i].classList.add('display-none');
                }
                this.elem.classList.remove('expanded');
                const angle = this.elem.getElementsByClassName('fa-angle-down');
                if (angle[0]) {
                    angle[0].classList.add('fa-angle-right');
                    angle[0].classList.remove('fa-angle-down');
                }
            } else {
                for (let i = 0; i < children.length; i++) {
                    children[i].classList.remove('display-none');
                }
                this.elem.classList.add('expanded');
                const angle = this.elem.getElementsByClassName('fa-angle-right');
                if (angle[0]) {
                    angle[0].classList.add('fa-angle-down');
                    angle[0].classList.remove('fa-angle-right');
                }
            }
        };
    }

    setColumn(col) {
        if (col instanceof Function) col = col();
        if (typeof (col) === 'string') this.safeAppend(new Div('td').setClassList(`col${++this.columns}`).setChildren(col));
        else this.safeAppend(col, 'beforeend', `col${++this.columns}`);
        return this;
    }

    setColumns(columnList) {
        columnList = this.sanitizeList(columnList);
        const length = columnList.length;
        for (let i = 0; i < length; i += 1) {
            let col = columnList[i];
            if (col instanceof Function) col = col();
            if (typeof (col) === 'string') this.safeAppend(new Div('td').setClassList(`col${++this.columns}`).setChildren(col));
            else this.safeAppend(col, 'beforeend', `col${++this.columns}`);
        }
        return this;
    }
}

class Td extends Elem {
    constructor(template, data) {
        super('div');
        if (!template) {
            this.elem.classList.add('td');
        } else if (template === 'tenant-app-th' || template === 'tenant-app-td') {
            let tenant = 'Tenant';
            let application = 'Application';
            if (template === 'tenant-app-td') {
                console.log('data: ', data);
                tenant = data[0];
                application = data[1];
            }
            const tenantSpan = new Span([template, 'tenant']).setInnerText(tenant);
            const applicationSpan = new Span([template, 'application']).setInnerText(application);
            this.elem = new Div('td').setClassList(template).setChildren([
                tenantSpan.html(),
                new Icon('fa-angle-double-right').setClassList(template).html(),
                applicationSpan.html()
            ]).html();
        } else console.error('Td template is unsupported. template = ', template);
    }
}

class Loader extends Elem {
    constructor() {
        super('div', 'loader', 'p-centered');
        this.size = 'lg';
    }

    setSize(size) { // 'sm', 'small', 'lg', 'large'
        this.size = size;
        return this;
    }

    start() {
        if (this.size === 'sm' || this.size === 'small') this.setClassList(['loading', 'loading-sm']);
        else this.setClassList(['loading', 'loading-lg']);
        return this;
    }

    stop() {
        this.elem.className = '';
        return this;
    }
}

class Modal extends Elem {
    constructor() {
        super('div', null, ['modal', 'active']);
        this.elem.appendChild(new Div('modal-container').html());
        this.elem.appendChild(new Clickable('a', 'modal-overlay faded-active-border').setOnClick(() => { this.destroyItself(); }).html());
        this.title = null;
        this.message = null;
        this.okFunction = null;
    }

    html() {
        if (!this.title || !this.message || !this.okFunction) {
            console.error('Modal not constructed properly. Modal, this.elem: ', this.elem);
        }
        return this.elem;
    }

    setTitle(title) {
        if (title !== 'Warning' && title !== 'Enabling Template Set') { // Title determines type of Modal. Only 'Warning' modal currently supported
            console.error('Unsupported Modal');
            return;
        }
        this.title = title;

        new Div('modal-header').setChildren([
            new Clickable('icon:fa-times').setClassList(['modal-exit-icon', 'float-right', 'faded-active-border']).setOnClick(() => {
                this.destroyItself();
            }),
            () => {
                if (title === 'Warning') {
                    return new Div(['modal-title', 'h4']).setChildren([
                        new Icon('fa-exclamation-triangle').setClassList('exclamation-icon'),
                        `${title}`
                    ]);
                }
                if (title === 'Enabling Template Set') {
                    return new Div(['modal-title', 'h4']).setChildren([
                        new Icon('fa-info-circle').setClassList('info-icon'),
                        `${title}`
                    ]);
                }
            }
        ]).appendToParent(this.elem.children[0]);
        return this;
    }

    setMessage(message) {
        this.message = message;
        new Div('modal-body').setChildren(message).appendToParent(this.elem.children[0]);
        return this;
    }

    setOkFunction(okFunction) {
        this.okFunction = okFunction;
        new Div('modal-footer').setChildren([
            new Clickable('button').setClassList(['btn', 'btn-cancel', 'faded-active-border']).setOnClick(() => {
                this.destroyItself();
            }).setInnerText('CANCEL'),
            new Clickable('button').setClassList(['btn', 'btn-continue', 'faded-active-border']).setOnClick(() => {
                this.destroyItself();
                okFunction();
            }).setInnerText('CONTINUE')
        ]).appendToParent(this.elem.children[0]);
        return this;
    }
}

class Divider extends Elem {
    constructor(text) {
        super('div', null, 'divider');

        if (text) {
            this.elem.classList.add('text-centered');
            this.elem.setAttribute('data-content', text);
        }
    }
}

module.exports = {
    Elem,
    Div,
    Span,
    Clickable,
    Copyable,
    Icon,
    Row,
    Loader,
    Modal,
    SnackBar,
    Popover,
    Td,
    Expandable,
    Divider,
    Svg
};
