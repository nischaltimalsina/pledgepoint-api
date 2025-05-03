"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.district = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const districtSchema = new mongoose_1.default.Schema({
// schema definition
});
exports.district = mongoose_1.default.model('district', districtSchema);
