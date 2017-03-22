import style from '../scss/application.scss';

import RequestManager from './managers/requestManager';
import NavigationManager from './managers/navigationManager';
import ActionManager from './managers/actionManager';
import DataManager from './managers/dataManager';


const context = {};
context.navigation = new NavigationManager(context);
context.request = new RequestManager(context);
context.action = new ActionManager(context);
context.data = new DataManager(context);
// context.cookie = new CookieManager(context);

// context.cookie.start();
context.request.start();
context.action.start();
context.data.start();
context.navigation.start();

context.action.bindEvents();
context.data.bindEvents();
context.navigation.bindEvents();

window.context = context;

document.body.addEventListener('action.reload', reload);

function reload() {
    context.navigation._navigate(window.location.href); //eslint-disable-line
}
