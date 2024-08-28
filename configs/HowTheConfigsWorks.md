# How to navigate configuration of DalaMirrors

Every configuration file is a json file placed inside the `configs` directory, independent from running client or server (or both).

## Server configuration

In the server subdirectory resides two files `defaultServerConfig.json` and `serverConfig.json`.
The first mentioned has the default values for the config and should not be edited.
The second is user defined config which is then prioritely merged with the defaults.
Same goes for other configs.

Options in this config include:

| Option                  | Description                                                                 | Default value                      |
| :---------------------: | :-------------------------------------------------------------------------: | :--------------------------------: |
| address                 | IP address on whitch to host DalaMirrors                                    | `localhost`                        |
| port                    | Port to be used for communication                                           | `8080`                             |
| ipWhiteList             | An array of IP addresses that are the only ones allowed to acces the server | `[]`                               |
| ipBlackList             | An array of IP addresses that are not allowed to access the server          | `[]`                               |
| https                   | Use http or https                                                           | `false`                            |
| httpHeaders             | http headers used by Helmet library                                         | see the config for more info       |
| checkServerInterval     | How often should client contact the server (should be electron config?)     | `30000` (30s)                      |
| logLevel                | What kind of logging should the server output                               | `['INFO', 'LOG', 'WARN', 'ERROR']` |
| reloadAferServerRestart | idk man                                                                     | `false`                            |
| language                | What language to use (maybe electron too?)                                  | `en`                               |
| units                   | Imperial/metric system (maybe electron too?)                                | `metric`                           |
| zoom                    | Scaling of UI (should be electron config)                                   | `1`                                |
| customCSS               | Path to file with custom css                                                | `""`                               |
| clientConfigs           | An array of names of client mirrors for example 'bathroom'                  | `[]`                               |

## Electron configuration

Options for the electron app used for clients that are used as mirrors.

| Option                  | Description                                                                 | Default value                      |
| :---------------------: | :-------------------------------------------------------------------------: | :--------------------------------: |
| address                 | IP address on whitch to host DalaMirrors                                    | `localhost`                        |
| port                    | Port to be used for communication                                           | `8080`                             |
| clientName              | Name of the client                                                          | `""`                               |
| gpu                     | Use hardware acceleration                                                   | `false`                            |
| zoom                    | Scale level of the app                                                      | `1`                                |
| electronOptions         | An array from which to pass electron specific options                       | `[]`                               |
| https                   | Use http or https                                                           | `false`                            |

## Client configurations

Definitions of clients (dashboars and mirrors alike). They have to have a special folder inside configs subdirectory and named after the client name.
Inside that folder needs to be a user defined `<clientName>.json`. Which will be used to create an client endpoint (`<http/https>//:<address>:<port>/<clientName>`). User can use `clientTemplate.json` as the starter point for their configuration.  
The server will also create two new files inside the folder that are necessery for proper functionality (if deleted, they will be automaticaly regenerated).


| Option                  | Description                                                                 | Default vaule                      |
| :---------------------: | :-------------------------------------------------------------------------: | :--------------------------------: |
| name                    | Name of the client                                                          | `""`                               |
| type                    | What type of client this config will describe (mirror or dashboard)         | `""`                               |
| users                   | What users have their client config for this client                         | `[]`                               |
| defaultModules          | An array of module configurations that will be displayed on the client when no user is logged | `[]`                               |

## User configurations

Each user has to have at least one file inside `config/users` folder. This file will be the default profile for a given user that will be displayed on a client when there is no specific client user config inside `config/<clientName>/users`.  

| Option                  | Description                                                                 | Default vaule                      |
| :---------------------: | :-------------------------------------------------------------------------: | :--------------------------------: |
| name                    | Name of the user                                                            | `""`                               |
| modules                 | An array of module configurations for the user                              | `[]`                               |


## Root mirror configuration

There is an file in `configs` folder called `rootDisplay.json`. This file is an instance of client configuration, but is specific to the root endpoint. This endpoint by default says that you should configure your client to look at an accual endpoint.

## Module configurations

In every array that consists of module configurations needs to be objects representing a module with these parameters.

| Option                  | Description                                                                 | Default vaule                      |
| :---------------------: | :-------------------------------------------------------------------------: | :--------------------------------: |
| module                  | Name of the module. Needs to be a valid and installed module                | `""`                               |
| position                | One of the valid positions in the DOM                                       | `""`                               |
| configuration           | An object containing the configuration options of the specific module       | `{}`                               |
| classes (optional)      | CSS classes that the module will gain                                       | `[]`                               |




