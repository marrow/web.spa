import utils from '../utils/utils';
import formToObj from '../tools/formToObj';

function getSourcePaginator(elementId) {
    return document.querySelector(`[data-paginate='${elementId}']`);
}


function getFilterData(elementId, resetPagination = true) {
    const filters = {};

    // should all be forms
    const filterForms = document.querySelectorAll(`form[data-filter='${elementId}']`);

    // Find all inputs with possible filter data
    Array.from(filterForms).forEach((form) => {
        //
        const data = formToObj(form);
        Object.assign(filters, data);
    });

    // Find pagination values
    const paginator = getSourcePaginator(elementId);
    if (!paginator) return filters;
    filters.limit = parseInt(paginator.querySelector('input.limit').value, 10);
    if (!resetPagination) {
        filters.offset = (parseInt(paginator.querySelector('input.page').value, 10) - 1) * filters.limit;
    } else {
        filters.offset = 0;
    }
    // TODO Num results per page

    return filters;
}


function updatePaginatorDom(element) {
    if (!element || !element.id || element.id.length === 0) return;

    const data = element.querySelector('tbody:not(.hide)').dataset;
    const page = parseInt(data.page, 10);
    const pages = parseInt(data.pages, 10);
    const count = parseInt(data.count, 10);
    const limit = parseInt(data.limit, 10);

    const paginator = getSourcePaginator(element.id);
    if (!paginator) return;
    paginator.querySelector('input.page').value = page;
    paginator.querySelector('input.limit').value = limit;
    paginator.querySelector('.total').textContent = `/ ${pages}`;
    paginator.querySelector('.prev').disabled = (page <= 1);
    paginator.querySelector('.first').disabled = (page === 1);
    paginator.querySelector('.next').disabled = (page >= pages);
    paginator.querySelector('.last').disabled = (page === pages);
}


function getFilterTarget(filter) {
    const eleId = filter.dataset.filter;
    const element = document.getElementById(eleId);
    return element;
}


export default class DataManager {
    constructor(context) {
        this.context = context;
    }

    start() {
        console.log('DataManager starting.');
    }

    bindEvents() {
        const target = document.getElementsByTagName('main')[0];
        this.observer = new MutationObserver(this.processMutations.bind(this));
        this.observer.observe(target, { childList: true, subtree: false });
    }

    processMutations(mutations) {
        mutations.forEach(this.handleMutation.bind(this));
    }

    handleMutation(mutation) {
        if (mutation.addedNodes.length === 0) { return; }

        Array.from(mutation.addedNodes).forEach(this.processAdded.bind(this));
    }

    unbindEvents() {
        this.observer.disconnect();
    }

    processAdded(element) {
        if (element.nodeType > 1 || element.tagName === 'TEMPLATE' || element.tagName === 'SCRIPT') return;

        const sourceElements = element.querySelectorAll('[data-source]');
        Array.from(sourceElements).forEach((sourceElement) => {
            console.debug('Found [data-source] element');
            this.getData(sourceElement);
            this.bindFilterListeners(sourceElement);
            this.bindPaginatorListeners(sourceElement);
        });
    }

    bindFilterListeners(element) {
        /*
        * Binds event listeners to the onChange events of filters for the specific element
        */
        if (!element || !element.id || element.id.length <= 0) return;

        const filterElements = document.querySelectorAll(`form[data-filter='${element.id}']`);

        Array.from(filterElements).forEach((filter) => {
            const getData = () => this.getData(getFilterTarget(filter), false);

            filter.addEventListener('change', getData);
        });
    }

