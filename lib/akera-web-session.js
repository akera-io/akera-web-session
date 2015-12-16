var session = require('express-session');

module.exports = function(akeraWebApp, sessionConfig) {
  var AkeraWeb = null;

  try {
    AkeraWeb = akeraWebApp.require('akera-web');
  } catch (err) {
  }

  if (!AkeraWeb || !(akeraWebApp instanceof AkeraWeb))
    throw new Error('Invalid Akera web service instance');

  if (!sessionConfig || typeof sessionConfig !== 'object')
    sessionConfig = {};

  // set-up required/default values
  sessionConfig.resave = sessionConfig.resave || false;
  sessionConfig.saveUninitialized = sessionConfig.saveUninitialized || false;
  sessionConfig.unset = sessionConfig.unset || 'destroy';
  sessionConfig.secret = sessionConfig.secret || '__akera__';
  sessionConfig.isolated = sessionConfig.isolated || false;

  if (typeof sessionConfig.store === 'object' && sessionConfig.store.connector) {
    try {
      // some connectors works better if they get session on initialization
      var SessionStore = akeraWebApp.require(sessionConfig.store.connector)(
          session);
      sessionConfig.store = new SessionStore(sessionConfig.store);

      sessionConfig.store.on('disconnect', function(err) {
        if (err)
          akeraWebApp
              .log('warn', 'Session store disconnected - ' + err.message);
      });
    } catch (err) {
      akeraWebApp.log('warn', 'Unable to initialize session store "'
          + sessionConfig.store.connector + '" - ' + err.message);
    }
  }

  // session is decorated with variable getter/setter
  akeraWebApp.router.use(session(sessionConfig), function(req, res, next) {
    if (req.session) {
      req.session.all = function() {
        if (sessionConfig.isolated !== true)
          return this;

        if (this.req.broker && this._data)
          return this._data[this.req.broker.alias];

        return undefined;
      };

      req.session.get = function(name) {
        if (sessionConfig.isolated !== true)
          return this[name];

        if (this.req.broker && this._data) {
          var broker = this._data[this.req.broker.alias];

          if (broker && typeof broker === 'object')
            return broker[name];
        }

        return undefined;
      };

      req.session.set = function(name, val) {
        if (sessionConfig.isolated !== true) {
          this[name] = val;
          return;
        }

        if (this.req.broker) {
          var broker = this.req.broker.alias;

          if (!this._data)
            this._data = {};

          if (!this._data[broker])
            this._data[broker] = {};

          this._data[broker][name] = val;
        }
      };
    }

    next();
  });

}
