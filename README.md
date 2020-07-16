[![Akera Logo](http://akera.io/logo.png)](http://akera.io/)

  Session management module for Akera.io web service.

## Installation

```bash
$ npm install @akeraio/web-session
```

## Docs

  * [Website and Documentation](http://akera.io/)


## Quick Start

  This module is designed to be loaded as application level service 
  which is usually done by adding a reference to it in `services` 
  section of application's configuration.
   
  ```json
  "services": [
		{ 
			"middleware": "@akeraio/web-session",
			"config": {
				"isolated": true,
				"storeConfig": {
					"connector": "connect-redis",
					"host": "10.10.10.6",
					"db": 0
				}
			}
		}
	]
  ```
  
  Service options available:
  - `isolated`: if set to true session data is 'isolated' at broker level, 
  each broker will have it's own session space - default is false, same 
  session data will be available on all brokers 
  - `storeConfiguration`: unless a session store was set in session 
  configuration use this section to define the store to be used for session 
  persistence. The default session memory store is not designed to be used in production, by default [memorystore](https://www.npmjs.com/package/memorystore) is used:
  	- `connector`: the module providing the session store
  	- any connector specific configuration
  - all options available on express-session module with following defaults
  	- resave: false
  	- saveUninitialized: false
  	- unset: 'destroy'
  
  
## License
	
MIT 

  	