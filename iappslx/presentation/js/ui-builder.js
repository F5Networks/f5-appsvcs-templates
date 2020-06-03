module.exports = class UiBuilder {
    buildIcon(iconClass, classList, isClickable) {
        const icon = document.createElement('a');
        icon.className += `fas ${iconClass}`;
        icon.className += !isClickable ? ' icon' : ' btn-icon';
        if (classList) this.addClassListToElem(icon, classList);
        return icon;
    }

    buildTooltippedElem(element, tooltipStr) {
        const span = document.createElement('span');
        span.classList.add('tooltip', 'tooltip-right');
        span.setAttribute('data-tooltip', tooltipStr);
        span.appendChild(element);
        return span;
    }

    buildClickable(btnType, classList, href, onclick, innerText) { // btnType === 'a' || 'button' || 'icon:{icon-type}'
        let clickable;
        if (btnType.split(':').length === 2) {
            clickable = this.buildIcon(btnType.split(':')[1], classList, true);
        }
        else {
            clickable = document.createElement(btnType);
            if (innerText) clickable.insertAdjacentHTML('beforeend', innerText);
            if (classList) this.addClassListToElem(clickable, classList);
        }
        if (href) clickable.href = href;
        if (onclick) clickable.onclick = onclick;
        return clickable;
    }

    buildDiv(classList, id, children) {
        const div = document.createElement('div');
        if (classList) this.addClassListToElem(div, classList);
        if (id) div.id = id;
        if (children) {
            for (let i = 0; i < children.length; i += 1) {
                div.insertAdjacentElement('beforeend', children[i]);
            }
        }
        return div;
    }

    buildRow(id, classList, columnList) {   // columnList can be an array of either strings or divs
        const row = document.createElement('div');
        row.id = id;
        if(classList) this.addClassListToElem(row, classList);
        if(columnList) {
            for (let i = 0; i < columnList.length; i += 1) {
                if(typeof(columnList[i]) === 'string') {
                    const tdDiv = document.createElement('div');
                    tdDiv.classList.add('td');
                    tdDiv.insertAdjacentHTML('beforeend', columnList[i]);
                    row.insertAdjacentElement('beforeend', tdDiv);
                }
                else {
                    row.insertAdjacentElement('beforeend', columnList[i]);
                }
            }
        }
        return row;
    }

    buildModal(okFunction, msg) {
        const modalId = 'modal-div';
        const modal = this.buildDiv(['modal', 'active'], modalId);

        modal.appendChild(this.buildClickable('a', ['modal-overlay', 'faded-active-border'], '', () => { this.destroyElem(modal) }));
        const modalContainer = this.buildDiv(['modal-container'])
        modal.appendChild(modalContainer);
        
        const modalHeader = this.buildDiv(['modal-header']);
        modal.appendChild(modalHeader);

        const modalBody = this.buildDiv(['modal-body']);
        modalBody.insertAdjacentHTML('beforeend', msg);

        const closeBtn = this.buildClickable('icon:fa-times', ['modal-exit-icon', 'float-right', 'faded-active-border'], '', () => { this.destroyElem(modal) } );
        modalHeader.appendChild(closeBtn);

        const modalTitle = this.buildDiv(['modal-title', 'h4'])
        modalTitle.appendChild(this.buildIcon('fa-exclamation-triangle', ['exclamation-icon']));
        modalTitle.insertAdjacentHTML('beforeend', 'Warning');
        modalHeader.appendChild(modalTitle);

        const modalFooter = this.buildDiv(['modal-footer']);
        modalFooter.appendChild(this.buildClickable('button', ['btn', 'btn-cancel', 'faded-active-border'], '', () => {
            this.destroyElem(modal);
        }, 'CANCEL' ));
        modalFooter.appendChild(this.buildClickable('button', ['btn', 'btn-continue','faded-active-border'], '', () => {
            this.destroyElem(modal);
            okFunction();
        }, 'CONTINUE'));

        modalContainer.appendChild(modalHeader);
        modalContainer.appendChild(modalBody);
        modalContainer.appendChild(modalFooter);
        return modal;
    }

    buildLoader() {
        const div = this.buildDiv(['p-centered'], 'loader');
        const loading = div.appendChild(this.buildDiv(['loading', 'loading-lg']));
        return div;
    }

    destroyElem(elem, elemId) {
        if (!elem) {
            elem = document.getElementById(elemId);
        }
        while (elem.firstChild) {
            elem.lastChild.remove();
        }
        elem.parentElement.removeChild(elem);
    }

    addClassListToElem(elem, classList) {
        for (let i = 0; i < classList.length; i += 1) {
            elem.className += ` ${classList[i]}`;
        }
        elem.className = elem.className.trim();
    }
};