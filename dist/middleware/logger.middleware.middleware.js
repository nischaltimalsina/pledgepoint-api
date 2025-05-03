"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger_middleware = void 0;
const logger_middleware = (req, res, next) => {
    next();
};
exports.logger_middleware = logger_middleware;
