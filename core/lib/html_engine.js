'use strict';

const fs = require('fs');
const Mustache = require('mustache');

const HTML_ROOT_DIR = process.AFL_HE_ROOT_DIR || '/var/config/rest/iapps/mystique/html/';

// style
const solarizedColors = {
    Base03: '#002b36',
    Base02: '#073642',
    Base01: '#586e75',
    Base00: '#657b83',
    Base0: '#839496',
    Base1: '#93a1a1',
    Base2: '#eee8d5',
    Base3: '#fdf6e3',
    Yellow: '#b58900',
    Orange: '#cb4b16',
    Red: '#dc322f',
    Magenta: '#d33682',
    Violet: '#6c71c4',
    Blue: '#268bd2',
    Cyan: '#2aa198',
    Green: '#859900'
};

const tomorrowSolarLight = {
    Background: solarizedColors.Base3,
    CurrentLine: solarizedColors.Base2,
    Selection: solarizedColors.Base3,
    Foreground: solarizedColors.Base01,
    Comment: solarizedColors.Base00,
    Red: solarizedColors.Red,
    Orange: solarizedColors.Orange,
    Yellow: solarizedColors.Yellow,
    Green: solarizedColors.Green,
    Aqua: solarizedColors.Cyan,
    Blue: solarizedColors.Blue,
    Purple: solarizedColors.Violet
};

const tomorrowSolarDark = {
    Background: solarizedColors.Base03,
    CurrentLine: solarizedColors.Base02,
    Selection: solarizedColors.Base03,
    Foreground: solarizedColors.Base1,
    Comment: solarizedColors.Base0,
    Red: solarizedColors.Red,
    Orange: solarizedColors.Orange,
    Yellow: solarizedColors.Yellow,
    Green: solarizedColors.Green,
    Aqua: solarizedColors.Cyan,
    Blue: solarizedColors.Blue,
    Purple: solarizedColors.Violet
};

const tomorrowNight = {
    Background: '#1d1f21',
    CurrentLine: '#282a2e',
    Selection: '#373b41',
    Foreground: '#c5c8c6',
    Comment: '#969896',
    Red: '#cc6666',
    Orange: '#de935f',
    Yellow: '#f0c674',
    Green: '#b5bd68',
    Aqua: '#8abeb7',
    Blue: '#81a2be',
    Purple: '#b294bb'
};

const tomorrow = {
    Background: '#ffffff',
    CurrentLine: '#efefef',
    Selection: '#d6d6d6',
    Foreground: '#4d4d4c',
    Comment: '#8e908c',
    Red: '#c82829',
    Orange: '#f5871f',
    Yellow: '#eab700',
    Green: '#718c00',
    Aqua: '#3e999f',
    Blue: '#4271ae',
    Purple: '#8959a8'
};

const tomorrowNight80s = {
    Background: '#2d2d2d',
    CurrentLine: '#393939',
    Selection: '#515151',
    Foreground: '#cccccc',
    Comment: '#999999',
    Red: '#f2777a',
    Orange: '#f99157',
    Yellow: '#ffcc66',
    Green: '#99cc99',
    Aqua: '#66cccc',
    Blue: '#6699cc',
    Purple: '#cc99cc'
};

const tomorrowNightBlue = {
    Background: '#002451',
    CurrentLine: '#00346e',
    Selection: '#003f8e',
    Foreground: '#ffffff',
    Comment: '#7285b7',
    Red: '#ff9da4',
    Orange: '#ffc58f',
    Yellow: '#ffeead',
    Green: '#d1f1a9',
    Aqua: '#99ffff',
    Blue: '#bbdaff',
    Purple: '#ebbbff'
};

const tomorrowNightBright = {
    Background: '#000000',
    CurrentLine: '#2a2a2a',
    Selection: '#424242',
    Foreground: '#eaeaea',
    Comment: '#969896',
    Red: '#d54e53',
    Orange: '#e78c45',
    Yellow: '#e7c547',
    Green: '#b9ca4a',
    Aqua: '#70c0b1',
    Blue: '#7aa6da',
    Purple: '#c397d8'
};

const themes = [
    tomorrowSolarLight,
    tomorrowSolarDark,
    tomorrowNight,
    tomorrow,
    tomorrowNight80s,
    tomorrowNightBlue,
    tomorrowNightBright
];

let currentTheme = 0;
const setTheme = (theme) => {
    currentTheme = theme % themes.length;
};

const applyColors = function (view) {
    return Object.assign(view, themes[currentTheme]);
};

// used for rendering application views
function HtmlTemplate(name) {
    this.name = name;
    this.html_template = fs.readFileSync(`${HTML_ROOT_DIR}${name}.mst`).toString('utf8');
    return this;
}

HtmlTemplate.prototype.render = function render(data, partial, createView) {
    // console.log(`rendering ${this.name}`);
    const prepare = createView || (d => d);
    const view = applyColors(prepare(data));
    return Mustache.render(this.html_template, view, partial);
};

// const themeCss = new HtmlTemplate('themed_css');
// const getTheme = () => themeCss.render({});

module.exports = {
    HtmlTemplate,
    setTheme
    // getTheme,
};
