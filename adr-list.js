const PROPOSED_STATUS = 'proposed';
const ACCEPTED_STATUS = 'accepted';
const AMENDED_STATUS = 'amended';
const SUPERSEDED_STATUS = 'superseded';
const UNKNOWN_STATUS = 'unknown';

const STYLES = `
  li {
    height: 2em;
  }
  .status {
    margin-left: 8px;
    color: white;
    padding: 4px 8px;
    text-align: center;
    border-radius: 5px;
  }
  .status.accepted {
    background-color: green;
  }
  .status.superseded {
    background-color: red;
  }
  .status.amended {
    background-color: orange;
  }
  .status.proposed {
    background-color: blue;
  }
  .status.unknown {
    color: red;
    background-color: grey;
  }
`

const humanReadableStatus = (status) => {
  switch (status) {
    case PROPOSED_STATUS:
      return 'Proposed';
    case ACCEPTED_STATUS:
      return 'Accepted';
    case AMENDED_STATUS:
      return 'Amended';
    case SUPERSEDED_STATUS:
      return 'Superseded';
    default:
      return 'Unknown';
  }
}

const parseADR = (name, text) => {
  const adr = { name, status: UNKNOWN_STATUS, authors: [] };
  let inStatus = false;

  text.split('\n').every((line, i) => {
    if (line.startsWith('# ')) {
      adr.title = line.slice(2);
    } else if (!inStatus && line.startsWith("Authors: ")) {
      adr.authors = line.split(': ')[1].split(', ')
    } else if (!inStatus && line.startsWith('## Status')) {
      inStatus = true;
    } else if (inStatus && !line.startsWith('## ')) {
      if (line.includes("Amended by")) {
        adr.status = AMENDED_STATUS;
        return false;
      } else if (line.includes("Superseded by")) {
        adr.status = SUPERSEDED_STATUS;
        return false;
      } else if (line.includes("Accepted")) {
        adr.status = ACCEPTED_STATUS;
      } else if (line.includes("Proposed") || line.includes("Pending")) {
        adr.status = PROPOSED_STATUS;
      }
    } else if (inStatus) {
      return false;
    }
    return true;
  });

  return adr;
}

class ADRList extends HTMLElement {
  constructor() {
    super();
    this._shadowRoot = this.attachShadow({ 'mode': 'open' });
    this.adrs = {};
    this.branchName = "";
  }

  get token() {
    return this.getAttribute('token');
  }

  get namespace() {
    return 'RHEnVision';
  }

  get repository() {
    return 'provisioning-backend';
  }

  get adrsPath() {
    return 'docs/adr';
  }

  adrLink(key) {
    return `https://raw.githubusercontent.com/${this.namespace}/${this.repository}/${this.branchName}/${this.adrsPath}/${this.adrs[key].path}`
  }

  connectedCallback() {
    const component = this;
    var xhr = new XMLHttpRequest();
    const url = "https://api.github.com/graphql";
    this.adrs = {}

    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `bearer ${this.token}`)
    xhr.onload = function () {
        // do something to response
        const jsonData = JSON.parse(this.response).data;
        const adrEntries = jsonData.repository.defaultBranchRef.target.file.object.entries;

        component.branchName = jsonData.repository.defaultBranchRef.name;
        adrEntries.forEach((adr, i) => {
          const key = adr.name.split('-')[0];
          // filter out non ADRs and template
          if (!/^\d/.test(key) || key.endsWith('0')) return;
          component.adrs[key] = parseADR(adr.name, adr.object.text);
        });
        component.refresh();
    };
    xhr.send(JSON.stringify({query: this.graphqlQuery()}));
  }

  graphqlQuery() {
    return `
query {
  repository(owner: "${this.namespace}", name: "${this.repository}") {
    defaultBranchRef {
      name
      target {
        ... on Commit {
          file(path: "${this.adrsPath}") {
            object {
              ... on Tree {
                entries {
                  name
                  object {
                    ... on Blob {
                      text
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
    `
  }

  refresh() {
    const style = document.createElement('style');
    style.innerHTML = STYLES;
    const $list = document.createElement('ul');
    $list.classList = "adr-index"
    for (const [key, adr] of Object.entries(this.adrs)) {
      let elem = document.createElement('li');
      elem.innerHTML = `<a href="${this.adrLink(key)}" target="_blank">${adr.title}</a><span class="status ${adr.status}">${humanReadableStatus(adr.status)}</span>`;
      $list.appendChild(elem);
    }
    this._shadowRoot.appendChild(style);
    this._shadowRoot.appendChild($list);
  }
}

window.customElements.define('adr-list', ADRList);
