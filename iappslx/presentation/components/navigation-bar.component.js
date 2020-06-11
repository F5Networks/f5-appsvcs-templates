module.exports = class NavigationBar {
    constructor(route) {
        this.navBar = document.getElementById('nav-bar');
        this.titles = [];
        this.routes = [];

        let arr = Array.from(this.navBar.children);
        for(let i = 0; i < arr.length; i += 1) {
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

        let arr = Array.from(this.navBar.children);
        for(let i = 0; i < arr.length; i += 1) {
            if(arr[i].innerText === newTitle) {
                arr[i].id = 'selected-nav';
                arr[i].innerText = newTitle;
                this.disable();

                this.renderComplete = () => {
                    this.enable();
                    this.renderComplete = null;
                }
            }
        }
    }

    enable() {
        Array.from(this.navBar.children).forEach(child => {
            child.classList.remove('nav-disabled');
        });
    }

    disable() {
        Array.from(this.navBar.children).forEach(child => {
            child.classList.add('nav-disabled');
        });
    }
}