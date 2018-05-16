"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const glob = require("glob");
const pify = require("pify");
const Parser = require("./src/parser");
const UI = require("./src/ui");
const engine_1 = require("./src/engine");
let totalRenderTime = 0;
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const files = yield pify(glob)('./gists/*/script.txt');
        console.log(`Looping over ${files.length} games...`);
        for (let filename of files) {
            console.log(`Parsing and rendering ${filename}`);
            const code = fs_1.readFileSync(filename, 'utf-8');
            const { data, error, trace } = Parser.parse(code);
            if (error) {
                console.log(trace.toString());
                console.log(error.message);
                throw new Error(filename);
            }
            else {
                // console.log(data.title)
                // return
                const startTime = Date.now();
                // Draw the "last" level (after the messages)
                const level = data.levels.filter(level => level.isMap())[0];
                if (level) {
                    const engine = new engine_1.default(data);
                    engine.setLevel(data.levels.indexOf(level));
                    engine.on('cell:updated', cell => {
                        UI.drawCellAt(data, cell, cell.rowIndex, cell.colIndex);
                    });
                    UI.renderScreen(data, engine.currentLevel);
                    for (var i = 0; i < 10; i++) {
                        yield sleep(500);
                        const changes = engine.tick();
                        if (changes.length === 0) {
                            break;
                        }
                    }
                }
                UI.clearScreen();
                totalRenderTime += Date.now() - startTime;
            }
        }
        console.log('-----------------------');
        console.log('Renderings took:', totalRenderTime);
        console.log('-----------------------');
    });
}
run();
