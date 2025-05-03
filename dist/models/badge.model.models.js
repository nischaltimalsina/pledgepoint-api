"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.badge = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const badgeSchema = new mongoose_1.default.Schema({
// schema definition
});
exports.badge = mongoose_1.default.model('badge', badgeSchema);
