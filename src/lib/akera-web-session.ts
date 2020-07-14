import * as session from "express-session";
import {ConnectionPool, ConnectionPoolOptions, LogLevel} from "@akeraio/api";
import {WebMiddleware} from "@akeraio/web-middleware";
import {Router} from "express";

export interface AkeraSessionOptions extends session.SessionOptions {
  isolated?: boolean;
  resave?: boolean;
  saveUnitialized?: boolean;
  unset?: any;
  secret: string;
  store?: any;
}

export default class AkeraWebSession extends WebMiddleware {
  private _router: Router;
  private _config: AkeraSessionOptions;
  private _connectionPool: ConnectionPool;

  public constructor(config: AkeraSessionOptions) {
    super();
    this._config = config;
  }

  public mount(config: ConnectionPoolOptions | ConnectionPool): Router {
    if (this._router) {
      return this._router;
    }

    this._router = Router({
      mergeParams: true
    });

    this.initConnectionPool(config);
  }

  /**
   * Logs a message into the log file.
   */
  public log(level: LogLevel, message: string): void {
    this._connectionPool.log(message, level);
  }

  private initConnectionPool(brokerConfig: ConnectionPoolOptions | ConnectionPool): void {
    if (brokerConfig instanceof ConnectionPool) {
      this._connectionPool = brokerConfig;
      return;
    }

    this._connectionPool = new ConnectionPool(brokerConfig);
  }

  public initSession(config: AkeraSessionOptions) {
    if (!config || typeof config !== "object") {
      config = {secret: "_akera_"};
    }

    this._config = config;
    // set-up required/default values
    this._config.resave = this._config.resave || false;
    this._config.saveUninitialized = this._config.saveUninitialized || false;
    this._config.unset = this._config.unset || "destroy";
    this._config.secret = this._config.secret || "__akera__";
    this._config.isolated = this._config.isolated === true;

    if (typeof this._config.store === "object" && this._config.store.connector) {
      try {
        // some connectors works better if they get session on initialization
        const SessionStore = require(this._config.store.connector)(session);
        this._config.store = new SessionStore(this._config.store);

        this._config.store.on("disconnect", (err) => {
          if (err) {
            this.log(LogLevel.warn, `Session store disconnected - ${err.message}`);
          }
        });
      } catch (err) {
        this.log(LogLevel.warn, `Unable to initialize session store ${config.store.connector} - ${err.message}`);
      }
    }

    this._router.use(session(config), (req, res, next) => {
      if (req.session && req.session.get !== "function") {
        req.session.all = function () {
          if (config.isolated !== true) {
            return this;
          }

          if (this.req.broker && this._data) {
            return this._data[this.req.broker.alias];
          }

          return undefined;
        };
        req.session.get = function (name) {
          if (config.isolated !== true) {
            return this[name];
          }

          if (this.req.broker && this._data) {
            const broker = this._data[this.req.broker.alias];

            if (broker && typeof broker === "object") {
              return broker[name];
            }
          }

          return undefined;
        };
        req.session.set = function (name, val) {
          if (config.isolated !== true) {
            if (val === undefined) {
              delete this[name];
            } else this[name] = val;
            return;
          }
          if (this.req.broker) {
            const broker = this.req.broker.alias;

            if (val === undefined) {
              if (this._data[broker]) {
                delete this._data[broker][name];
              }
            } else {
              if (!this._data) {
                this._data = {};
              }

              if (!this._data[broker]) {
                this._data[broker] = {};
              }

              this._data[broker][name] = val;
            }
          }
        };
      }
      next();
    });
  }
}
