import { Parser } from "./block.js";
import fs from "fs";

const input = fs.readFileSync("/dev/stdin", "utf8");

const warn = function(msg, pos) {
//  process.stderr.write(msg + (pos ? " at " + pos : "") + "\n");
}

let start = true;
console.time("parse events");
for (const event of new Parser(input, warn)) {
  let pref;
  if (start) {
    pref = "[";
    start = false;
  } else {
    pref = ",";
  }
  process.stdout.write(pref);
  process.stdout.write(`["${event.annot}",${event.startpos},${event.endpos}]\n`);
}
console.log("]");
console.timeEnd("parse events");
