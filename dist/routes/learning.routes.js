"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Define your routes
router.get('/', (req, res) => {
    res.send('learning route');
});
exports.default = router;
