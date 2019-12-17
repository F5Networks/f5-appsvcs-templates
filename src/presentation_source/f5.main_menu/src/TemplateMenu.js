import React, { Component } from 'react'

export default class Menu extends Component {
    constructor() {
        super()
        this.state = {
            templateList: <p>Loading...</p>,
            appList: <p>Loading...</p>
        }
    }

    getList(cat) {
        var req = new XMLHttpRequest()
        req.open('GET', `/mgmt/shared/mystique/${cat}-names`)
        req.addEventListener('load', () => {
            let res = JSON.parse(req.responseText)
            let list = []
            let state = {}
            res.forEach(item => {
                let url = `/iapps/mystique/${item.ui}?template=${item.template}`
                let x = item.template.replace(/\.[^.]*?$/, '')
                let y = ''
                if (cat === 'app') {
                    y = <span>({ x })</span>
                    x = item.app
                    url += `&app=${x}&tenant=${item.tenant}`
                }
                list.push(
                  <div>
                    <span><a href={ url }>{ x }</a>{ y }{ item.remark }</span>
                  </div>
                )
            })
            state[`${cat}List`] = list
            this.setState(state)
        })
        req.send()
    }

    componentWillMount() {
        this.getList('template')
        this.getList('app')
    }
        
    render() {
        return (
            <div>
              <h4>Template Menu</h4>
              {this.state.templateList}
              <h4>App Menu</h4>
              {this.state.appList}
            </div>
        )
    }
}