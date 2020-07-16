import * as session from "express-session";
import { ConnectionPool, ConnectionPoolOptions, LogLevel } from "@akeraio/api";
import { WebMiddleware } from "@akeraio/web-middleware";
import { Router, NextFunction } from "express";

export interface AkeraSessionOptions extends session.SessionOptions {
  /**
   * If set to true the session variables will be isolated at the broker
   * level.
   */
  isolated?: boolean;
  /**
   * Unless a valid `store` is provided this can specify the storage
   * provider to be used to store/persist the session data.
   */
  storeConfig?: {
    /**
     * The store connector provider module to be instantiated.
     */
    connector: string,
    /**
     * Any other connector provider specific configuration.
     */
    [key: string]: any;
  }
}

/**
 * Isolated session extends [Express Session](https://github.com/expressjs/session)
 * by adding new get/set methods to retrieve or set a value in current session
 * that can handle broker level isolation. That's it a session variable set on 
 * one broker route can be different from one set on another broker's route.
 */
export class IsolatedSession implements Express.Session {
  /**
   * 
   * @param _sess Original Express Session instance injected in Request.
   * @param _broker Optional broker name if isolation is required.
   */
  constructor(private _sess: Express.Session, private _broker?: string) {
  }

  get id(): string {
    return this._sess.id;
  }

  get cookie(): Express.SessionCookie {
    return this._sess.cookie;
  }

  regenerate(callback: (err: any) => void): void {
    this._sess.regenerate(callback);
  }

  destroy(callback: (err: any) => void): void {
    this._sess.destroy(callback);
  }

  reload(callback: (err: any) => void): void {
    this._sess.reload(callback);
  }

  save(callback: (err: any) => void): void {
    this._sess.save(callback);
  }

  touch(): void {
    this._sess.touch();
  }

  /**
   * Returns all session variables, if broker isolation is used it
   * returns only the variables set for the broker on which the 
   * request was made otherwise all variables from the session are returned.
   */
  all(): object {
    if (this._broker)
      return this[this._broker];

    return this;
  }

  /**
   * Returns the value of a specific sesson variable. It can be 
   * a broker specific one or session wide depending on whether 
   * or not isolation is being used.
   * 
   * @param name variable name
   */
  get(name: string): any {
    if (!this._broker) {
      return this[name];
    } else {
      return this[this._broker] ? this[this._broker][name] : undefined;
    }
  }

  /**
   * Sets the value of a specific sesson variable. It can be 
   * a broker specific one or session wide depending on whether 
   * or not isolation is being used.
   * 
   * @param name variable name
   * @param val variable value to store in the session, if null or 
   * undefined the variable is deleted from the session.
   */
  set(name: string, val: any): void {
    if (!this._broker) {
      if (val === undefined) {
        delete this[name];
      } else {
        this[name] = val;
      }
    } else {
      if (val === undefined) {
        if (this[this._broker]) {
          delete this[this._broker][name];
        }
      } else {
        if (!this[this._broker]) {
          this[this._broker] = {};
        }

        this[this._broker][name] = val;
      }
    }
  }
}

export class AkeraWebSession extends WebMiddleware {
  private _router: Router;
  private _connectionPool: ConnectionPool;

  public constructor(private _config: AkeraSessionOptions) {
    super();
  }

  /**
   * Return an Express Router that have the Express Session 
   * middleware injected. The `session` property on Express Request
   * accessible further down will be an `IsolatedSession`.
   * 
   * @param configPool The broker(s) connection configuration.
   */
  public mount(configPool: ConnectionPoolOptions | ConnectionPool): Router {
    if (this._router) {
      return this._router;
    }

    this._config = this._config || { secret: "_akera_" };

    // set-up required/default values
    this._config.resave = this._config.resave || false;
    this._config.saveUninitialized = this._config.saveUninitialized || false;
    this._config.unset = this._config.unset || "destroy";
    this._config.secret = this._config.secret || "__akera__";

    if (!this._config.store && this._config.storeConfig) {
      if (!this._config.storeConfig.connector) {
        this._config.storeConfig = {
          connector: 'memorystore',
          checkPeriod: 86400000 // 24 hours purge period
        };

        this.log(LogLevel.warn, `Session store provider not set in store configuration, "memorystore" used as default.`);
      }

      try {
        // some connectors works better if they get session on initialization
        const SessionStore = require(this._config.storeConfig.connector)(session);
        this._config.store = new SessionStore(this._config.storeConfig);
      } catch (err) {
        this.log(LogLevel.warn, `Unable to initialize session store ${this._config.storeConfig.connector} - ${err.message}`);
      }
    }

    if (this._config.store instanceof session.Store) {
      this._config.store.on("disconnect", (err) => {
        if (err) {
          this.log(LogLevel.warn, `Session store disconnected - ${err.message}`);
        }
      });
    }

    this._router = Router({
      mergeParams: true
    });

    if (configPool instanceof ConnectionPool) {
      this._connectionPool = configPool;
    } else {
      this._connectionPool = new ConnectionPool(configPool);
    }

    this._config.isolated = this._config.isolated === true &&
      this._connectionPool.brokers.length > 1;

    if (this._config.isolated) {
      this._router.use('/:broker',
        session(this._config),
        (req, res, next) => {
          this.decorateSession(req, next, req.params['broker']);
        });
    } else {
      this._router.use(session(this._config),
        (req, res, next) => {
          this.decorateSession(req, next);
        });
    }
  }

  private decorateSession(req: Express.Request, next?: NextFunction, broker?: string): void {
    if (!(req.session instanceof IsolatedSession)) {
      // validate the broker route agains the existing brokers in connection pool
      if (broker &&
        this._connectionPool.brokers.findIndex(b => { return b.toLowerCase() == broker.toLowerCase() }) === -1) {
        broker = undefined;
      };

      req.session = new IsolatedSession(req.session, broker);
    }

    if (next)
      next();
  }

  /**
   * Logs a message into the log file.
   */
  public log(level: LogLevel, message: string): void {
    try {
      this._connectionPool.log(message, level);
    } catch (err) {
    }
  }
}
