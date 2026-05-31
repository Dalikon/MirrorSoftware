const Helper = require('../../dist/js/helper').default

class helloworldHelper extends Helper {
    loaded () {
        console.log("this is me HelloWorld!")
    }
}

module.exports = helloworldHelper;
