"use strict";
const noUnconsumedFetch = require("./rules/no-unconsumed-fetch");
const meta = {
    name: "no-unconsumed-fetch",
    version: "1.0.0-alpha.0",
};
const rules = {
    "no-unconsumed-fetch": noUnconsumedFetch,
};
const plugin = {
    meta,
    rules,
    configs: Object.create(null),
};
plugin.configs.recommended = {
    name: "no-unconsumed-fetch/recommended",
    plugins: {
        "no-unconsumed-fetch": plugin,
    },
    rules: {
        "no-unconsumed-fetch/no-unconsumed-fetch": "error",
    },
};
module.exports = plugin;
//# sourceMappingURL=index.js.map