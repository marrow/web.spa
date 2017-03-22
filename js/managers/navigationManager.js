export default class NavigationManager {
    constructor(context) {
        this.loaded = false;
        this.context = context;

        this.sitepath = window.location.protocol + '//' + window.location.host; // eslint-disable-line
    }

    start() {
        console.log('NavigationManager starting.');

        this._navigate(window.location.pathname);
    }

    bindEvents() {
        window.onpopstate = this.popstate.bind(this);

        // e = Events(document);
        // e.on('click', '#nav-toggle', this.toggleNavigation.bind(this));
        // e.on('click', 'a', this.navigate.bind(this));
        document.body.addEventListener('click', this.navigate.bind(this));
    }

    popstate(e) {
        if (!e.state) return;
        // this.navigate({href:e.state.url});
        // Navigate without pushing a new state

        console.debug('Attempting to move through time.', e.state, e);
        swal('Attempting to move through time.'); // eslint-disable-line
    }

    navigate(event) {
        const e = event || window.event;
        let element = e.target || e.srcElement;
        while (element.nodeName.toUpperCase() !== 'A') {
            if (!element.parentNode) { return ''; }
            element = element.parentNode;
        }

        if (!element.href.startsWith(this.sitepath)) {
            return '';
        }

        if (element.classList && element.classList.contains('no-nav')) {
            return '';
        }

        event.preventDefault();
        event.stopPropagation();
        return this._navigate(element.href); // eslint-disable-line
    }

    _navigate(path) {
        console.debug('Attempting navigation.', path);

        const target = document.getElementsByTagName('main')[0];
        target.classList.add('loading');

        const request = this.context.request.get(path.substring(this.sitepath.length), null, {'Accept': 'text/html'});
        request.then(this.inject.bind(this));

        return false;
    }

    inject(error, text, xhr) {
        if (error) {
            console.error('Unable to load main content.', xhr.status, xhr.statusText, xhr);
            return;
        }

        console.debug('Loaded content.', xhr);
        this._inject(text, xhr.responseURL); // eslint-disable-line
    }

    _inject(text, responseURL) {
        const parser = new DOMParser();
        const element = parser.parseFromString(text, 'text/html');

        // clear main element - "nuke" it.
        const target = document.getElementsByTagName('main')[0];
        while (target.firstChild) {
            target.removeChild(target.firstChild);
        }

        // copy all templates into main content
        const templates = element.querySelectorAll('template');
        [].forEach.call(templates, (template) => { target.appendChild(template); });

        // Inject first template, it's assumed page content, into page.
        const template = target.querySelector('template');
        template.dispatchEvent(
            new Event('action.injectTemplate', {
                bubbles: true,
                cancelable: true,
            })
        );

        // Once the template is injected, we're done loading.
        target.classList.remove('loading');

        // manage page title
        let header = document.getElementsByTagName('h3');
        if (!header || header.length <= 0) {
            header = 'CRO Software';
        }

        const title = header[0].textContent.trim();
        const state = { title, url: responseURL };

        document.title = title;

        // deal with history
        if (!history.state) {
            console.debug('Setting initial state.', state);
            history.replaceState(state, title, responseURL);
        } else if (history.state.url !== responseURL.substring(this.sitepath.length)) {
            console.debug('Pushing new state.', state);
            history.pushState(state, title, responseURL);
        }
    }
}
