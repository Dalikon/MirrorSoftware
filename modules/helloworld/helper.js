const Helper = require('../../js/helper')

class helloworldHelper extends Helper {
    loaded () {
        console.log("this is me HelloWorld!")
    }
}

module.exports = helloworldHelper;
