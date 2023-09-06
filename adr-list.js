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

const downloadADR = (url, callback) => {
  var xhr = new XMLHttpRequest();
  this.adrs = {}

  xhr.open('GET', url, true);
  xhr.onload = callback;
  xhr.send(null);
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
    this.branchName = "main";
    this.downloanding = 0;
  }

  get namespace() {
    return this.getAttribute('namespace') || 'RHEnVision';
  }

  get repository() {
    return this.getAttribute('repo') || 'provisioning-backend';
  }

  get adrsPath() {
    return this.getAttribute('path') || 'docs/adr';
  }

  adrLink(key) {
    return `https://raw.githubusercontent.com/${this.namespace}/${this.repository}/${this.branchName}/${this.adrsPath}/${this.adrs[key].name}`
  }

  connectedCallback() {
    const style = document.createElement('style');
    style.innerHTML = STYLES;
    this.$list = document.createElement('ul');
    this.$list.classList = "adr-index";
    this._shadowRoot.appendChild(style);
    this._shadowRoot.appendChild(this.$list);


    const component = this;
    var xhr = new XMLHttpRequest();
    const url = `https://api.github.com/repos/${this.namespace}/${this.repository}/contents/${this.adrsPath}`;
    this.adrs = {}

    xhr.open('GET', url, true);
    xhr.onload = function () {
        // do something to response
        const adrEntries = JSON.parse(this.response);

        adrEntries.forEach((adr, i) => {
          const key = adr.name.split('-')[0];
          // filter out non ADRs and template
          if (!/^\d/.test(key) || key.endsWith('0')) return;
          component.downloanding += 1;
          downloadADR(adr.download_url, function() {
            component.adrs[key] = parseADR(adr.name, this.response);
            component.downloanding -= 1;
            component.refresh();
          })
        });
    };
    xhr.send(null);
  }

  refresh() {
    const component = this;
    this.$list.innerHTML = '';
    Object.keys(this.adrs).sort().reverse().forEach((key) => {
      const elem = document.createElement('li');
      const adr = component.adrs[key];
      elem.innerHTML = `<a href="${this.adrLink(key)}" target="_blank">${adr.title}</a><span class="status ${adr.status}">${humanReadableStatus(adr.status)}</span>`;
      component.$list.appendChild(elem);
    })
  }
}

window.customElements.define('adr-list', ADRList);
