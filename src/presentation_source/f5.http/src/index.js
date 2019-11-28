import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, useLocation } from "react-router-dom"
import AppEdit from "./AppEdit.js"
import './index.css'

ReactDOM.render(<Root />, document.getElementById('root'))

function Root() {
    return (
      <BrowserRouter basename='/iapps/mystique'>
        <h3>f5.http Deployment</h3>
        <h4>Custom Template</h4>
        <QueryParamRouter />
      </BrowserRouter>
    )
}

function QueryParamRouter() {
    let query = new URLSearchParams(useLocation().search)
    let t = query.get('template')
    return <AppEdit template={ t } />
}