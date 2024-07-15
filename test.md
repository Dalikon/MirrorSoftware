start in index.js

1. Express server (defined in server.js, defines connection to the mirrors)
    - http/https server
    - base html file (only test that the server works)
    - master config prototype
    - basic client module loader (aka reading from config what files to get from server and start, these files would display something)
    - extand the html file to include js files needed for previous step
    - recreate the basic html file modules to js

2. socket io (defined in backend.js, creates backend for the modules in config that has it defined)
    - basic node.js scripts that will communicate with some of the basic js module files they are written for
    - the backend scripts will communicate with the frontend ones with the socket

3. use defined socket io in index.js to manage communication with other systems of the mirror smart home.
