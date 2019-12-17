import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, useLocation } from "react-router-dom"
import AppEdit from "./AppEdit.js"
import './index.css'

ReactDOM.render(<Root />, document.getElementById('root'))

function Root() {
    return (
      <BrowserRouter basename='/iapps/mystique'>
        <h3>Application Deployment</h3>
        <h4>Default Template</h4>
        <QueryParamRouter />
      </BrowserRouter>
    )
}

function QueryParamRouter() {
    let query = new URLSearchParams(useLocation().search)
    let tmpl = query.get('template')
    let tenant = query.get('tenant')
    let app = query.get('app')
    return <AppEdit template={ tmpl } tenant={ tenant } app={ app } />
}