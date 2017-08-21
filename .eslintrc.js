module.exports = {
    "extends": "defaults/configurations/walmart/es5",
    "plugins": [
    "import"
    ],
    "globals": {
    	"document": true,
    	"window": true,
        "console": true,
        "XMLHttpRequest": true,
        "twttr": true,
        "FB": true
    },
    "rules": {
        // "new-cap": [1, {"newIsCapExceptions": ["express"]}],
        "max-len": [1, 200, 2, {ignoreComments: true}],
        "comma-dangle": ['error', 'never'],
        "import/no-named-as-default": [0],
        "class-methods-use-this": [0],
        "no-underscore-dangle": [0],
        "no-restricted-syntax": [0],
        "import/first": [1],
        "no-plusplus": [0],
        "vars-on-top": [1],
        "no-console": [0],
        "no-shadow": [0],
        "camelcase": [0],
        "one-var": [0],
        "no-magic-numbers": [0],
        "curly": [0],
        "brace-style": [0],
        "no-extra-parens": [0],
        "quotes": [0]
    }
};