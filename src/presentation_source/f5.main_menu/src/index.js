import React from 'react'
import ReactDOM from 'react-dom'
import TemplateMenu from "./TemplateMenu.js"
import './index.css'

ReactDOM.render(<Root />, document.getElementById('root'))

function Root() {
    return (
      <div>
        <h3>HOME</h3>
        <h4>Template Menu</h4>
        <TemplateMenu />
      </div>
    )
}