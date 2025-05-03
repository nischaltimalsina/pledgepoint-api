"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promise = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const promiseSchema = new mongoose_1.default.Schema({
// schema definition
});
exports.promise = mongoose_1.default.model('promise', promiseSchema);