    bindPaginatorListeners(element) {
        if (!element || !element.id || element.id.length <= 0) return;

        const paginator = getSourcePaginator(element.id);
        if (!paginator) return;


        const page = paginator.querySelector('input.page');
        if (!page) return;

        const getData = (event, reset) => {
            this.getData(element, !reset);
            event.preventDefault();
            event.stopPropagation();
        };

        // Create listener functions
        const setChangeListener = (ele, reset) => {
            ele.addEventListener('change', (event) => {
                getData(event, reset);
            });
        };

        const setClickListener = (selector, value) => {
            paginator.querySelector(selector).addEventListener(('click'), (event) => {
                page.value = value();
                getData(event, false);
            });
        };

        // Super hacky currying nonsense to delay execute of data gathering until the event executes, all for DRY
        const deferIncrease = (inc) => () => parseInt(page.value, 10) + inc;
        const deferSelect = () => element.querySelector('tbody:not(.hide)').dataset.pages;

        setChangeListener(page, false);
        setChangeListener(paginator.querySelector('input.limit'), true);

        setClickListener('.next', deferIncrease(1));
        setClickListener('.prev', deferIncrease(-1));
        setClickListener('.first', () => 1);
        setClickListener('.last', deferSelect);
    }

    getData(element, requestedByPaginator = false) {
        /*
        * Creates a request for the data-source attr and listens to the promise to call populateData
        * `element` - the data-source element we are opreating on
        * `requestedByPaginator` - whether or not this was requested by a paginator control
        */

        // Gather filter data
        const filters = getFilterData(element.id, !requestedByPaginator);

        if (!requestedByPaginator) {
            // Remove all children of the data-source element
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        } else {
            // We know it was paginator requested and not filter requested
            // hide all displayed tbody
            const unhidden = element.querySelectorAll('tbody:not(.hide)');
            Array.from(unhidden).forEach((tbody) => {
                tbody.classList.add('hide');
            });

            // check cache if requestedByPaginator
            const pageNum = parseInt(Math.ceil(filters.offset / filters.limit), 10) + 1;
            const page = element.querySelector(`tbody[data-page='${pageNum}']`);
            // it the page exists already
            if (page) {
                // unhide the cached tbody that we want
                page.classList.remove('hide');
                updatePaginatorDom(element);
                return;
            }

            // Cached tbody wasn't found, let the default request happen.
        }

        const source = element.dataset.source;

        let Accept = 'application/json';
        if (!element.dataset.template) Accept = 'text/html';

        const request = this.context.request.get(source, filters, { Accept });
        request.then(this.populateData.bind(this, element));
    }

    populateData(element, err, text, xhr) {
        /*
        * Handles populating the returned data in to the data-source element
        */
        // Insert new content
        // Check content type to determine if it's json or html
        const type = xhr.getResponseHeader('content-type');

        if (type === 'application/json') {
            // bind json data into into template instances to become children of element
            const data = utils.parseJSON(text);
            if (!data) {
                swal("Could not parse return content."); // eslint-disable-line
                return;
            }

            this.importTemplateData(element, data);
        } else if (type.substring(0, 9) === 'text/html') {
            // insert html directly into element
            // TODO: Make this more secure, very dangerous at the moment
            element.innerHTML += text; // eslint-disable-line
        }

        updatePaginatorDom(element);
    }

    importTemplateData(element, data) {
        const templateName = element.dataset.template;
        if (!templateName) {
            console.warn('Attempted to bind data-source element but could not find the template attribute.');
            return;
        }

        const template = document.querySelector(`#${templateName}`);
        console.debug('Looking for paginator for element: ', element);
        if (!template) {
            console.warn(`Attempted to bind data-source element but could not find the template ${templateName}`);
        }

        let dataEvent = new Event(`data.before.${templateName}`, { bubbles: true, cancelable: true });
        element.dispatchEvent(dataEvent);
        if (dataEvent.defaultPrevented) { return; }

        data.forEach((r) => {
            /*
             * For each result import template node mentioned by the template
             * then set data of imported content to that result's data
             */
            const t = document.importNode(template.content, true);
            if (!t) { return; }

            const bound = t.querySelectorAll('[data-bind]');

            Array.from(bound).forEach((item) => {
                const ele = item;
                const attr = item.dataset.bind;
                const fill = item.dataset.field;
                if (!attr || !fill) { return; }
                const value = attr.split('.').reduce((a, b) => a[b], r);
                ele[fill] = value;
            });

            element.appendChild(t);
        });

        dataEvent = new Event(`data.after.${templateName}`, { bubbles: true, cancelable: true });
        element.dispatchEvent(dataEvent);
    }
}
