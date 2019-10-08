const fs = require('fs');
const Mustache = require('mustache');

const HTML_ROOT_DIR = process.AFL_HE_ROOT_DIR || '/var/config/rest/iapps/mystique/html/'

// style
const solarized_colors = {
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
  Green: '#859900',
};

const tomorrow_solar_light = {
  Background: solarized_colors.Base3,
  CurrentLine: solarized_colors.Base2,
  Selection: solarized_colors.Base3,
  Foreground: solarized_colors.Base01,
  Comment: solarized_colors.Base00,
  Red: solarized_colors.Red,
  Orange: solarized_colors.Orange,
  Yellow: solarized_colors.Yellow,
  Green: solarized_colors.Green,
  Aqua: solarized_colors.Cyan,
  Blue: solarized_colors.Blue,
  Purple: solarized_colors.Violet,
};

const tomorrow_solar_dark = {
  Background: solarized_colors.Base03,
  CurrentLine: solarized_colors.Base02,
  Selection: solarized_colors.Base03,
  Foreground: solarized_colors.Base1,
  Comment: solarized_colors.Base0,
  Red: solarized_colors.Red,
  Orange: solarized_colors.Orange,
  Yellow: solarized_colors.Yellow,
  Green: solarized_colors.Green,
  Aqua: solarized_colors.Cyan,
  Blue: solarized_colors.Blue,
  Purple: solarized_colors.Violet,
};

const tomorrow_night = {
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
  Purple: '#b294bb',
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
  Purple: '#8959a8',
};

const tomorrow_night_80s = {
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
  Purple: '#cc99cc',
};

const tomorrow_night_blue = {
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
  Purple: '#ebbbff',
};

const tomorrow_night_bright = {
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
  Purple: '#c397d8',
};

const themes = [
  tomorrow_solar_light,
  tomorrow_solar_dark,
  tomorrow_night,
  tomorrow,
  tomorrow_night_80s,
  tomorrow_night_blue,
  tomorrow_night_bright,
];

var current_theme = 0;
const setTheme = (theme) => {
  current_theme = theme % themes.length;
};

const applyColors = function (view) {
  return Object.assign(view, themes[current_theme]);
};

// used for rendering application views
function HtmlTemplate(name, p) {
  this.name = name;
  this.html_template = fs.readFileSync(`${HTML_ROOT_DIR}${name}.mst`).toString('utf8');
  return this;
}

HtmlTemplate.prototype.render = function (data, partial, create_view) {
  // console.log(`rendering ${this.name}`);
  const prepare = create_view || (d => d);
  const view = applyColors(prepare(data));
  return Mustache.render(this.html_template, view, partial);
};

// const themeCss = new HtmlTemplate('themed_css');
// const getTheme = () => themeCss.render({});

module.exports = {
  HtmlTemplate,
  setTheme,
  // getTheme,
};
