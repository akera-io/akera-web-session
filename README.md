[![Akera Logo](http://akera.io/logo.png)](http://akera.io/)

  Session management module for Akera.io web service.

## Installation

```bash
$ npm set registry "http://repository.akera.io/"
$ npm install akera-web-session
```

## Docs

  * [Website and Documentation](http://akera.io/)


## Tests

  To run the test suite, first install the dependencies, then run `npm test`:

```bash
$ npm install
$ npm test
```

## Quick Start

  This module is designed to be loaded as application level service which 
  is usually done by adding a reference to it in `services` section of 
  application's configuration.
   
  ```json
  "services": [
		{ 
			"middleware": "akera-web-session",
			"config": {
				"isolated": true,
				"store": {
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
  - `store`: default session memory store is not designed to be used in 
  production, use this section to define the store to be used for session 
  persistence:
  	- `connector`: the module providing the session store
  	- any connector specific configuration
  - all options available on express-session module with following defaults
  	- resave: false
  	- saveUninitialized: false
  	- unset: 'destroy'
  
  
## License
	
MIT 

  	