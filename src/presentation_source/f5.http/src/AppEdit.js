import React, { Component } from 'react'

export default class AppEdit extends Component {
    constructor(props) {
        super(props)
        this.state = {
            notice: <p>Loading...</p>,
            name: props.template.replace(/\.[^.]*?$/, ''),
            remark: '',
            fields: []
        }
        this.handleChange = this.handleChange.bind(this)
        this.handleSubmit = this.handleSubmit.bind(this)
    }

    componentWillMount() {
        var req = new XMLHttpRequest()
        req.open('GET', `/mgmt/shared/mystique/template/${this.props.template}`)
        req.addEventListener('load', () => {
            this.setState(JSON.parse(req.responseText))
        })
        req.send()
    }

    handleChange(e) {
        let fields = this.state.fields
        fields[e.target.id].value = e.target.value
        this.setState({ fields })
    }

    handleSubmit(e) {
        let fields = this.state.fields
        console.log(fields)
    }

    render() {
        if (this.state.fields.length === 0) return this.state.notice
        return (
            <div>
              <h3>{this.state.title}</h3>
              <p>{this.state.description}</p>
              <table>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
                {this.state.fields.map((item, idx) => (
                  <tr>
                    <td>{item.name}</td>
                    <td>{inputWidget(idx, item, this.handleChange)}</td>
                  </tr>
                ))}
              </table>
              <button name="submit" onClick={this.handleSubmit}>Submit</button>
            </div>
        )
    }
}

function inputWidget(idx, item, handleChange) {
    let jsx
    switch(item.type) {
    case 'dropdown_menu':
        jsx = (
            <span>
              <input id={idx} type="text" value={item.value} onChange={handleChange} />
              dropdown
            </span>
        )
        break
    case 'yesno_buttons':
        jsx = (
            <span>
              <input id={idx} type="radio" checked={item.value==="true"} value="true" onChange={handleChange} />Yes
              <input id={idx} type="radio" checked={item.value!=="true"} value="false" onChange={handleChange} />No
            </span>
        )
        break
    case 'text_input':
    default:
        jsx = (
            <span>
              <input id={idx} type="text" value={item.value} onChange={handleChange} />
            </span>
        )
        break
    }
    return jsx
}