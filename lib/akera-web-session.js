module.exports = AkeraWebSession;

var session = require('express-session');

function AkeraWebSession(akeraWebApp, sessionConfig) {

  this.init = function(config, router) {

    if (!router || !router.__app || typeof router.__app.require !== 'function')
      throw new Error('Invalid Akera web service router.');

    var akeraApp = router.__app;

    if (!config || typeof config !== 'object')
      config = {};

    // set-up required/default values
    config.resave = config.resave || false;
    config.saveUninitialized = config.saveUninitialized || false;
    config.unset = config.unset || 'destroy';
    config.secret = config.secret || '__akera__';

    // if mounted as broker level service then is 'isolated' by default
    config.isolated = router.__broker !== undefined || config.isolated === true;

    if (typeof config.store === 'object' && config.store.connector) {
      try {
        // some connectors works better if they get session on initialization
        var SessionStore = akeraApp.require(config.store.connector)(session);
        config.store = new SessionStore(config.store);

        config.store.on('disconnect',
            function(err) {
              if (err)
                akeraApp.log('warn', 'Session store disconnected - '
                    + err.message);
            });
      } catch (err) {
        akeraApp.log('warn', 'Unable to initialize session store "'
            + config.store.connector + '" - ' + err.message);
      }
    }

    // session is decorated with variable getter/setter
    router.use(session(config), function(req, res, next) {
      if (req.session && req.session.get !== 'function') {
        req.session.all = function() {
          if (config.isolated !== true)
            return this;

          if (this.req.broker && this._data)
            return this._data[this.req.broker.alias];

          return undefined;
        };

        req.session.get = function(name) {
          if (config.isolated !== true)
            return this[name];

          if (this.req.broker && this._data) {
            var broker = this._data[this.req.broker.alias];

            if (broker && typeof broker === 'object')
              return broker[name];
          }

          return undefined;
        };

        req.session.set = function(name, val) {
          if (config.isolated !== true) {
            if (val === undefined)
              delete this[name];
            else
              this[name] = val;
            return;
          }

          if (this.req.broker) {
            var broker = this.req.broker.alias;

            if (val === undefined) {
              if (this._data[broker])
                delete this._data[broker][name];
            } else {
              if (!this._data)
                this._data = {};

              if (!this._data[broker])
                this._data[broker] = {};

              this._data[broker][name] = val;
            }
          }
        };
      }

      next();
    });

  }

  if (akeraWebApp !== undefined) {
    // mounted as application level service
    var AkeraWeb = null;

    try {
      AkeraWeb = akeraWebApp.require('akera-web');
    } catch (err) {
    }

    if (!AkeraWeb || !(akeraWebApp instanceof AkeraWeb))
      throw new Error('Invalid Akera web service instance');

    this.init(sessionConfig, akeraWebApp.router);

  }
}

AkeraWebSession.init = function(config, router) {
  var akeraWebSess = new AkeraWebSession();
  akeraWebSess.init(config, router);
}
