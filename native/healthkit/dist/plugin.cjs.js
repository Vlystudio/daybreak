"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthKit = void 0;
var core = require("@capacitor/core");
// See dist/esm/index.js — the native pod is what registers "HealthKit".
exports.HealthKit = core.registerPlugin("HealthKit");
