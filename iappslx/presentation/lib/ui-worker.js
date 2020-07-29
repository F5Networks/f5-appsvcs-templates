/* eslint-env browser */
/* eslint-disable no-console */

'use strict';

const { Loader, Elem } = require('./elements');

class NavigationBar {
    constructor(route) {
        this.navBar = document.getElementById('nav-bar');
        this.titles = [];
        this.routes = [];

        const arr = Array.from(this.navBar.children);
        for (let i = 0; i < arr.length; i += 1) {
            this.titles.push(arr[i].innerHTML);
            this.routes.push(arr[i].href.split('#')[1]);
        }

        this.selectNavBtn(route);
    }

    selectNavBtn(route) {
        let newTitle = null;
        for (let i = 0; i < this.routes.length; i += 1) {
            if (this.routes[i] === route) {
                newTitle = this.titles[i];
            }
        }
        if (!newTitle && route === 'modify') {
            newTitle = 'Deploy';
        }

        const selectedNavBtn = document.getElementById('selected-nav');
        if (selectedNavBtn) selectedNavBtn.removeAttribute('id');

        const arr = Array.from(this.navBar.children);
        for (let i = 0; i < arr.length; i += 1) {
            if (arr[i].innerText === newTitle) {
                arr[i].id = 'selected-nav';
                arr[i].innerText = newTitle;
                this.disable();

                this.renderComplete = () => {
                    this.enable();
                    this.renderComplete = null;
                };
            }
        }
    }

    enable() {
        Array.from(this.navBar.children).forEach((child) => {
            child.classList.remove('nav-disabled');
        });
    }

    disable() {
        Array.from(this.navBar.children).forEach((child) => {
            child.classList.add('nav-disabled');
        });
    }
}

module.exports = class UiWorker {
    constructor(appId) {
        this.appId = appId;
        this.app = document.getElementById('app');
        this.curRoute = null;
        this.navBar = null;
    }

    startMoveToRoute(route) {
        this.curRoute = route;
        if (!this.navBar) this.navBar = new NavigationBar(this.curRoute);
        else this.navBar.selectNavBtn(this.curRoute);

        if (!this.app) {
            this.app = document.getElementById('app');
        }

        this.app.scrollIntoView({ behavior: 'smooth' });

        UiWorker.destroyChildren(this.app);

        this.loader = new Loader().setClassList('loader-main').appendToParent(this.app.parentElement).start();

        setTimeout(() => {
            if (this.loader.elem) this.loader.destroyItself();
        }, 4000);
    }

    completeMoveToRoute() {
        if (this.curRoute === 'api') this.app.classList.add('height-100perc');
        else this.app.classList.remove('height-100perc');
        this.navBar.enable();
        this.loader.destroyItself();
    }

    static selectChildren(menu, id) {
        for (let i = 0; i < menu.children.length; i++) {
            console.log('menu:', menu);
            console.log('id:', id);
            console.log('menu.children[i]', menu.children[i]);
            if (menu.children[i].id === id) {
                menu.children[i].classList.add('selected');
                return;
            }
        }
        console.error('reached selectChildren without finding child. children: ', menu);
    }

    static iterateHtmlCollection(collection, func) {
        console.log('iterateHtmlCollection, children: ', collection);
        for (let i = 0; i < collection.children.length; i++) {
            func(collection.children[i]);
        }
    }

    static store(key, value, local = true) {
        if (local) {
            localStorage.setItem(key, value);
        }
    }

    static getStore(key, local = true) {
        if (local) {
            return localStorage.getItem(key);
        }
    }

    static destroyChildren(elem) {
        if (elem) {
            if (elem instanceof Elem) elem = elem.elem;
            while (elem.firstChild) {
                elem.lastChild.remove();
            }
        }
        return elem;
    }
};
