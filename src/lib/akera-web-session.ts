import * as session from "express-session";
import {IBroker,ConnectionPoolOptions,ConnectionPool,AkeraLogger,LogLevel} from "@akeraio/api";
import {WebMiddleware,IWebMiddleware} from "@akeraio/web-middleware";
import {Router} from "express";
export interface AkeraSessionOptions extends session.SessionOptions {
  isolated?: boolean;
  resave?: boolean;
  saveUnitialized?: boolean;
  unset?: any;
  secret: string;
  store?:any;
 
  
}


type LoggerFunction = (level: LogLevel, message: string) => void;

export default class AkeraWebSession extends WebMiddleware {
  
  sessionConfig?: AkeraSessionOptions;
  private _router: Router;
 private _logger:LoggerFunction;
 private _config:AkeraSessionOptions;
 private _connectionPool: ConnectionPool;
 

 get log(): LoggerFunction {
  return this._logger;
}
public constructor(config?: AkeraSessionOptions) {
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


  if (config instanceof ConnectionPool) {
    this._logger = (level: LogLevel, message: string) => config.log(message, level);
  } else if ("logger" in config) {
    this._logger = config.logger.log;
  } else {
    this._logger = () => ({});
  }
  this.initConnectionPool(config);
}
  

 
 private initConnectionPool(brokerConfig?: ConnectionPoolOptions | ConnectionPool): void {
  if (brokerConfig instanceof ConnectionPool) {
    this._connectionPool = brokerConfig;
    return;
  }
}
 
  
 public initSession(config: AkeraSessionOptions, router) {
   
    if (
      !router ||
      !router.__app ||
      typeof router.__app.require !== "function"
    ) {
      throw new Error("Invalid Akera web service router.");
    }
    
    if (!config || typeof config !== "object") config = { secret: "_akera_" };
    // set-up required/default values
    config.resave = config.resave || false;
    config.saveUninitialized = config.saveUninitialized || false;
    config.unset = config.unset || "destroy";
    config.secret = config.secret || "__akera__";
    // if mounted as broker level service then is 'isolated' by default
    config.isolated = router._broker !== undefined || config.isolated === true;
    if (typeof config.store === "object" && config.store.connector) {
      try {
        // some connectors works better if they get session on initialization
        const SessionStore = require(config.store.connector)(session);
        config.store = new SessionStore(config.store);

        config.store.on("disconnect", function (err) {
          if (err) {
          this.logger(
              "warn",
              ` Session store disconnected - ${err.message}`
            );
          }
        });
      } catch (err) {
        this._logger(
          'warn',
          `Unable to initialize session store ${config.store.connector}  -  ${err.message}`
        );
      }
    }

    // session is decorated with variable getter/setter

    router.use(session(config), function (req, next) {
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
  
  
  

    this.initSession(this.sessionConfig, this._router);
  }
}





let config:AkeraSessionOptions;
let router:Router;
const akeraWebSess= new AkeraWebSession();
akeraWebSess.initSession(config,router);



