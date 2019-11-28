import React, { Component } from 'react'

export default class Menu extends Component {
    constructor() {
        super()
        this.state = { templateList: <p>Loading...</p> }
    }

    componentWillMount() {
        var req = new XMLHttpRequest()

        req.open('GET', '/mgmt/shared/mystique/template-names')
        req.addEventListener('load', () => {
            let res = JSON.parse(req.responseText)
            let templateList = []
            res.forEach(item => {
                let url = `/iapps/mystique/${item.ui}?template=${item.template}`
                let name = item.template.replace(/\.[^.]*?$/, '')
                templateList.push(
                  <div>
                    <a href={ url }>{ name }</a>
                  </div>
                )
            })
            this.setState({ templateList: templateList })
        })
        req.send()
    }

    render() {
        return (
            <div>
              {this.state.templateList}
            </div>
        )
    }
}