"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.official = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const officialSchema = new mongoose_1.default.Schema({
// schema definition
});
exports.official = mongoose_1.default.model('official', officialSchema);
